import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { productionCurriculumReleaseV1 } from '@hanziquest/curriculum';
import { Pool } from 'pg';

import { createOrReplaySessionPlanV2 } from '../session-plan-v2-service.js';
import { withUserTransaction } from './pool.js';
import {
  importProductionCurriculumRelease,
  ProductionReleaseImportError,
} from './production-curriculum-import.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const repositoryRoot = process.env.REPOSITORY_ROOT
  ? resolve(process.env.REPOSITORY_ROOT)
  : resolve(process.cwd(), '../..');
const migrationsDirectory = resolve(repositoryRoot, 'database/migrations');
const databaseName = `hanziquest_release_${randomUUID().replaceAll('-', '')}`;
const targetUrl = new URL(databaseUrl);
targetUrl.pathname = `/${databaseName}`;
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = '/postgres';
const adminPool = new Pool({ connectionString: adminUrl.toString(), max: 1 });

async function applyMigrations(pool: Pool): Promise<void> {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  for (const name of names) {
    const sql = await readFile(resolve(migrationsDirectory, name), 'utf8');
    await pool.query(sql);
  }
}

async function expectImportCode(
  operation: () => Promise<unknown>,
  expected: ProductionReleaseImportError['code'],
): Promise<void> {
  let actual: string | null = null;
  try {
    await operation();
  } catch (error) {
    actual = error instanceof ProductionReleaseImportError ? error.code : null;
  }
  assert.equal(actual, expected);
}

