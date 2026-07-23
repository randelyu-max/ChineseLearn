import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

import {
  buildAuthoritativeSessionPlan,
  loadAuthoritativePlanningState,
} from '../session-plan-service.js';

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

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
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
       id, unit_id, slug, sort_order, title_zh, is_published
     ) values ($1, $2, 'test-lesson', 0, '测试课程', true)`,
    [lesson, unit],
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
       user_id, client_session_id, idempotency_key, curriculum_version_id,
       target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, 10, 'pinyin-session-planner-v1', $5)
     on conflict do nothing
     returning id`,
    [userA, clientSessionA, `session-plan:${clientSessionA}`, curriculumVersion, plan],
  );
  const ownSessionId = ownSessionInsert.rows[0]?.id;
  assert.ok(ownSessionId, 'User A must insert their own immutable session plan');
  assert.equal(
    await count(client, 'learning_sessions'),
    1,
    'User A must read only their own session',
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
  for (const table of [
    'attempts',
    'skill_states',
    'review_schedule',
    'signature_projects',
    'signature_practice_summaries',
    'reward_balances',
  ]) {
    assert.equal(await count(client, table), 0, `User A must not read User B ${table}`);
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

  await client.query('rollback');
  console.log(
    'PostgreSQL session-plan test passed: authoritative planning, idempotency, immutability, own access, and cross-user denial verified.',
  );
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
