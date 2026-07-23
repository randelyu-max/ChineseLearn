import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

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
const attemptB = randomUUID();
const conceptB = randomUUID();
const signatureB = randomUUID();

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
    `insert into public.learning_sessions (
       id, user_id, curriculum_version_id, target_minutes, plan_version, plan
     ) values ($1, $2, $3, 10, 'test-v1', '{}')`,
    [sessionB, userB, curriculumVersion],
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
  assert.equal(await count(client, 'profiles'), 1, 'User A must read their profile');
  for (const table of [
    'learning_sessions',
    'attempts',
    'skill_states',
    'review_schedule',
    'signature_projects',
    'signature_practice_summaries',
    'reward_balances',
  ]) {
    assert.equal(await count(client, table), 0, `User A must not read User B ${table}`);
  }

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
    'PostgreSQL isolation test passed: own access allowed; cross-user, anonymous, and forged ownership denied.',
  );
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