await adminPool.query(`create database "${databaseName}"`);
const pool = new Pool({ connectionString: targetUrl.toString(), max: 4 });
try {
  await applyMigrations(pool);

  const oldReleaseId = randomUUID();
  const oldSessionId = randomUUID();
  const pinnedUserId = randomUUID();
  await pool.query(
    `insert into public.curriculum_versions (
       id, version, script_track, status, manifest_sha256, published_at
     ) values ($1, '0.9.0', 'simplified', 'published', $2, now())`,
    [oldReleaseId, '9'.repeat(64)],
  );
  await pool.query(
    `insert into public.active_curriculum_releases (
       spoken_track, script_track, curriculum_version_id
     ) values ('mandarin', 'simplified', $1)`,
    [oldReleaseId],
  );
  await pool.query(
    `insert into public."user" (id, name, email, "emailVerified")
     values ($1, 'Pinned User', $2, true)`,
    [pinnedUserId, `${pinnedUserId}@example.test`],
  );
  await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Pinned User')`, [
    pinnedUserId,
  ]);
  await pool.query(
    `insert into public.learning_sessions (
       id, user_id, client_session_id, idempotency_key, curriculum_version_id,
       intent, target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 'learn', 5, 'pinned-test-v1', '{}')`,
    [oldSessionId, pinnedUserId, randomUUID(), `pinned:${randomUUID()}`, oldReleaseId],
  );

  const client = await pool.connect();
  let first;
  try {
    await client.query('begin');
    first = await importProductionCurriculumRelease(client, { repositoryRoot });
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  assert.equal(first.alreadyImported, false);

  const repeatClient = await pool.connect();
  try {
    await repeatClient.query('begin');
    const repeated = await importProductionCurriculumRelease(repeatClient, { repositoryRoot });
    assert.equal(repeated.alreadyImported, true);
    assert.deepEqual(repeated.manifestSha256, first.manifestSha256);
    await repeatClient.query('commit');
  } catch (error) {
    await repeatClient.query('rollback');
    throw error;
  } finally {
    repeatClient.release();
  }

  const mismatch = {
    ...productionCurriculumReleaseV1,
    minimumAppVersion: '1.0.1',
  } as unknown as typeof productionCurriculumReleaseV1;
  const mismatchClient = await pool.connect();
  try {
    await mismatchClient.query('begin');
    await expectImportCode(
      () =>
        importProductionCurriculumRelease(mismatchClient, {
          release: mismatch,
          repositoryRoot,
        }),
      'HASH_MISMATCH',
    );
    await mismatchClient.query('rollback');
  } finally {
    mismatchClient.release();
  }

  const pending = {
    ...productionCurriculumReleaseV1,
    releaseId: randomUUID(),
    version: '1.0.1',
    editorialReview: { ...productionCurriculumReleaseV1.editorialReview, status: 'pending' },
  } as unknown as typeof productionCurriculumReleaseV1;
  const unauthorized = {
    ...productionCurriculumReleaseV1,
    releaseId: randomUUID(),
    version: '1.0.2',
    media: [{ ...productionCurriculumReleaseV1.media[0], authorized: false }],
  } as unknown as typeof productionCurriculumReleaseV1;
  const validationClient = await pool.connect();
  try {
    await expectImportCode(
      () =>
        importProductionCurriculumRelease(validationClient, {
          release: pending,
          repositoryRoot,
        }),
      'CONTENT_INVALID',
    );
    await expectImportCode(
      () =>
        importProductionCurriculumRelease(validationClient, {
          release: unauthorized,
          repositoryRoot,
        }),
      'CONTENT_INVALID',
    );
  } finally {
    validationClient.release();
  }

  const active = await pool.query<{ curriculum_version_id: string }>(
    `select curriculum_version_id
       from public.active_curriculum_releases
       where spoken_track = 'mandarin' and script_track = 'simplified'`,
  );
  assert.equal(active.rows[0]?.curriculum_version_id, productionCurriculumReleaseV1.releaseId);
  const pinned = await pool.query<{ curriculum_version_id: string }>(
    `select curriculum_version_id from public.learning_sessions where id = $1`,
    [oldSessionId],
  );
  assert.equal(pinned.rows[0]?.curriculum_version_id, oldReleaseId);

  const learnUserId = randomUUID();
  const reviewUserId = randomUUID();
  await pool.query(
    `insert into public."user" (id, name, email, "emailVerified")
     values ($1, 'Learn Smoke', $2, true), ($3, 'Review Smoke', $4, true)`,
    [learnUserId, `${learnUserId}@example.test`, reviewUserId, `${reviewUserId}@example.test`],
  );
  await pool.query(
    `insert into public.profiles (id, display_name)
     values ($1, 'Learn Smoke'), ($2, 'Review Smoke')`,
    [learnUserId, reviewUserId],
  );
  const learn = await withUserTransaction(pool, learnUserId, (transaction) =>
    createOrReplaySessionPlanV2(transaction, learnUserId, {
      schemaVersion: 'session-plan-request-v2',
      clientSessionId: randomUUID(),
      idempotencyKey: `release-learn:${randomUUID()}`,
      intent: 'learn',
      targetMinutes: 5,
      clientCapabilities: ['pinyin-exercises-v1'],
    }),
  );
  assert.equal(learn.result.result, 'planned', 'A fresh release must create a Learn Session');

  const reviewCharacterId = productionCurriculumReleaseV1.characters[0]!.id;
  await pool.query(
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version
     ) values ($1, 'character', $2, 'audio_to_glyph', now(), 'release-smoke', 1, 'review-v1')`,
    [reviewUserId, reviewCharacterId],
  );
  const review = await withUserTransaction(pool, reviewUserId, (transaction) =>
    createOrReplaySessionPlanV2(transaction, reviewUserId, {
      schemaVersion: 'session-plan-request-v2',
      clientSessionId: randomUUID(),
      idempotencyKey: `release-review:${randomUUID()}`,
      intent: 'review',
      targetMinutes: 5,
      clientCapabilities: ['pinyin-exercises-v1'],
    }),
  );
  assert.equal(review.result.result, 'planned', 'A fresh release must create a Review Session');

  let immutable = false;
  try {
    await pool.query(`update public.curriculum_versions set notes = 'changed' where id = $1`, [
      productionCurriculumReleaseV1.releaseId,
    ]);
  } catch {
    immutable = true;
  }
  assert.equal(immutable, true, 'Published release rows must be immutable');

  const receipt = await pool.query<{ count: string; manifest_sha256: string }>(
    `select manifest_sha256, count(*) over ()::text as count
       from public.curriculum_release_imports`,
  );
  assert.equal(receipt.rows[0]?.manifest_sha256, first.manifestSha256);
  assert.equal(Number(receipt.rows[0]?.count), 1);
  assert.match(first.manifestSha256, /^[a-f0-9]{64}$/);
  assert.notEqual(createHash('sha256').update('changed').digest('hex'), first.manifestSha256);
  console.log(
    `Production release database test passed: empty import, repeat, hash/review/media rejection, active pointer, Learn/Review smoke, pinned Session, immutability (${first.manifestSha256}).`,
  );
} finally {
  await pool.end();
  await adminPool.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1`,
    [databaseName],
  );
  await adminPool.query(`drop database "${databaseName}"`);
  await adminPool.end();
}
