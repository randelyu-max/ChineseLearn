import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import { PINYIN_SESSION_V2_CAPABILITY } from '../session-plan-v2-service.js';
import {
  importApprovedPinyinContent,
  PINYIN_CURRICULUM_VERSION_ID,
} from './pinyin-content-import.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const repositoryRoot = process.env.REPOSITORY_ROOT
  ? resolve(process.env.REPOSITORY_ROOT)
  : resolve(process.cwd(), '../..');
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

async function expectDatabaseError(operation: () => Promise<unknown>, code: string): Promise<void> {
  let actualCode = '';
  try {
    await operation();
  } catch (error) {
    actualCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';
  }
  assert.equal(actualCode, code);
}

try {
  await client.query('begin');
  const first = await importApprovedPinyinContent(client, { repositoryRoot });
  const second = await importApprovedPinyinContent(client, { repositoryRoot });
  assert.deepEqual(second, first, 'The formal import must be idempotent');

  const conceptCount = await client.query<{ count: string }>(
    `select count(*) from public.pinyin_concepts
     where curriculum_version_id = $1 and content_status = 'approved' and not is_published`,
    [PINYIN_CURRICULUM_VERSION_ID],
  );
  assert.equal(Number(conceptCount.rows[0]?.count), first.conceptCount);

  await client.query(
    `update public.media_assets
     set is_published = true
     where id in (
       select audio_asset_id from public.pinyin_concepts
       where curriculum_version_id = $1 and audio_asset_id is not null
     )`,
    [PINYIN_CURRICULUM_VERSION_ID],
  );
  await client.query(
    `update public.pinyin_concepts
     set content_status = 'published', is_published = true
     where curriculum_version_id = $1`,
    [PINYIN_CURRICULUM_VERSION_ID],
  );
  await client.query(
    `update public.curriculum_versions
     set status = 'published', published_at = now()
     where id = $1`,
    [PINYIN_CURRICULUM_VERSION_ID],
  );

  const enumLabels = await client.query<{ enumlabel: string; typname: string }>(
    `select t.typname, e.enumlabel
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     where t.typname in ('concept_type', 'skill_type')
     order by t.typname, e.enumsortorder`,
  );
  const labels = new Set(enumLabels.rows.map((row) => `${row.typname}:${row.enumlabel}`));
  assert.ok(labels.has('concept_type:pinyin'));
  for (const skill of [
    'audio_to_pinyin',
    'pinyin_to_audio',
    'pinyin_to_glyph',
    'glyph_to_pinyin',
    'tone_choice',
    'pinyin_syllable_build',
  ]) {
    assert.ok(labels.has(`skill_type:${skill}`));
  }

  const unpublishedId = randomUUID();
  await client.query(
    `insert into public.pinyin_concepts (
       id, curriculum_version_id, concept_code, kind, canonical_value, display_value,
       content_status, is_published
     ) values ($1, $2, $3, 'initial', 'x', 'x', 'draft', false)`,
    [unpublishedId, PINYIN_CURRICULUM_VERSION_ID, `pinyin.initial.test-${unpublishedId}`],
  );

  const initialId = (
    await client.query<{ id: string }>(
      `select id from public.pinyin_concepts
       where curriculum_version_id = $1 and kind = 'initial'
       order by concept_code limit 1`,
      [PINYIN_CURRICULUM_VERSION_ID],
    )
  ).rows[0]!.id;
  const toneId = (
    await client.query<{ id: string }>(
      `select id from public.pinyin_concepts
       where curriculum_version_id = $1 and kind = 'tone'
       order by concept_code limit 1`,
      [PINYIN_CURRICULUM_VERSION_ID],
    )
  ).rows[0]!.id;

  await client.query('savepoint invalid_component');
  await expectDatabaseError(
    () =>
      client.query(
        `insert into public.pinyin_concepts (
           id, curriculum_version_id, concept_code, kind, canonical_value, display_value,
           numbered_value, tone_number, initial_concept_id, final_concept_id,
           content_status, is_published
         ) values ($1, $2, $3, 'syllable', 'ma', 'má', 'ma2', 2, $4, $5, 'draft', false)`,
        [
          randomUUID(),
          PINYIN_CURRICULUM_VERSION_ID,
          `pinyin.syllable.invalid-${randomUUID()}`,
          initialId,
          toneId,
        ],
      ),
    '23514',
  );
  await client.query('rollback to savepoint invalid_component');

  await client.query('savepoint immutable_published');
  await expectDatabaseError(
    () =>
      client.query(`update public.pinyin_concepts set display_value = 'changed' where id = $1`, [
        initialId,
      ]),
    '23514',
  );
  await client.query('rollback to savepoint immutable_published');

  const wordId = randomUUID();
  const sentenceId = randomUUID();
  await client.query(
    `insert into public.words (
       id, concept_code, simplified_text, pinyin, canonical_pinyin, surface_pinyin
     ) values ($1, $2, '你好', 'nǐ hǎo', 'nǐ hǎo', 'ní hǎo')`,
    [wordId, `reading-word-${wordId}`],
  );
  await client.query(
    `insert into public.sentences (
       id, concept_code, simplified_text, canonical_pinyin, surface_pinyin
     ) values ($1, $2, '你好。', 'nǐ hǎo', 'ní hǎo')`,
    [sentenceId, `reading-sentence-${sentenceId}`],
  );
  const reading = await client.query<{
    canonical_pinyin: string;
    surface_pinyin: string;
  }>(
    `select canonical_pinyin, surface_pinyin from public.words where id = $1
     union all
     select canonical_pinyin, surface_pinyin from public.sentences where id = $2`,
    [wordId, sentenceId],
  );
  assert.deepEqual(reading.rows, [
    { canonical_pinyin: 'nǐ hǎo', surface_pinyin: 'ní hǎo' },
    { canonical_pinyin: 'nǐ hǎo', surface_pinyin: 'ní hǎo' },
  ]);

  await client.query('set local role hanziquest_app');
  const appVisible = await client.query<{ count: string }>(
    `select count(*) from public.pinyin_concepts
     where curriculum_version_id = $1`,
    [PINYIN_CURRICULUM_VERSION_ID],
  );
  assert.equal(
    Number(appVisible.rows[0]?.count),
    first.conceptCount,
    'Runtime role must not read unpublished Pinyin content',
  );
  await client.query('savepoint app_insert_denied');
  await expectDatabaseError(
    () =>
      client.query(
        `insert into public.pinyin_concepts (
           id, curriculum_version_id, concept_code, kind, canonical_value, display_value
         ) values ($1, $2, $3, 'initial', 'z', 'z')`,
        [randomUUID(), PINYIN_CURRICULUM_VERSION_ID, `pinyin.initial.forged-${randomUUID()}`],
      ),
    '42501',
  );
  await client.query('rollback to savepoint app_insert_denied');
  await client.query('reset role');

  assert.deepEqual(PINYIN_SESSION_V2_CAPABILITY, {
    attempts: true,
    planning: true,
  });

  console.log(
    `Pinyin PostgreSQL integration passed: ${first.conceptCount} concepts, idempotent import, constraints, immutable publication, audio metadata, reading round-trip, RLS publication filter, and server capability verified.`,
  );
  await client.query('rollback');
} catch (error) {
  try {
    await client.query('rollback');
  } catch {
    // Preserve the first failure.
  }
  throw error;
} finally {
  client.release();
  await pool.end();
}
