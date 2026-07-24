import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Pool } from 'pg';

import { replaySkillState, type ReplayAttempt } from '../attempt-processing.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const migrationsDirectory = resolve(process.cwd(), '../../database/migrations');
const migrationNames = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const migration0010 = '0010_attempts_v2_normalized_evidence.sql';
assert.equal(
  migrationNames.at(-1),
  migration0010,
  'Backfill test expects 0010 to be the latest migration',
);

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  for (const name of migrationNames.filter((candidate) => candidate !== migration0010)) {
    await client.query(await readFile(resolve(migrationsDirectory, name), 'utf8'));
  }

  const userId = '81000000-0000-4000-8000-000000000001';
  const curriculumVersionId = '81000000-0000-4000-8000-000000000002';
  const sessionId = '81000000-0000-4000-8000-000000000003';
  const primaryConceptId = '81000000-0000-4000-8000-000000000004';
  const secondaryConceptId = '81000000-0000-4000-8000-000000000005';
  await client.query(
    `insert into public."user" (id, name, email, "emailVerified")
     values ($1, 'Backfill User', 'backfill@example.test', true)`,
    [userId],
  );
  await client.query(
    `insert into public.curriculum_versions (id, version, script_track)
     values ($1, 'backfill-fixture-v1', 'simplified')`,
    [curriculumVersionId],
  );
  await client.query(
    `insert into public.learning_sessions (
       id, user_id, client_session_id, idempotency_key, curriculum_version_id,
       status, target_minutes, plan_version, plan, started_at
     ) values (
       $1, $2, $1, $3, $4, 'in_progress', 10, 'legacy-backfill-fixture-v1', '{}', now()
     )`,
    [sessionId, userId, `legacy-session:${sessionId}`, curriculumVersionId],
  );
  const fixtures = [
    {
      id: '81000000-0000-4000-8000-000000000011',
      correct: true,
      occurredAt: '2026-07-24T10:00:00.000Z',
      offlineSequence: 2,
      evidenceWeight: 0.8,
      hintLevel: 0,
    },
    {
      id: '81000000-0000-4000-8000-000000000012',
      correct: false,
      occurredAt: '2026-07-24T10:00:00.000Z',
      offlineSequence: 1,
      evidenceWeight: 0.2,
      hintLevel: 0,
    },
  ] as const;
  for (const fixture of fixtures) {
    await client.query(
      `insert into public.attempts (
         id, offline_event_id, session_id, user_id, concept_type, concept_id, skill,
         activity_type, correct, hint_level, device_event_at, evidence_weight, metadata
       ) values (
         $1, $1, $2, $3, 'character', $4, 'audio_to_glyph', 'audio_to_glyph',
         $5, $6, $7, $8, $9
       )`,
      [
        fixture.id,
        sessionId,
        userId,
        primaryConceptId,
        fixture.correct,
        fixture.hintLevel,
        fixture.occurredAt,
        fixture.evidenceWeight,
        {
          offlineSequence: fixture.offlineSequence,
          pinyinSupport: 'none',
          targetConceptIds: [primaryConceptId, secondaryConceptId],
        },
      ],
    );
  }

  const expectedAttempts: ReplayAttempt[] = fixtures.map((fixture) => ({
    correct: fixture.correct,
    deviceEventAt: new Date(fixture.occurredAt),
    evidenceWeight: fixture.evidenceWeight,
    hintLevel: fixture.hintLevel,
    id: fixture.id,
    offlineSequence: fixture.offlineSequence,
    pinyinSupport: 'none',
  }));
  const expectedState = replaySkillState(expectedAttempts, 'audio_to_glyph');

  const migrationSql = await readFile(resolve(migrationsDirectory, migration0010), 'utf8');
  await client.query(migrationSql);
  const evidenceRows = await client.query<{
    correct: boolean;
    device_event_at: Date;
    effective_quality: string;
    hint_level: number;
    id: string;
    offline_sequence: string;
  }>(
    `select
       a.id,
       a.correct,
       a.device_event_at,
       ae.effective_quality::text,
       a.hint_level,
       coalesce(a.metadata ->> 'offlineSequence', '0') as offline_sequence
     from public.attempt_evidence ae
     join public.attempts a on a.id = ae.attempt_id and a.user_id = ae.user_id
     where ae.user_id = $1
       and ae.concept_type = 'character'
       and ae.concept_id = $2
       and ae.skill = 'audio_to_glyph'
       and ae.ability_axis = 'hanzi_recognition'
     order by a.device_event_at, (a.metadata ->> 'offlineSequence')::bigint, a.id`,
    [userId, primaryConceptId],
  );
  const actualState = replaySkillState(
    evidenceRows.rows.map((row) => ({
      correct: row.correct,
      deviceEventAt: row.device_event_at,
      evidenceWeight: Number(row.effective_quality),
      hintLevel: row.hint_level,
      id: row.id,
      offlineSequence: Number(row.offline_sequence),
      pinyinSupport: 'none',
    })),
    'audio_to_glyph',
  );
  assert.deepEqual(
    actualState,
    expectedState,
    'Normalized Evidence replay must preserve legacy mastery and review scheduling exactly',
  );
  const countBeforeReplay = await client
    .query<{ count: string }>(`select count(*)::text as count from public.attempt_evidence`)
    .then((result) => Number(result.rows[0]?.count ?? -1));
  assert.equal(countBeforeReplay, 4, 'Two legacy multi-target Attempts must backfill four rows');

  const startMarker = '-- attempt-evidence-backfill:start';
  const endMarker = '-- attempt-evidence-backfill:end';
  const start = migrationSql.indexOf(startMarker);
  const end = migrationSql.indexOf(endMarker);
  assert.ok(start >= 0 && end > start, 'The migration must expose the auditable backfill section');
  await client.query(migrationSql.slice(start + startMarker.length, end));
  const countAfterReplay = await client
    .query<{ count: string }>(`select count(*)::text as count from public.attempt_evidence`)
    .then((result) => Number(result.rows[0]?.count ?? -1));
  assert.equal(countAfterReplay, countBeforeReplay, 'The historical backfill must be idempotent');

  console.log(
    'Attempts V2 backfill passed: legacy multi-target Evidence is idempotent and mastery/review replay is exactly equivalent.',
  );
} finally {
  client.release();
  await pool.end();
}
