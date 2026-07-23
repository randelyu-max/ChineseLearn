import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AttemptsBatchRequestSchema } from '@hanziquest/contracts';
import { Pool, type PoolClient } from 'pg';

import {
  buildAuthoritativeSessionPlan,
  loadAuthoritativePlanningState,
} from '../session-plan-service.js';
import { processAttemptsBatch } from '../attempts-batch-service.js';
import { withUserTransaction } from './pool.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

async function count(client: PoolClient, table: string): Promise<number> {
  const allowed = new Set([
    'attempts',
    'learning_sessions',
    'profiles',
    'review_schedule',
    'reward_balances',
    'signature_practice_summaries',
    'signature_projects',
    'skill_states',
  ]);
  if (!allowed.has(table)) throw new Error(`Unsupported test table: ${table}`);
  const result = await client.query<{ count: string }>(`select count(*) from public.${table}`);
  return Number(result.rows[0]?.count ?? -1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
const client = await pool.connect();
let clientReleased = false;
const userA = randomUUID();
const userB = randomUUID();
const curriculumVersion = randomUUID();
const sessionB = randomUUID();
const clientSessionB = randomUUID();
const clientSessionA = randomUUID();
const attemptB = randomUUID();
const conceptB = randomUUID();
const signatureB = randomUUID();
const world = randomUUID();
const unit = randomUUID();
const lesson = randomUUID();
const activity = randomUUID();
const correctOption = randomUUID();
const wrongOption = randomUUID();
const audioAsset = randomUUID();
const cascadeUser = randomUUID();

try {
  await client.query('begin');
  await client.query(
    `insert into public."user" (id, name, email, "emailVerified")
     values ($1, 'User A', $2, true), ($3, 'User B', $4, true)`,
    [userA, `${userA}@example.test`, userB, `${userB}@example.test`],
  );
  await client.query(
    `insert into public.profiles (id, display_name)
     values ($1, 'User A'), ($2, 'User B')`,
    [userA, userB],
  );
  await client.query(
    `insert into public.curriculum_versions (id, version, script_track)
     values ($1, $2, 'simplified')`,
    [curriculumVersion, `rls-${curriculumVersion}`],
  );
  await client.query(
    `update public.curriculum_versions
     set status = 'published', published_at = now()
     where id = $1`,
    [curriculumVersion],
  );
  await client.query(
    `insert into public.worlds (
       id, curriculum_version_id, slug, sort_order, title_zh, title_en, is_published
     ) values ($1, $2, 'test-world', 0, '测试世界', 'Test world', true)`,
    [world, curriculumVersion],
  );
  await client.query(
    `insert into public.units (
       id, world_id, slug, sort_order, title_zh, title_en, is_published
     ) values ($1, $2, 'test-unit', 0, '测试单元', 'Test unit', true)`,
    [unit, world],
  );
  await client.query(
    `insert into public.lessons (
       id, unit_id, slug, sort_order, title_zh, content_spec, is_published
     ) values ($1, $2, 'test-lesson', 0, '测试课程', $3, true)`,
    [
      lesson,
      unit,
      {
        exercises: [
          {
            activityId: activity,
            type: 'audio_to_glyph',
            promptAudioAssetId: audioAsset,
            targetConceptIds: [conceptB],
            options: [
              { optionId: correctOption, glyph: '家', accessibilityLabel: '家' },
              { optionId: wrongOption, glyph: '门', accessibilityLabel: '门' },
            ],
            correctOptionId: correctOption,
            visualHintZh: '想想家的声音。',
          },
        ],
      },
    ],
  );
  await client.query(
    `insert into public.lesson_concepts (
       lesson_id, concept_type, concept_id, role, sort_order
     ) values ($1, 'character', $2, 'target', 0)`,
    [lesson, conceptB],
  );
  await client.query(
    `insert into public.learning_sessions (
       id, user_id, client_session_id, idempotency_key, curriculum_version_id,
       target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 10, 'test-v1', '{}')`,
    [sessionB, userB, clientSessionB, `session-plan:${clientSessionB}`, curriculumVersion],
  );
  await client.query(
    `insert into public.attempts (
       id, offline_event_id, session_id, user_id, concept_type, concept_id, skill,
       activity_type, correct, device_event_at, evidence_weight
     ) values ($1, $1, $2, $3, 'character', $4, 'audio_to_glyph',
       'test', true, now(), 1)`,
    [attemptB, sessionB, userB, conceptB],
  );
  await client.query(
    `insert into public.skill_states (user_id, concept_type, concept_id, skill)
     values ($1, 'character', $2, 'audio_to_glyph')`,
    [userB, conceptB],
  );
  await client.query(
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version
     ) values ($1, 'character', $2, 'audio_to_glyph', now(), 'test', 1, 'test-v1')`,
    [userB, conceptB],
  );
  await client.query(
    `insert into public.signature_projects (id, user_id, chinese_name)
     values ($1, $2, '测试')`,
    [signatureB, userB],
  );
  await client.query(
    `insert into public.signature_practice_summaries (
       user_id, signature_project_id, practice_count
     ) values ($1, $2, 1)`,
    [userB, signatureB],
  );
  await client.query(`insert into public.reward_balances (user_id) values ($1)`, [userB]);

  await client.query('savepoint owner_plan_mutation');
  let databasePlanMutationRejected = false;
  try {
    await client.query(
      `update public.learning_sessions
       set plan = '{"changed":true}'
       where id = $1`,
      [sessionB],
    );
  } catch {
    databasePlanMutationRejected = true;
  }
  await client.query('rollback to savepoint owner_plan_mutation');
  assert.equal(
    databasePlanMutationRejected,
    true,
    'Database trigger must reject plan snapshot mutation even for a privileged writer',
  );

  await client.query('savepoint owner_attempt_mutation');
  let databaseAttemptMutationRejected = false;
  try {
    await client.query(`update public.attempts set correct = false where id = $1`, [attemptB]);
  } catch {
    databaseAttemptMutationRejected = true;
  }
  await client.query('rollback to savepoint owner_attempt_mutation');
  assert.equal(
    databaseAttemptMutationRejected,
    true,
    'Database trigger must reject immutable attempt updates',
  );

  const cascadeSession = randomUUID();
  const cascadeEvent = randomUUID();
  await client.query(
    `insert into public."user" (id, name, email, "emailVerified")
     values ($1, 'Cascade User', $2, true)`,
    [cascadeUser, `${cascadeUser}@example.test`],
  );
  await client.query(`insert into public.profiles (id) values ($1)`, [cascadeUser]);
  await client.query(
    `insert into public.learning_sessions (
       id, user_id, client_session_id, idempotency_key, curriculum_version_id,
       target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 10, 'test-v1', '{}')`,
    [
      cascadeSession,
      cascadeUser,
      cascadeSession,
      `session-plan:${cascadeSession}`,
      curriculumVersion,
    ],
  );
  await client.query(
    `insert into public.attempts (
       offline_event_id, session_id, user_id, concept_type, concept_id, skill,
       activity_type, correct, device_event_at, evidence_weight
     ) values ($1, $2, $3, 'character', $4, 'audio_to_glyph',
       'test', true, now(), 1)`,
    [cascadeEvent, cascadeSession, cascadeUser, conceptB],
  );
  await client.query(`delete from public."user" where id = $1`, [cascadeUser]);
  const cascadedAttempt = await client.query(
    `select id from public.attempts where offline_event_id = $1`,
    [cascadeEvent],
  );
  assert.equal(cascadedAttempt.rowCount, 0, 'Account deletion must cascade immutable attempts');

  await client.query('set local role hanziquest_app');
  await client.query(`select set_config('app.current_user_id', $1, true)`, [userA]);

  const ownProfileUpsert = await client.query<{ display_name: string }>(
    `insert into public.profiles (
       id, display_name, chinese_name, interface_locale, script_preference,
       pinyin_support_mode, humor_preference, daily_goal_minutes
     ) values ($1, 'User A updated', '王安家', 'zh-CN', 'simplified', 'adaptive', 'light', 10)
     on conflict (id) do update set
       display_name = excluded.display_name,
       chinese_name = excluded.chinese_name,
       interface_locale = excluded.interface_locale,
       script_preference = excluded.script_preference,
       pinyin_support_mode = excluded.pinyin_support_mode,
       humor_preference = excluded.humor_preference,
       daily_goal_minutes = excluded.daily_goal_minutes
     returning display_name`,
    [userA],
  );
  assert.equal(
    ownProfileUpsert.rows[0]?.display_name,
    'User A updated',
    'User A must create or update their profile through the permitted columns',
  );
  const planningState = await loadAuthoritativePlanningState(client, userA, new Date());
  assert.ok(planningState, 'Published curriculum must provide authoritative planning state');
  const plan = buildAuthoritativeSessionPlan(
    {
      schemaVersion: 'session-plan-request-v1',
      clientSessionId: clientSessionA,
      idempotencyKey: `session-plan:${clientSessionA}`,
      targetMinutes: 10,
    },
    planningState,
  );
  const ownSessionInsert = await client.query<{ id: string }>(
    `insert into public.learning_sessions (
       user_id, client_session_id, idempotency_key, curriculum_version_id, lesson_id,
       target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 10, 'pinyin-session-planner-v1', $6)
     on conflict do nothing
     returning id`,
    [userA, clientSessionA, `session-plan:${clientSessionA}`, curriculumVersion, lesson, plan],
  );
  const ownSessionId = ownSessionInsert.rows[0]?.id;
  assert.ok(ownSessionId, 'User A must insert their own immutable session plan');
  assert.equal(
    await count(client, 'learning_sessions'),
    1,
    'User A must read only their own session',
  );

  const offlineEvent = randomUUID();
  const attemptsRequest = AttemptsBatchRequestSchema.parse({
    schemaVersion: 'attempts-batch-request-v1',
    sessionId: ownSessionId,
    idempotencyKey: `attempts-batch:${offlineEvent}`,
    attempts: [
      {
        attemptId: offlineEvent,
        activityId: activity,
        answer: { optionId: wrongOption },
        isCorrectClient: true,
        responseMs: 1_200,
        hintLevel: 'none',
        replayCount: 0,
        retryCount: 0,
        occurredAt: new Date().toISOString(),
        offlineSequence: 1,
      },
    ],
  });
  const firstBatch = await processAttemptsBatch(client, userA, attemptsRequest);
  assert.equal(firstBatch?.results[0]?.status, 'accepted');
  assert.equal(
    firstBatch?.results[0]?.isCorrect,
    false,
    'Server must ignore forged client correctness',
  );
  const duplicateBatch = await processAttemptsBatch(client, userA, attemptsRequest);
  assert.equal(duplicateBatch?.results[0]?.status, 'duplicate');
  assert.equal(await count(client, 'attempts'), 1, 'Duplicate event must be stored once');
  assert.equal(await count(client, 'skill_states'), 1, 'Duplicate event must update skill once');
  assert.equal(await count(client, 'review_schedule'), 1, 'Duplicate event must schedule once');
  const firstAttempt = attemptsRequest.attempts[0]!;
  assert.equal(
    await processAttemptsBatch(client, userA, {
      ...attemptsRequest,
      attempts: [
        {
          ...firstAttempt,
          attemptId: randomUUID(),
          activityId: randomUUID(),
        },
      ],
    }).then((result) => result?.results[0]?.rejectionCode),
    'ACTIVITY_NOT_FOUND',
  );
  assert.equal(
    await processAttemptsBatch(client, userA, {
      ...attemptsRequest,
      sessionId: sessionB,
    }),
    null,
    'RLS must hide another user session from attempt processing',
  );

  await client.query('savepoint duplicate_session');
  let duplicateSessionRejected = false;
  try {
    await client.query(
      `insert into public.learning_sessions (
         user_id, client_session_id, idempotency_key, curriculum_version_id,
         target_minutes, plan_version, plan
       ) values ($1, $2, $3, $4, 10, 'session-planner-v2', '{}')`,
      [userA, clientSessionA, `different-retry:${clientSessionA}`, curriculumVersion],
    );
  } catch {
    duplicateSessionRejected = true;
  }
  await client.query('rollback to savepoint duplicate_session');
  assert.equal(duplicateSessionRejected, true, 'Duplicate client session IDs must be rejected');

  await client.query('savepoint duplicate_idempotency');
  let duplicateIdempotencyRejected = false;
  try {
    await client.query(
      `insert into public.learning_sessions (
         user_id, client_session_id, idempotency_key, curriculum_version_id,
         target_minutes, plan_version, plan
       ) values ($1, $2, $3, $4, 10, 'session-planner-v2', '{}')`,
      [userA, randomUUID(), `session-plan:${clientSessionA}`, curriculumVersion],
    );
  } catch {
    duplicateIdempotencyRejected = true;
  }
  await client.query('rollback to savepoint duplicate_idempotency');
  assert.equal(duplicateIdempotencyRejected, true, 'Duplicate idempotency keys must be rejected');

  await client.query('savepoint mutate_plan');
  let planMutationRejected = false;
  try {
    await client.query(`update public.learning_sessions set plan = '{}' where id = $1`, [
      ownSessionId,
    ]);
  } catch {
    planMutationRejected = true;
  }
  await client.query('rollback to savepoint mutate_plan');
  assert.equal(planMutationRejected, true, 'Application role must not mutate plan snapshots');

  await client.query('savepoint forged_session_owner');
  let forgedSessionOwnerRejected = false;
  try {
    await client.query(
      `insert into public.learning_sessions (
         user_id, client_session_id, idempotency_key, curriculum_version_id,
         target_minutes, plan_version, plan
       ) values ($1, $2, $3, $4, 10, 'session-planner-v2', '{}')`,
      [userB, randomUUID(), `forged-session:${randomUUID()}`, curriculumVersion],
    );
  } catch {
    forgedSessionOwnerRejected = true;
  }
  await client.query('rollback to savepoint forged_session_owner');
  assert.equal(forgedSessionOwnerRejected, true, 'Forged session ownership must be rejected');

  assert.equal(await count(client, 'profiles'), 1, 'User A must read their profile');
  for (const table of ['signature_projects', 'signature_practice_summaries', 'reward_balances']) {
    assert.equal(await count(client, table), 0, `User A must not read User B ${table}`);
  }
  for (const table of ['attempts', 'skill_states', 'review_schedule']) {
    const rows = await client.query(`select user_id from public.${table} where user_id = $1`, [
      userB,
    ]);
    assert.equal(rows.rowCount, 0, `User A must not read User B ${table}`);
  }
  const userBSessionRows = await client.query(
    `select id from public.learning_sessions where user_id = $1`,
    [userB],
  );
  assert.equal(userBSessionRows.rowCount, 0, 'User A must not read User B learning session');

  const otherUpdate = await client.query(
    `update public.profiles set display_name = 'forged' where id = $1`,
    [userB],
  );
  assert.equal(otherUpdate.rowCount, 0, 'User A must not update User B profile');

  await client.query('savepoint forged_owner');
  let forgedOwnershipRejected = false;
  try {
    await client.query(
      `insert into public.profiles (id, display_name) values ($1, 'forged profile')`,
      [userB],
    );
  } catch {
    forgedOwnershipRejected = true;
  }
  await client.query('rollback to savepoint forged_owner');
  assert.equal(forgedOwnershipRejected, true, 'Forged profile ownership must be rejected');

  await client.query(`select set_config('app.current_user_id', '', true)`);
  assert.equal(
    await count(client, 'profiles'),
    0,
    'Unauthenticated access must return no profiles',
  );
  assert.equal(
    await count(client, 'learning_sessions'),
    0,
    'Unauthenticated access must return no sessions',
  );

  await client.query('commit');
  client.release();
  clientReleased = true;

  const concurrentEvent = randomUUID();
  const concurrentRequest = AttemptsBatchRequestSchema.parse({
    ...attemptsRequest,
    idempotencyKey: `attempts-batch:${concurrentEvent}`,
    attempts: [
      {
        ...firstAttempt,
        attemptId: concurrentEvent,
        answer: { optionId: correctOption },
        occurredAt: new Date(Date.now() + 1_000).toISOString(),
        offlineSequence: 2,
      },
    ],
  });
  const concurrentResults = await Promise.all([
    withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatch(transaction, userA, concurrentRequest),
    ),
    withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatch(transaction, userA, concurrentRequest),
    ),
  ]);
  assert.deepEqual(
    concurrentResults.map((result) => result?.results[0]?.status).sort(),
    ['accepted', 'duplicate'],
    'Concurrent delivery must accept one event and deduplicate the other',
  );
  const concurrentState = await pool.query<{ exposure_count: number }>(
    `select exposure_count
     from public.skill_states
     where user_id = $1 and concept_id = $2 and skill = 'audio_to_glyph'`,
    [userA, conceptB],
  );
  assert.equal(
    concurrentState.rows[0]?.exposure_count,
    2,
    'Concurrent duplicate must change skill state at most once',
  );

  await pool.query(`delete from public."user" where id = any($1::uuid[])`, [[userA, userB]]);
  await pool.query(`delete from public.curriculum_versions where id = $1`, [curriculumVersion]);
  console.log(
    'PostgreSQL integration passed: planning, authoritative attempts, concurrency, idempotency, immutability, cascade deletion, and cross-user denial verified.',
  );
} catch (error) {
  if (!clientReleased) await client.query('rollback').catch(() => undefined);
  await pool
    .query(`delete from public."user" where id = any($1::uuid[])`, [[userA, userB]])
    .catch(() => undefined);
  await pool
    .query(`delete from public.curriculum_versions where id = $1`, [curriculumVersion])
    .catch(() => undefined);
  throw error;
} finally {
  if (!clientReleased) client.release();
  await pool.end();
}
