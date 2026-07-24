import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  AttemptsBatchRequestSchema,
  AttemptsBatchRequestV2Schema,
  SessionPlanRequestV2Schema,
  SignaturePracticeMetricEventSchema,
  SignatureProjectInputSchema,
} from '@hanziquest/contracts';
import { Pool, type PoolClient } from 'pg';

import {
  buildAuthoritativeSessionPlan,
  loadAuthoritativePlanningState,
} from '../session-plan-service.js';
import {
  buildMaterializedSessionPlanV2,
  createOrReplaySessionPlanV2,
  loadAuthoritativePlanningStateV2,
  SessionPlanV2ServiceError,
} from '../session-plan-v2-service.js';
import { processAttemptsBatch } from '../attempts-batch-service.js';
import {
  AttemptsBatchV2ServiceError,
  processAttemptsBatchV2,
} from '../attempts-batch-v2-service.js';
import { loadReviewCenter, resolveReviewCenterPagination } from '../review-center-service.js';
import {
  loadActiveSession,
  SessionLifecycleServiceError,
  transitionSession,
} from '../session-lifecycle-service.js';
import { recordSignaturePractice, upsertSignatureProject } from '../signature-practice-service.js';
import { withUserTransaction } from './pool.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

async function count(client: PoolClient, table: string): Promise<number> {
  const allowed = new Set([
    'attempts',
    'attempt_batch_v2_events',
    'attempt_evidence',
    'confusion_stats',
    'learning_session_activities',
    'learning_session_lifecycle_events',
    'learning_session_plan_v2_events',
    'learning_sessions',
    'profiles',
    'review_schedule',
    'reward_balances',
    'signature_practice_summaries',
    'signature_practice_events',
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
const sessionActivityB = randomUUID();
const clientSessionB = randomUUID();
const clientSessionA = randomUUID();
const attemptB = randomUUID();
const conceptB = randomUUID();
const confusionConcept = randomUUID();
const safeConcept = randomUUID();
const unpublishedConcept = randomUUID();
const confusionPair = randomUUID();
const signatureB = randomUUID();
const signatureEventB = randomUUID();
const signatureA = randomUUID();
const signatureEventA = randomUUID();
const world = randomUUID();
const unit = randomUUID();
const lesson = randomUUID();
const lessonTwo = randomUUID();
const activity = randomUUID();
const activityTwo = randomUUID();
const correctOption = randomUUID();
const wrongOption = randomUUID();
const audioAsset = randomUUID();
const imageOptionCorrect = randomUUID();
const imageOptionWrong = randomUUID();
const imageAssetCorrect = randomUUID();
const imageAssetWrong = randomUUID();
const pinyinToneConcept = randomUUID();
const pinyinToneActivity = randomUUID();
const pinyinToneCorrectOption = randomUUID();
const pinyinToneWrongOptions = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const cascadeUser = randomUUID();
const evidenceTargetsJson = JSON.stringify([
  {
    schemaVersion: 'evidence-target-v1',
    conceptType: 'character',
    conceptId: conceptB,
    skill: 'audio_to_glyph',
    abilityAxis: 'hanzi_recognition',
    role: 'primary',
  },
]);

async function removePublishedPinyinFixture(): Promise<void> {
  const cleanupClient = await pool.connect();
  try {
    await cleanupClient.query('begin');
    await cleanupClient.query(
      'alter table public.pinyin_concepts disable trigger pinyin_concepts_published_immutable',
    );
    await cleanupClient.query('delete from public.pinyin_concepts where id = $1', [
      pinyinToneConcept,
    ]);
    await cleanupClient.query(
      'alter table public.pinyin_concepts enable trigger pinyin_concepts_published_immutable',
    );
    await cleanupClient.query('commit');
  } catch (error) {
    await cleanupClient.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    cleanupClient.release();
  }
}

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
     set status = 'published', published_at = now(), manifest_sha256 = $2
     where id = $1`,
    [curriculumVersion, 'a'.repeat(64)],
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
     ) values
       ($1, $2, 'test-lesson', 0, '测试课程', $3, true),
       ($4, $2, 'test-lesson-two', 1, '测试课程二', $5, true)`,
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
              {
                optionId: correctOption,
                glyph: '家',
                accessibilityLabel: '家',
              },
              { optionId: wrongOption, glyph: '门', accessibilityLabel: '门' },
            ],
            correctOptionId: correctOption,
            visualHintZh: '想想家的声音。',
          },
        ],
      },
      lessonTwo,
      {
        exercises: [
          {
            activityId: activityTwo,
            type: 'glyph_to_image',
            promptGlyph: '水',
            promptAudioAssetId: audioAsset,
            targetConceptIds: [safeConcept],
            options: [
              {
                optionId: imageOptionCorrect,
                imageAssetId: imageAssetCorrect,
                accessibilityLabel: '土丘',
              },
              {
                optionId: imageOptionWrong,
                imageAssetId: imageAssetWrong,
                accessibilityLabel: '房子',
              },
            ],
            correctOptionId: imageOptionCorrect,
            visualHintZh: '看看这个字的形状。',
          },
          {
            schemaVersion: 'learning-exercise-v2',
            activityId: 'pinyin.gated.fixture',
            type: 'tone_choice',
          },
          {
            schemaVersion: 'pinyin-lesson-exercise-v1',
            minimumClientCapability: 'pinyin-exercises-v1',
            exercise: {
              schemaVersion: 'learning-exercise-v2',
              activityId: pinyinToneActivity,
              instructionZh: '\u8bf7\u9009\u51fa\u6b63\u786e\u7684\u58f0\u8c03\u3002',
              instructionAccessibilityLabel:
                '\u8bf7\u542c\u97f3\u9891\u5e76\u9009\u62e9\u6b63\u786e\u58f0\u8c03\u3002',
              type: 'tone_choice',
              promptAudioAssetKey: null,
              baseSyllable: 'ma',
              targetSyllable: 'ma5',
              contextZh: '\u4f60\u597d\u5417\uff1f',
              options: [
                {
                  optionId: pinyinToneWrongOptions[0],
                  tone: 1,
                  display: 'm\u0101',
                  accessibilityLabel: 'm\u0101\uff0c\u7b2c\u4e00\u58f0',
                },
                {
                  optionId: pinyinToneWrongOptions[1],
                  tone: 2,
                  display: 'm\u00e1',
                  accessibilityLabel: 'm\u00e1\uff0c\u7b2c\u4e8c\u58f0',
                },
                {
                  optionId: pinyinToneWrongOptions[2],
                  tone: 3,
                  display: 'm\u01ce',
                  accessibilityLabel: 'm\u01ce\uff0c\u7b2c\u4e09\u58f0',
                },
                {
                  optionId: pinyinToneWrongOptions[3],
                  tone: 4,
                  display: 'm\u00e0',
                  accessibilityLabel: 'm\u00e0\uff0c\u7b2c\u56db\u58f0',
                },
                {
                  optionId: pinyinToneCorrectOption,
                  tone: 5,
                  display: 'ma',
                  accessibilityLabel: 'ma\uff0c\u8f7b\u58f0',
                },
              ],
              correctOptionId: pinyinToneCorrectOption,
            },
            evidenceTargets: [
              {
                schemaVersion: 'evidence-target-v1',
                conceptType: 'pinyin',
                conceptId: pinyinToneConcept,
                skill: 'tone_choice',
                abilityAxis: 'tone_discrimination',
                role: 'primary',
              },
            ],
            pinyinSkillType: 'tone',
            pinyinSupportApplicable: false,
            estimatedSeconds: 45,
          },
        ],
      },
    ],
  );
  await client.query(
    `insert into public.characters (
       id, concept_code, simplified_glyph, traditional_glyph, pinyin_syllables, is_published
     ) values
       ($1, $2, '家', '家', array['jiā'], true),
       ($3, $4, '冢', '塚', array['zhǒng'], true),
       ($5, $6, '隐', '隱', array['yǐn'], false),
       ($7, $8, '水', '水', array['shuǐ'], true)`,
    [
      conceptB,
      `review-${conceptB}`,
      confusionConcept,
      `review-${confusionConcept}`,
      unpublishedConcept,
      `review-${unpublishedConcept}`,
      safeConcept,
      `review-${safeConcept}`,
    ],
  );
  await client.query(
    `insert into public.pinyin_concepts (
       id, curriculum_version_id, concept_code, kind, canonical_value, display_value,
       tone_number, content_status, is_published
     ) values ($1, $2, 'pinyin.tone.neutral', 'tone', '5', '\u8f7b\u58f0',
       5, 'published', true)`,
    [pinyinToneConcept, curriculumVersion],
  );
  await client.query(
    `insert into public.lesson_concepts (
       lesson_id, concept_type, concept_id, role, sort_order
     ) values
       ($1, 'character', $2, 'target', 0),
       ($1, 'character', $3, 'review', 1),
       ($1, 'character', $4, 'optional', 2),
       ($5, 'character', $6, 'target', 0),
       ($5, 'pinyin', $7, 'target', 1)`,
    [
      lesson,
      conceptB,
      confusionConcept,
      unpublishedConcept,
      lessonTwo,
      safeConcept,
      pinyinToneConcept,
    ],
  );
  await client.query(
    `insert into public.confusable_pairs (
       id, left_character_id, right_character_id, reason_code, is_published
     ) values ($1, $2, $3, 'similar_shape', true)`,
    [confusionPair, conceptB, confusionConcept],
  );
  await client.query(
    `insert into public.confusion_stats (
       user_id, pair_id, left_shown_count, right_shown_count,
       left_as_right_count, right_as_left_count, risk, next_practice_at
     ) values
       ($1, $3, 4, 4, 2, 1, 0.75, '2020-01-01T00:00:00.000Z'),
       ($2, $3, 4, 4, 1, 1, 0.50, '2099-01-01T00:00:00.000Z')`,
    [userA, userB, confusionPair],
  );
  await client.query(
    `insert into public.learning_sessions (
       id, user_id, client_session_id, idempotency_key, curriculum_version_id,
       target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 10, 'test-v1', '{}')`,
    [sessionB, userB, clientSessionB, `session-plan:${clientSessionB}`, curriculumVersion],
  );
  await client.query(
    `insert into public.learning_session_activities (
       id, session_id, user_id, position, source_exercise_id,
       exercise_type, content_ref, content_version, content_sha256,
       exercise_snapshot, evidence_targets, estimated_seconds
     ) values (
       $1, $2, $3, 0, 'exercise.audio-to-glyph.1',
       'audio_to_glyph', 'lesson.test.activity.1', '1.0.0', $4, $5, $6, 60
     )`,
    [
      sessionActivityB,
      sessionB,
      userB,
      'a'.repeat(64),
      {
        schemaVersion: 'learning-exercise-v2',
        activityId: 'exercise.audio-to-glyph.1',
        type: 'audio_to_glyph',
      },
      evidenceTargetsJson,
    ],
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
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version
     ) values (
       $1, 'character', $2, 'audio_to_glyph',
       '2020-01-01T00:00:00.000Z', 'test-unpublished', 1, 'test-v1'
     )`,
    [userA, unpublishedConcept],
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
  await client.query(
    `insert into public.signature_practice_events (
       id, user_id, signature_project_id, idempotency_key, algorithm_version, occurred_at
     ) values ($1, $2, $3, $4, 'signature-consistency-v1', now())`,
    [signatureEventB, userB, signatureB, `signature-practice:${signatureEventB}`],
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

  await client.query('savepoint owner_activity_mutation');
  let databaseActivityMutationRejected = false;
  try {
    await client.query(
      `update public.learning_session_activities
       set estimated_seconds = 61
       where id = $1`,
      [sessionActivityB],
    );
  } catch {
    databaseActivityMutationRejected = true;
  }
  await client.query('rollback to savepoint owner_activity_mutation');
  assert.equal(
    databaseActivityMutationRejected,
    true,
    'Database trigger must reject activity snapshot mutation even for a privileged writer',
  );

  await client.query('savepoint mismatched_activity_owner');
  let mismatchedActivityOwnerRejected = false;
  try {
    await client.query(
      `insert into public.learning_session_activities (
         session_id, user_id, position, source_exercise_id, exercise_type,
         content_ref, content_version, content_sha256, exercise_snapshot,
         evidence_targets, estimated_seconds
       ) values (
         $1, $2, 1, 'exercise.mismatch', 'audio_to_glyph',
         'lesson.test.activity.mismatch', '1.0.0', $3, $4, $5, 60
       )`,
      [
        sessionB,
        userA,
        'b'.repeat(64),
        {
          schemaVersion: 'learning-exercise-v2',
          activityId: 'exercise.mismatch',
          type: 'audio_to_glyph',
        },
        evidenceTargetsJson,
      ],
    );
  } catch {
    mismatchedActivityOwnerRejected = true;
  }
  await client.query('rollback to savepoint mismatched_activity_owner');
  assert.equal(
    mismatchedActivityOwnerRejected,
    true,
    'Composite ownership must reject a session activity for a different user',
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
  await client.query(
    `insert into public.learning_session_activities (
       session_id, user_id, position, source_exercise_id, exercise_type,
       content_ref, content_version, content_sha256, exercise_snapshot,
       evidence_targets, estimated_seconds
     ) values (
       $1, $2, 0, 'exercise.cascade', 'audio_to_glyph',
       'lesson.test.activity.cascade', '1.0.0', $3, $4, $5, 60
     )`,
    [
      cascadeSession,
      cascadeUser,
      'c'.repeat(64),
      {
        schemaVersion: 'learning-exercise-v2',
        activityId: 'exercise.cascade',
        type: 'audio_to_glyph',
      },
      evidenceTargetsJson,
    ],
  );
  await client.query(`delete from public."user" where id = $1`, [cascadeUser]);
  const cascadedAttempt = await client.query(
    `select id from public.attempts where offline_event_id = $1`,
    [cascadeEvent],
  );
  assert.equal(cascadedAttempt.rowCount, 0, 'Account deletion must cascade immutable attempts');
  const cascadedActivity = await client.query(
    `select id
     from public.learning_session_activities
     where session_id = $1`,
    [cascadeSession],
  );
  assert.equal(
    cascadedActivity.rowCount,
    0,
    'Account deletion must cascade immutable session activities',
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

  await client.query('reset role');
  const sessionActivityA = randomUUID();
  await client.query(
    `insert into public.learning_session_activities (
       id, session_id, user_id, position, source_exercise_id,
       exercise_type, content_ref, content_version, content_sha256,
       exercise_snapshot, evidence_targets, estimated_seconds
     ) values (
       $1, $2, $3, 0, $7, 'audio_to_glyph',
       'lesson.test.activity.user-a', '1.0.0', $4, $5, $6, 60
     )`,
    [
      sessionActivityA,
      ownSessionId,
      userA,
      'd'.repeat(64),
      {
        schemaVersion: 'learning-exercise-v2',
        activityId: activity,
        type: 'audio_to_glyph',
        instructionZh: '听音选择汉字。',
        instructionAccessibilityLabel: '听一段音频，然后选择正确的汉字。',
        promptAudioAssetKey: 'audio.jia.v1',
        options: [
          {
            optionId: correctOption,
            glyph: '家',
            accessibilityLabel: '家，家庭的家',
          },
          {
            optionId: wrongOption,
            glyph: '门',
            accessibilityLabel: '门，大门的门',
          },
        ],
        correctOptionId: correctOption,
        visualHintZh: '想一想家的声音。',
      },
      evidenceTargetsJson,
      activity,
    ],
  );
  await client.query('set local role hanziquest_app');
  await client.query(`select set_config('app.current_user_id', $1, true)`, [userA]);
  assert.equal(
    await count(client, 'learning_session_activities'),
    1,
    'User A must read only their own session activity snapshot',
  );
  const activeBeforeStart = await loadActiveSession(client, userA);
  assert.equal(activeBeforeStart.availability, 'active');
  assert.equal(
    activeBeforeStart.availability === 'active' ? activeBeforeStart.session.header.sessionId : null,
    ownSessionId,
    'Active Session recovery must return the current user Session and snapshot',
  );
  assert.equal(
    (await loadActiveSession(client, userB)).availability,
    'none',
    'RLS must hide User B active Session from a User A transaction',
  );

  const startRequest = {
    schemaVersion: 'session-lifecycle-request-v1',
    idempotencyKey: `session-start:${ownSessionId}`,
  } as const;
  const beforeStart = Date.now();
  const startedSession = await transitionSession(
    client,
    userA,
    ownSessionId,
    'start',
    startRequest,
  );
  const afterStart = Date.now();
  assert.equal(startedSession.status, 'in_progress');
  assert.ok(startedSession.startedAt, 'Starting a Session must record a server timestamp');
  assert.ok(
    Date.parse(startedSession.startedAt) >= beforeStart - 1_000 &&
      Date.parse(startedSession.startedAt) <= afterStart + 1_000,
    'Session start time must come from the database server during the request',
  );
  assert.deepEqual(
    await transitionSession(client, userA, ownSessionId, 'start', startRequest),
    startedSession,
    'A start retry must replay the exact original result',
  );
  let incompleteCompletionRejected = false;
  try {
    await transitionSession(client, userA, ownSessionId, 'complete', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `session-complete-early:${ownSessionId}`,
    });
  } catch (error) {
    incompleteCompletionRejected =
      error instanceof SessionLifecycleServiceError && error.code === 'SESSION_ACTIVITY_INCOMPLETE';
  }
  assert.equal(
    incompleteCompletionRejected,
    true,
    'A Session cannot complete before every activity has an accepted Attempt',
  );

  const ownSignature = await upsertSignatureProject(
    client,
    userA,
    SignatureProjectInputSchema.parse({
      schemaVersion: 'signature-project-request-v1',
      chineseName: '王安家',
      projectId: signatureA,
      selectedStyle: 'flowing',
    }),
  );
  assert.equal(ownSignature?.practiceCount, 0, 'A new own-name project starts with no practice');
  const baselineEvent = SignaturePracticeMetricEventSchema.parse({
    schemaVersion: 'signature-practice-request-v1',
    algorithmVersion: 'signature-consistency-v1',
    eventId: signatureEventA,
    idempotencyKey: `signature-practice:${signatureEventA}`,
    metrics: null,
    occurredAt: new Date().toISOString(),
    projectId: signatureA,
  });
  const baselineResult = await recordSignaturePractice(client, userA, baselineEvent);
  assert.equal(baselineResult.status, 'accepted');
  assert.equal(
    baselineResult.status === 'accepted' ? baselineResult.summary.practiceCount : -1,
    1,
    'Server trigger must count a raw-free baseline event',
  );
  assert.deepEqual(
    baselineResult.status === 'accepted' ? baselineResult.summary.scores : null,
    { direction: null, proportion: null, rhythm: null, structure: null },
    'A baseline event must not invent consistency scores',
  );
  const duplicateSignature = await recordSignaturePractice(client, userA, baselineEvent);
  assert.equal(duplicateSignature.status, 'duplicate');
  const comparedEvent = SignaturePracticeMetricEventSchema.parse({
    ...baselineEvent,
    eventId: randomUUID(),
    idempotencyKey: `signature-practice:${randomUUID()}`,
    metrics: {
      direction: 0.81234,
      proportion: 0.72345,
      rhythm: 0.63456,
      structure: 0.94567,
    },
  });
  const comparedResult = await recordSignaturePractice(client, userA, comparedEvent);
  assert.equal(comparedResult.status, 'accepted');
  assert.equal(
    comparedResult.status === 'accepted' ? comparedResult.summary.practiceCount : -1,
    2,
    'A second immutable event must increment the server count once',
  );
  assert.deepEqual(
    comparedResult.status === 'accepted' ? comparedResult.summary.scores : null,
    {
      direction: 0.8123,
      proportion: 0.7235,
      rhythm: 0.6346,
      structure: 0.9457,
    },
    'Null baseline metrics must not dilute the canonical four-decimal consistency average',
  );
  assert.equal(
    (await recordSignaturePractice(client, userA, comparedEvent)).status,
    'duplicate',
    'A metric event with more than four input decimals must still replay idempotently',
  );
  assert.equal(
    (
      await recordSignaturePractice(client, userA, {
        ...baselineEvent,
        metrics: { direction: 0, proportion: 0, rhythm: 0, structure: 0 },
      })
    ).status,
    'conflict',
    'An idempotency key cannot be replayed with different metadata',
  );
  assert.equal(
    (
      await recordSignaturePractice(client, userA, {
        ...baselineEvent,
        projectId: signatureB,
      })
    ).status,
    'project_not_found',
    'RLS must hide another user signature project from the service',
  );
  assert.equal(
    await count(client, 'signature_practice_events'),
    2,
    'User A must see only their two immutable metadata events',
  );
  await client.query('savepoint forged_signature_event_owner');
  let forgedSignatureEventOwnerRejected = false;
  try {
    const forgedEvent = randomUUID();
    await client.query(
      `insert into public.signature_practice_events (
         id, user_id, signature_project_id, idempotency_key, algorithm_version, occurred_at
       ) values ($1, $2, $3, $4, 'signature-consistency-v1', now())`,
      [forgedEvent, userB, signatureB, `signature-practice:${forgedEvent}`],
    );
  } catch {
    forgedSignatureEventOwnerRejected = true;
  }
  await client.query('rollback to savepoint forged_signature_event_owner');
  assert.equal(
    forgedSignatureEventOwnerRejected,
    true,
    'RLS must reject a forged user_id on signature metadata insert',
  );
  await client.query('savepoint direct_summary_mutation');
  let summaryMutationRejected = false;
  try {
    await client.query(
      `update public.signature_practice_summaries
       set practice_count = 999
       where user_id = $1 and signature_project_id = $2`,
      [userA, signatureA],
    );
  } catch {
    summaryMutationRejected = true;
  }
  await client.query('rollback to savepoint direct_summary_mutation');
  assert.equal(
    summaryMutationRejected,
    true,
    'The application role must not directly modify server-authoritative summaries',
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
  assert.equal(
    await count(client, 'review_schedule'),
    2,
    'Duplicate event must schedule once alongside the unpublished-content fixture',
  );
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

  await client.query('savepoint forged_activity_owner');
  let forgedActivityOwnerRejected = false;
  try {
    await client.query(
      `insert into public.learning_session_activities (
         session_id, user_id, position, source_exercise_id, exercise_type,
         content_ref, content_version, content_sha256, exercise_snapshot,
         evidence_targets, estimated_seconds
       ) values (
         $1, $2, 1, 'exercise.forged', 'audio_to_glyph',
         'lesson.test.activity.forged', '1.0.0', $3, $4, $5, 60
       )`,
      [
        ownSessionId,
        userB,
        'e'.repeat(64),
        {
          schemaVersion: 'learning-exercise-v2',
          activityId: 'exercise.forged',
          type: 'audio_to_glyph',
        },
        evidenceTargetsJson,
      ],
    );
  } catch {
    forgedActivityOwnerRejected = true;
  }
  await client.query('rollback to savepoint forged_activity_owner');
  assert.equal(
    forgedActivityOwnerRejected,
    true,
    'Application role must not insert or forge session activity snapshots',
  );

  await client.query('savepoint mutate_activity');
  let activityMutationRejected = false;
  try {
    await client.query(
      `update public.learning_session_activities
       set estimated_seconds = 61
       where id = $1`,
      [sessionActivityA],
    );
  } catch {
    activityMutationRejected = true;
  }
  await client.query('rollback to savepoint mutate_activity');
  assert.equal(
    activityMutationRejected,
    true,
    'Application role must not update immutable session activity snapshots',
  );

  assert.equal(await count(client, 'profiles'), 1, 'User A must read their profile');
  for (const table of [
    'signature_projects',
    'signature_practice_summaries',
    'signature_practice_events',
  ]) {
    const rows = await client.query(`select user_id from public.${table} where user_id = $1`, [
      userB,
    ]);
    assert.equal(rows.rowCount, 0, `User A must not read User B ${table}`);
  }
  assert.equal(await count(client, 'signature_projects'), 1, 'User A must read their own project');
  assert.equal(
    await count(client, 'signature_practice_summaries'),
    1,
    'User A must read their own server summary',
  );
  assert.equal(
    await count(client, 'signature_practice_events'),
    2,
    'User A must read only their own immutable metadata events',
  );
  assert.equal(await count(client, 'reward_balances'), 0, 'User A must not read User B rewards');
  for (const table of ['attempts', 'confusion_stats', 'skill_states', 'review_schedule']) {
    const rows = await client.query(`select user_id from public.${table} where user_id = $1`, [
      userB,
    ]);
    assert.equal(rows.rowCount, 0, `User A must not read User B ${table}`);
  }
  assert.equal(
    await count(client, 'confusion_stats'),
    1,
    'User A must read only their own confusion statistics',
  );
  const userBSessionRows = await client.query(
    `select id from public.learning_sessions where user_id = $1`,
    [userB],
  );
  assert.equal(userBSessionRows.rowCount, 0, 'User A must not read User B learning session');
  const userBActivityRows = await client.query(
    `select id
     from public.learning_session_activities
     where user_id = $1`,
    [userB],
  );
  assert.equal(
    userBActivityRows.rowCount,
    0,
    'User A must not read User B session activity snapshots',
  );

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
  assert.equal(
    await count(client, 'learning_session_activities'),
    0,
    'Unauthenticated access must return no session activities',
  );
  assert.equal(
    await count(client, 'learning_session_lifecycle_events'),
    0,
    'Unauthenticated access must return no Session lifecycle events',
  );
  assert.equal(
    await count(client, 'learning_session_plan_v2_events'),
    0,
    'Unauthenticated access must return no Session Plan V2 events',
  );
  assert.equal(
    await count(client, 'signature_practice_events'),
    0,
    'Unauthenticated access must return no signature metadata events',
  );
  assert.equal(
    await count(client, 'confusion_stats'),
    0,
    'Unauthenticated access must return no confusion statistics',
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

  const completeRequest = {
    schemaVersion: 'session-lifecycle-request-v1',
    idempotencyKey: `session-complete:${ownSessionId}`,
  } as const;
  const completedSession = await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, ownSessionId, 'complete', completeRequest),
  );
  assert.equal(completedSession.status, 'completed');
  assert.ok(completedSession.completedAt, 'Completing a Session must record a server timestamp');
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      transitionSession(transaction, userA, ownSessionId, 'complete', completeRequest),
    ),
    completedSession,
    'A complete retry must replay the exact original result',
  );
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      transitionSession(transaction, userA, ownSessionId, 'start', startRequest),
    ),
    startedSession,
    'A start retry must remain stable even after the Session completes',
  );
  const postCompletionAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatch(transaction, userA, {
      ...concurrentRequest,
      idempotencyKey: `attempts-after-complete:${randomUUID()}`,
      attempts: [{ ...concurrentRequest.attempts[0]!, attemptId: randomUUID() }],
    }),
  );
  assert.equal(postCompletionAttempt?.results[0]?.rejectionCode, 'SESSION_NOT_ACTIVE');

  let reverseTransitionRejected = false;
  try {
    await withUserTransaction(pool, userA, (transaction) =>
      transitionSession(transaction, userA, ownSessionId, 'start', {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: `session-restart:${ownSessionId}`,
      }),
    );
  } catch (error) {
    reverseTransitionRejected =
      error instanceof SessionLifecycleServiceError && error.code === 'SESSION_TRANSITION_INVALID';
  }
  assert.equal(
    reverseTransitionRejected,
    true,
    'A completed Session must not return to an active state',
  );
  assert.equal(
    (await withUserTransaction(pool, userA, (transaction) => loadActiveSession(transaction, userA)))
      .availability,
    'none',
    'Completion must remove the Session from active recovery',
  );

  const abandonedClientSessionId = randomUUID();
  const abandonedSessionId = await withUserTransaction(pool, userA, (transaction) =>
    transaction
      .query<{ id: string }>(
        `insert into public.learning_sessions (
         user_id, client_session_id, idempotency_key, curriculum_version_id,
         lesson_id, target_minutes, plan_version, plan
       ) values ($1, $2, $3, $4, $5, 10, 'pinyin-session-planner-v1', $6)
       returning id`,
        [
          userA,
          abandonedClientSessionId,
          `session-plan:${abandonedClientSessionId}`,
          curriculumVersion,
          lesson,
          plan,
        ],
      )
      .then((result) => result.rows[0]!.id),
  );
  const abandonRequest = {
    schemaVersion: 'session-lifecycle-request-v1',
    idempotencyKey: `session-abandon:${abandonedSessionId}`,
    reasonCode: 'user_requested',
  } as const;
  const abandonedSession = await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, abandonedSessionId, 'abandon', abandonRequest),
  );
  assert.equal(abandonedSession.status, 'abandoned');
  assert.equal(abandonedSession.abandonedReason, 'user_requested');
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      transitionSession(transaction, userA, abandonedSessionId, 'abandon', abandonRequest),
    ),
    abandonedSession,
    'An abandon retry must replay the exact original result',
  );
  const postAbandonAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatch(transaction, userA, {
      ...concurrentRequest,
      sessionId: abandonedSessionId,
      idempotencyKey: `attempts-after-abandon:${randomUUID()}`,
      attempts: [{ ...concurrentRequest.attempts[0]!, attemptId: randomUUID() }],
    }),
  );
  assert.equal(postAbandonAttempt?.results[0]?.rejectionCode, 'SESSION_NOT_ACTIVE');

  let crossUserLifecycleHidden = false;
  try {
    await withUserTransaction(pool, userA, (transaction) =>
      transitionSession(transaction, userB, sessionB, 'start', {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: `cross-user-start:${randomUUID()}`,
      }),
    );
  } catch (error) {
    crossUserLifecycleHidden =
      error instanceof SessionLifecycleServiceError && error.code === 'SESSION_NOT_FOUND';
  }
  assert.equal(
    crossUserLifecycleHidden,
    true,
    'RLS must hide another user Session from lifecycle mutations',
  );

  const concurrentSessionCandidates = [randomUUID(), randomUUID()];
  const concurrentSessionResults = await Promise.allSettled(
    concurrentSessionCandidates.map((candidateId) =>
      withUserTransaction(pool, userA, (transaction) =>
        transaction.query(
          `insert into public.learning_sessions (
             user_id, client_session_id, idempotency_key, curriculum_version_id,
             lesson_id, target_minutes, plan_version, plan
           ) values ($1, $2, $3, $4, $5, 10, 'pinyin-session-planner-v1', $6)
           returning id`,
          [
            userA,
            candidateId,
            `concurrent-session:${candidateId}`,
            curriculumVersion,
            lesson,
            plan,
          ],
        ),
      ),
    ),
  );
  assert.deepEqual(
    concurrentSessionResults.map((result) => result.status).sort(),
    ['fulfilled', 'rejected'],
    'The database unique index must allow only one concurrent active Session per user',
  );
  const recoveredConcurrentSession = await withUserTransaction(pool, userA, (transaction) =>
    loadActiveSession(transaction, userA),
  );
  assert.equal(recoveredConcurrentSession.availability, 'active');
  const recoveredConcurrentSessionId =
    recoveredConcurrentSession.availability === 'active'
      ? recoveredConcurrentSession.session.header.sessionId
      : null;
  assert.ok(recoveredConcurrentSessionId);
  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, recoveredConcurrentSessionId, 'abandon', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `cleanup-concurrent-session:${recoveredConcurrentSessionId}`,
      reasonCode: 'test_cleanup',
    }),
  );

  const learnRequestsV2 = [randomUUID(), randomUUID()].map((clientSessionId) =>
    SessionPlanRequestV2Schema.parse({
      schemaVersion: 'session-plan-request-v2',
      clientSessionId,
      idempotencyKey: `session-plan-v2:${clientSessionId}`,
      intent: 'learn',
      targetMinutes: 10,
    }),
  );
  const planningProbeV2 = await withUserTransaction(pool, userA, (transaction) =>
    loadAuthoritativePlanningStateV2(transaction, userA, 'learn', new Date()),
  );
  assert.ok(planningProbeV2, 'V2 planning requires a Profile and hashed published curriculum');
  assert.ok(
    planningProbeV2.candidates.length >= 3,
    `V2 planning expected materializable Hanzi candidates, received ${planningProbeV2.candidates.length}`,
  );
  assert.equal(
    planningProbeV2.pinyinCandidates.filter((candidate) =>
      candidate.id.endsWith(':confidence-close'),
    ).length,
    1,
    'The authoritative planner must load formal Pinyin and preserve its closing invariant.',
  );
  const materializedProbeV2 = buildMaterializedSessionPlanV2(
    learnRequestsV2[0]!,
    planningProbeV2,
    randomUUID(),
    new Date(),
  );
  assert.ok(
    materializedProbeV2,
    `V2 planner rejected safe content (ability=${planningProbeV2.abilityEstimate}, candidates=${JSON.stringify(
      planningProbeV2.candidates.map((candidate) => ({
        category: candidate.category,
        difficulty: candidate.difficulty,
        id: candidate.id,
        node: candidate.curriculumNodeId,
        supportBoost: candidate.supportBoost,
      })),
    )})`,
  );
  const pinyinCapableProbeV2 = buildMaterializedSessionPlanV2(
    {
      ...learnRequestsV2[0]!,
      clientCapabilities: ['pinyin-exercises-v1'],
    },
    {
      ...planningProbeV2,
      pinyinSupportSignals: {
        consecutiveErrors: 0,
        consecutiveIndependentSuccesses: 3,
        fullAnswerRevealRate: 0,
        recentIndependentAccuracy: 0.9,
      },
    },
    randomUUID(),
    new Date(),
  );
  assert.equal(
    pinyinCapableProbeV2?.activities.some(
      (plannedActivity) => plannedActivity.exerciseType === 'tone_choice',
    ),
    true,
    'A Pinyin-capable client must receive the server-planned formal tone Activity.',
  );
  assert.equal(
    pinyinCapableProbeV2?.activities.find(
      (plannedActivity) => plannedActivity.exerciseType === 'tone_choice',
    )?.pinyinSupport,
    null,
    'Pinyin target evidence must not be downweighted by a Hanzi Pinyin-support decision.',
  );
  const concurrentPlansV2 = await Promise.all(
    learnRequestsV2.map(async (request) => ({
      request,
      response: await withUserTransaction(pool, userA, (transaction) =>
        createOrReplaySessionPlanV2(transaction, userA, request),
      ),
    })),
  );
  assert.deepEqual(
    concurrentPlansV2.map((item) => item.response.result.result).sort(),
    ['active_session_exists', 'planned'],
    'Concurrent V2 planning must create one Session and return it to the competing request',
  );
  const createdPlanV2 = concurrentPlansV2.find((item) => item.response.result.result === 'planned');
  assert.ok(createdPlanV2);
  const createdResultV2 = createdPlanV2.response.result;
  assert.equal(createdResultV2.result, 'planned');
  const learnSnapshotV2 = createdResultV2.session.snapshot;
  assert.ok(
    learnSnapshotV2.activities.length > 1,
    'Learn V2 must materialize more than one safe activity when content is available',
  );
  assert.ok(
    new Set(learnSnapshotV2.activities.map((item) => item.contentRef.split('.exercise.')[0])).size >
      1,
    'Learn V2 must materialize a multi-Lesson snapshot rather than a single Lesson pointer',
  );
  assert.equal(
    learnSnapshotV2.activities.some((item) => item.exerciseType.includes('pinyin')),
    false,
    'The capability gate must keep a client without Pinyin Runner support on known Activities',
  );
  assert.equal(
    learnSnapshotV2.activities.every(
      (item) =>
        item.contentVersion.startsWith('rls-') &&
        item.contentSha256.match(/^[a-f0-9]{64}$/) !== null,
    ),
    true,
    'Every V2 activity must freeze its content version and canonical hash',
  );
  assert.equal(learnSnapshotV2.humorPreference, 'light');
  assert.equal(learnSnapshotV2.contentManifestSha256, 'a'.repeat(64));

  await pool.query(`update public.profiles set humor_preference = 'playful' where id = $1`, [
    userA,
  ]);
  const replayedPlanV2 = await withUserTransaction(pool, userA, (transaction) =>
    createOrReplaySessionPlanV2(transaction, userA, createdPlanV2.request),
  );
  assert.deepEqual(
    replayedPlanV2.result,
    createdResultV2,
    'A V2 retry must return the original Snapshot after Profile preferences change',
  );
  assert.equal(
    replayedPlanV2.result.result === 'planned'
      ? replayedPlanV2.result.session.snapshot.humorPreference
      : null,
    'light',
    'The original reviewed-content preference must remain frozen in the Snapshot',
  );
  const persistedActivitiesV2 = await pool.query<{
    activity_count: string;
    snapshot_schema_version: string;
  }>(
    `select
       ls.snapshot_schema_version,
       count(lsa.id)::text as activity_count
     from public.learning_sessions ls
     join public.learning_session_activities lsa on lsa.session_id = ls.id
     where ls.id = $1
     group by ls.snapshot_schema_version`,
    [createdResultV2.session.sessionId],
  );
  assert.equal(
    Number(persistedActivitiesV2.rows[0]?.activity_count),
    learnSnapshotV2.activities.length,
    'The Session header and every Activity must materialize atomically',
  );
  assert.equal(persistedActivitiesV2.rows[0]?.snapshot_schema_version, 'session-plan-snapshot-v2');

  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, createdResultV2.session.sessionId, 'start', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `start-v2-attempts:${createdResultV2.session.sessionId}`,
    }),
  );
  const attemptsV2 = learnSnapshotV2.activities.map((item, index) => {
    const answer =
      'correctOptionId' in item.exercise
        ? { optionId: item.exercise.correctOptionId }
        : 'correctTileOrder' in item.exercise
          ? { tileIds: [...item.exercise.correctTileOrder] }
          : (() => {
              throw new Error(`Unsupported Attempts V2 fixture: ${item.exercise.type}`);
            })();
    return {
      attemptId: randomUUID(),
      sessionActivityId: item.sessionActivityId,
      answer,
      isCorrectClient: false,
      responseMs: 1_000 + index,
      hintLevel: 'none' as const,
      pinyinSupport:
        item.pinyinSupport?.initialEvidenceSupport === 'pinyin_visible'
          ? ('pinyin_visible' as const)
          : ('none' as const),
      replayCount: 0,
      retryCount: 0,
      occurredAt: new Date(Date.UTC(2026, 6, 24, 12, 0, 0, index)).toISOString(),
      offlineSequence: index,
    };
  });
  const attemptsRequestV2 = AttemptsBatchRequestV2Schema.parse({
    schemaVersion: 'attempts-batch-request-v2',
    sessionId: createdResultV2.session.sessionId,
    idempotencyKey: `attempts-v2:${randomUUID()}`,
    attempts: [...attemptsV2].reverse(),
  });
  const attemptsResponseV2 = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(transaction, userA, attemptsRequestV2),
  );
  assert.ok(attemptsResponseV2);
  assert.deepEqual(
    attemptsResponseV2.results.map((result) => result.attemptId),
    attemptsV2.map((attempt) => attempt.attemptId),
    'Attempts V2 must replay offline events in device time and sequence order',
  );
  assert.equal(
    attemptsResponseV2.results.every((result) => result.status === 'accepted' && result.isCorrect),
    true,
    'Server scoring must ignore forged client correctness for every multi-Lesson Activity',
  );
  const normalizedCounts = await pool.query<{
    attempts: string;
    evidence: string;
  }>(
    `select
       count(distinct a.id)::text as attempts,
       count(ae.attempt_id)::text as evidence
     from public.attempts a
     left join public.attempt_evidence ae on ae.attempt_id = a.id
     where a.user_id = $1
       and a.session_id = $2
       and a.attempt_contract_version = 'attempt-event-v2'`,
    [userA, createdResultV2.session.sessionId],
  );
  assert.equal(
    Number(normalizedCounts.rows[0]?.attempts),
    learnSnapshotV2.activities.length,
    'Every Session Activity must create one immutable Attempt',
  );
  assert.equal(
    Number(normalizedCounts.rows[0]?.evidence),
    learnSnapshotV2.activities.reduce((total, item) => total + item.evidenceTargets.length, 0),
    'Every explicit Evidence Target must create one normalized row',
  );
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatchV2(transaction, userA, attemptsRequestV2),
    ),
    attemptsResponseV2,
    'The same batch idempotency key must replay the exact first response',
  );

  let changedBatchRejected = false;
  try {
    await withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatchV2(transaction, userA, {
        ...attemptsRequestV2,
        attempts: attemptsRequestV2.attempts.map((attempt, index) =>
          index === 0 ? { ...attempt, responseMs: attempt.responseMs + 1 } : attempt,
        ),
      }),
    );
  } catch (error) {
    changedBatchRejected =
      error instanceof AttemptsBatchV2ServiceError &&
      error.code === 'ATTEMPTS_BATCH_IDEMPOTENCY_CONFLICT';
  }
  assert.equal(
    changedBatchRejected,
    true,
    'A reused batch idempotency key must reject a changed payload',
  );
  const duplicateAttemptsV2 = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(transaction, userA, {
      ...attemptsRequestV2,
      idempotencyKey: `attempts-v2:${randomUUID()}`,
    }),
  );
  assert.equal(
    duplicateAttemptsV2?.results.every((result) => result.status === 'duplicate'),
    true,
    'A new batch containing the same immutable Attempt IDs must return duplicate',
  );
  const concurrentAttemptV2 = {
    ...attemptsV2[0]!,
    attemptId: randomUUID(),
    occurredAt: new Date(Date.UTC(2026, 6, 24, 12, 1)).toISOString(),
    offlineSequence: 90,
  };
  const concurrentAttemptResultsV2 = await Promise.all(
    [randomUUID(), randomUUID()].map((batchId) =>
      withUserTransaction(pool, userA, (transaction) =>
        processAttemptsBatchV2(
          transaction,
          userA,
          AttemptsBatchRequestV2Schema.parse({
            schemaVersion: 'attempts-batch-request-v2',
            sessionId: createdResultV2.session.sessionId,
            idempotencyKey: `attempts-v2:${batchId}`,
            attempts: [concurrentAttemptV2],
          }),
        ),
      ),
    ),
  );
  assert.deepEqual(
    concurrentAttemptResultsV2.map((result) => result?.results[0]?.status).sort(),
    ['accepted', 'duplicate'],
    'Concurrent delivery of one Attempt ID must create one event and one duplicate response',
  );

  const firstV2Activity = learnSnapshotV2.activities[0]!;
  const invalidShapeV2 = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(
      transaction,
      userA,
      AttemptsBatchRequestV2Schema.parse({
        schemaVersion: 'attempts-batch-request-v2',
        sessionId: createdResultV2.session.sessionId,
        idempotencyKey: `attempts-v2:${randomUUID()}`,
        attempts: [
          {
            attemptId: randomUUID(),
            sessionActivityId: firstV2Activity.sessionActivityId,
            answer: { tileIds: [randomUUID()] },
            responseMs: 900,
            hintLevel: 'none',
            pinyinSupport:
              firstV2Activity.pinyinSupport?.initialEvidenceSupport === 'pinyin_visible'
                ? 'pinyin_visible'
                : 'none',
            replayCount: 0,
            retryCount: 0,
            occurredAt: new Date().toISOString(),
            offlineSequence: 100,
          },
        ],
      }),
    ),
  );
  assert.equal(invalidShapeV2?.results[0]?.status, 'rejected');
  assert.equal(invalidShapeV2?.results[0]?.rejectionCode, 'ANSWER_INVALID');
  const missingActivityV2 = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(
      transaction,
      userA,
      AttemptsBatchRequestV2Schema.parse({
        ...attemptsRequestV2,
        idempotencyKey: `attempts-v2:${randomUUID()}`,
        attempts: [
          {
            ...attemptsRequestV2.attempts[0]!,
            attemptId: randomUUID(),
            sessionActivityId: randomUUID(),
            offlineSequence: 101,
          },
        ],
      }),
    ),
  );
  const missingActivityResultV2 = missingActivityV2?.results[0];
  assert.equal(missingActivityResultV2?.status, 'rejected');
  assert.equal(
    missingActivityResultV2?.status === 'rejected' ? missingActivityResultV2.rejectionCode : null,
    'ACTIVITY_NOT_FOUND',
  );
  assert.equal(
    await withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatchV2(transaction, userA, {
        ...attemptsRequestV2,
        sessionId: sessionB,
        idempotencyKey: `attempts-v2:${randomUUID()}`,
      }),
    ),
    null,
    'RLS must hide another user Session from Attempts V2',
  );
  const hiddenEvidence = await withUserTransaction(pool, userB, (transaction) =>
    transaction.query(`select attempt_id from public.attempt_evidence where user_id = $1`, [userA]),
  );
  assert.equal(hiddenEvidence.rowCount, 0, 'RLS must hide another user normalized Evidence');
  const hiddenBatchEvents = await withUserTransaction(pool, userB, (transaction) =>
    transaction.query(`select id from public.attempt_batch_v2_events where user_id = $1`, [userA]),
  );
  assert.equal(hiddenBatchEvents.rowCount, 0, 'RLS must hide another user batch receipts');
  let evidenceMutationRejected = false;
  try {
    await withUserTransaction(pool, userA, (transaction) =>
      transaction.query(
        `update public.attempt_evidence
         set effective_quality = 0
         where user_id = $1`,
        [userA],
      ),
    );
  } catch {
    evidenceMutationRejected = true;
  }
  assert.equal(evidenceMutationRejected, true, 'Normalized Evidence must be immutable');
  let forgedEvidenceOwnerRejected = false;
  try {
    await withUserTransaction(pool, userA, (transaction) =>
      transaction.query(
        `insert into public.attempt_evidence (
           attempt_id, user_id, evidence_index, concept_type, concept_id, skill, ability_axis,
           target_role, correct, base_quality, support_multiplier, effective_quality,
           algorithm_version
         ) values (
           $1, $2, 0, 'character', $3, 'audio_to_glyph', 'hanzi_recognition',
           'primary', true, 1, 1, 1, 'forged-evidence-v1'
         )`,
        [attemptB, userB, conceptB],
      ),
    );
  } catch {
    forgedEvidenceOwnerRejected = true;
  }
  assert.equal(
    forgedEvidenceOwnerRejected,
    true,
    'RLS must reject a forged user_id on normalized Evidence',
  );

  const hiddenPlanEvents = await withUserTransaction(pool, userB, (transaction) =>
    transaction.query(
      `select id
       from public.learning_session_plan_v2_events
       where user_id = $1`,
      [userA],
    ),
  );
  assert.equal(hiddenPlanEvents.rowCount, 0, 'RLS must hide another user Session Plan V2 events');

  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, createdResultV2.session.sessionId, 'complete', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `complete-v2-learn:${createdResultV2.session.sessionId}`,
    }),
  );
  const completedSessionAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(
      transaction,
      userA,
      AttemptsBatchRequestV2Schema.parse({
        ...attemptsRequestV2,
        idempotencyKey: `attempts-v2:${randomUUID()}`,
        attempts: [
          {
            ...attemptsRequestV2.attempts[0]!,
            attemptId: randomUUID(),
            offlineSequence: 102,
          },
        ],
      }),
    ),
  );
  assert.equal(
    completedSessionAttempt?.results[0]?.status === 'rejected'
      ? completedSessionAttempt.results[0].rejectionCode
      : null,
    'SESSION_NOT_ACTIVE',
    'A completed Session must reject new Attempts V2',
  );

  await pool.query(
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version
     ) values (
       $1, 'pinyin', $2, 'tone_choice', '2020-01-01T00:00:00.000Z',
       'initial_pinyin_review', 1, 'pinyin-scoring-v1'
     )`,
    [userA, pinyinToneConcept],
  );
  const pinyinReviewClientSessionId = randomUUID();
  const pinyinReviewPlan = await withUserTransaction(pool, userA, (transaction) =>
    createOrReplaySessionPlanV2(
      transaction,
      userA,
      SessionPlanRequestV2Schema.parse({
        schemaVersion: 'session-plan-request-v2',
        clientSessionId: pinyinReviewClientSessionId,
        idempotencyKey: `session-plan-v2:${pinyinReviewClientSessionId}`,
        intent: 'review',
        targetMinutes: 10,
        clientCapabilities: ['pinyin-exercises-v1'],
      }),
    ),
  );
  assert.equal(pinyinReviewPlan.result.result, 'planned');
  const pinyinReviewSession =
    pinyinReviewPlan.result.result === 'planned' ? pinyinReviewPlan.result.session : null;
  assert.ok(pinyinReviewSession);
  const plannedToneActivity = pinyinReviewSession.snapshot.activities.find(
    (plannedActivity) => plannedActivity.exerciseType === 'tone_choice',
  );
  assert.ok(plannedToneActivity, 'A due tone target must materialize for a capable client.');
  assert.equal(plannedToneActivity.pinyinSupport, null);
  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, pinyinReviewSession.sessionId, 'start', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `start-pinyin-review:${pinyinReviewSession.sessionId}`,
    }),
  );
  const pinyinAttemptId = randomUUID();
  const pinyinAttemptRequest = AttemptsBatchRequestV2Schema.parse({
    schemaVersion: 'attempts-batch-request-v2',
    sessionId: pinyinReviewSession.sessionId,
    idempotencyKey: `attempts-v2:${randomUUID()}`,
    attempts: [
      {
        attemptId: pinyinAttemptId,
        sessionActivityId: plannedToneActivity.sessionActivityId,
        answer: { optionId: pinyinToneCorrectOption },
        isCorrectClient: false,
        responseMs: 1_200,
        hintLevel: 'none',
        pinyinSupport: 'none',
        replayCount: 0,
        retryCount: 0,
        occurredAt: '2026-07-24T12:10:00.000Z',
        offlineSequence: 200,
      },
    ],
  });
  const acceptedPinyinAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(transaction, userA, pinyinAttemptRequest),
  );
  assert.equal(acceptedPinyinAttempt?.results[0]?.status, 'accepted');
  assert.equal(
    acceptedPinyinAttempt?.results[0]?.status === 'accepted'
      ? acceptedPinyinAttempt.results[0].isCorrect
      : false,
    true,
    'The server must score the immutable neutral-tone answer as correct.',
  );
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      processAttemptsBatchV2(transaction, userA, pinyinAttemptRequest),
    ),
    acceptedPinyinAttempt,
    'A repeated offline Pinyin batch must replay the exact response.',
  );
  const duplicatePinyinAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(transaction, userA, {
      ...pinyinAttemptRequest,
      idempotencyKey: `attempts-v2:${randomUUID()}`,
    }),
  );
  assert.equal(duplicatePinyinAttempt?.results[0]?.status, 'duplicate');
  const persistedPinyinLearning = await pool.query<{
    algorithm_version: string;
    exposure_count: number;
    mastery_probability: string;
    review_count: string;
  }>(
    `select
       ae.algorithm_version,
       ss.exposure_count,
       ss.mastery_probability::text,
       (select count(*)::text
        from public.review_schedule rs
        where rs.user_id = $1
          and rs.concept_type = 'pinyin'
          and rs.concept_id = $2
          and rs.skill = 'tone_choice') as review_count
     from public.attempt_evidence ae
     join public.attempts a on a.id = ae.attempt_id and a.user_id = ae.user_id
     join public.skill_states ss
       on ss.user_id = ae.user_id
      and ss.concept_type::text = ae.concept_type
      and ss.concept_id::text = ae.concept_id
      and ss.skill::text = ae.skill
     where a.offline_event_id = $3`,
    [userA, pinyinToneConcept, pinyinAttemptId],
  );
  assert.equal(persistedPinyinLearning.rows[0]?.exposure_count, 1);
  assert.ok(Number(persistedPinyinLearning.rows[0]?.mastery_probability) > 0.15);
  assert.equal(persistedPinyinLearning.rows[0]?.review_count, '1');
  assert.equal(
    persistedPinyinLearning.rows[0]?.algorithm_version.includes('pinyin-scoring-v1'),
    true,
  );
  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(transaction, userA, pinyinReviewSession.sessionId, 'abandon', {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: `cleanup-pinyin-review:${pinyinReviewSession.sessionId}`,
      reasonCode: 'test_cleanup',
    }),
  );

  await pool.query(
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version
     ) values
       ($1, 'character', $2, 'audio_to_glyph', '2020-01-01T00:00:00.000Z',
        'v2-review-test', 1, 'test-v2'),
       ($1, 'character', $3, 'glyph_to_image', '2020-01-01T00:00:00.000Z',
        'v2-review-test', 1, 'test-v2')
     on conflict (user_id, concept_type, concept_id, skill) do update set
       due_at = excluded.due_at,
       due_reason = excluded.due_reason,
       planner_version = excluded.planner_version`,
    [userA, conceptB, safeConcept],
  );
  const dueReviewRowsV2 = await withUserTransaction(pool, userA, (transaction) =>
    transaction.query(
      `select concept_id, skill
       from public.review_schedule
       where user_id = $1 and due_at <= transaction_timestamp()
       order by concept_id, skill`,
      [userA],
    ),
  );
  assert.ok(
    dueReviewRowsV2.rowCount !== null && dueReviewRowsV2.rowCount >= 2,
    'The authenticated review planner must see the two authoritative due fixtures',
  );
  const authoritativeReviewStateV2 = await withUserTransaction(pool, userA, (transaction) =>
    loadAuthoritativePlanningStateV2(transaction, userA, 'review', new Date()),
  );
  assert.ok(authoritativeReviewStateV2);
  assert.ok(
    authoritativeReviewStateV2.candidates.length >= 2,
    'Due Review Schedule rows must resolve to safe materializable candidates',
  );
  const reviewClientSessionId = randomUUID();
  const reviewRequestV2 = SessionPlanRequestV2Schema.parse({
    schemaVersion: 'session-plan-request-v2',
    clientSessionId: reviewClientSessionId,
    idempotencyKey: `session-plan-v2:${reviewClientSessionId}`,
    intent: 'review',
    targetMinutes: 10,
  });
  const reviewPlanV2 = await withUserTransaction(pool, userA, (transaction) =>
    createOrReplaySessionPlanV2(transaction, userA, reviewRequestV2),
  );
  assert.equal(reviewPlanV2.result.result, 'planned');
  assert.equal(
    reviewPlanV2.result.result === 'planned'
      ? reviewPlanV2.result.session.snapshot.activities.every((item) =>
          item.evidenceTargets.every((target) =>
            ([conceptB, safeConcept] as string[]).includes(target.conceptId),
          ),
        )
      : false,
    true,
    'Review V2 must use only server-authoritative due concepts',
  );
  assert.equal(
    reviewPlanV2.result.result === 'planned'
      ? reviewPlanV2.result.session.snapshot.activities.every(
          (item) =>
            item.exerciseType === 'audio_to_glyph' || item.exerciseType === 'glyph_to_image',
        )
      : false,
    true,
    'Review V2 must not introduce a new concept or unsupported exercise type',
  );
  assert.equal(reviewPlanV2.result.result, 'planned');
  await withUserTransaction(pool, userA, (transaction) =>
    transitionSession(
      transaction,
      userA,
      reviewPlanV2.result.result === 'planned'
        ? reviewPlanV2.result.session.sessionId
        : randomUUID(),
      'abandon',
      {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: `cleanup-v2-review:${reviewClientSessionId}`,
        reasonCode: 'test_cleanup',
      },
    ),
  );
  const abandonedReviewActivity =
    reviewPlanV2.result.result === 'planned'
      ? reviewPlanV2.result.session.snapshot.activities[0]
      : undefined;
  assert.ok(abandonedReviewActivity);
  const abandonedSessionAttempt = await withUserTransaction(pool, userA, (transaction) =>
    processAttemptsBatchV2(
      transaction,
      userA,
      AttemptsBatchRequestV2Schema.parse({
        schemaVersion: 'attempts-batch-request-v2',
        sessionId:
          reviewPlanV2.result.result === 'planned'
            ? reviewPlanV2.result.session.sessionId
            : randomUUID(),
        idempotencyKey: `attempts-v2:${randomUUID()}`,
        attempts: [
          {
            attemptId: randomUUID(),
            sessionActivityId: abandonedReviewActivity.sessionActivityId,
            answer: { optionId: randomUUID() },
            responseMs: 700,
            hintLevel: 'none',
            pinyinSupport: 'none',
            replayCount: 0,
            retryCount: 0,
            occurredAt: new Date().toISOString(),
            offlineSequence: 103,
          },
        ],
      }),
    ),
  );
  assert.equal(
    abandonedSessionAttempt?.results[0]?.status === 'rejected'
      ? abandonedSessionAttempt.results[0].rejectionCode
      : null,
    'SESSION_NOT_ACTIVE',
    'An abandoned Session must reject new Attempts V2',
  );

  await pool.query(
    `update public.review_schedule
     set due_at = '2099-01-01T00:00:00.000Z'
     where user_id = $1`,
    [userA],
  );
  const planWriteCounts = async () =>
    pool
      .query<{
        activities: string;
        events: string;
        sessions: string;
      }>(
        `select
           (select count(*) from public.learning_sessions where user_id = $1)::text as sessions,
           (select count(*) from public.learning_session_activities where user_id = $1)::text
             as activities,
           (select count(*) from public.learning_session_plan_v2_events where user_id = $1)::text
             as events`,
        [userA],
      )
      .then((result) => result.rows[0]);
  const countsBeforeNothingDue = await planWriteCounts();
  const nothingDueClientSessionId = randomUUID();
  const nothingDue = await withUserTransaction(pool, userA, (transaction) =>
    createOrReplaySessionPlanV2(
      transaction,
      userA,
      SessionPlanRequestV2Schema.parse({
        schemaVersion: 'session-plan-request-v2',
        clientSessionId: nothingDueClientSessionId,
        idempotencyKey: `session-plan-v2:${nothingDueClientSessionId}`,
        intent: 'review',
        targetMinutes: 10,
      }),
    ),
  );
  assert.equal(nothingDue.result.result, 'nothing_due');
  const countsAfterNothingDue = await planWriteCounts();
  assert.equal(
    countsAfterNothingDue?.sessions,
    countsBeforeNothingDue?.sessions,
    'nothing_due must not create an empty Session',
  );
  assert.equal(
    countsAfterNothingDue?.activities,
    countsBeforeNothingDue?.activities,
    'nothing_due must not create an Activity',
  );
  assert.equal(
    Number(countsAfterNothingDue?.events),
    Number(countsBeforeNothingDue?.events) + 1,
    'nothing_due must persist exactly one immutable idempotency receipt',
  );
  await pool.query(
    `update public.review_schedule
     set due_at = '2020-01-01T00:00:00.000Z'
     where user_id = $1 and concept_id = $2`,
    [userA, conceptB],
  );
  assert.deepEqual(
    await withUserTransaction(pool, userA, (transaction) =>
      createOrReplaySessionPlanV2(
        transaction,
        userA,
        SessionPlanRequestV2Schema.parse({
          schemaVersion: 'session-plan-request-v2',
          clientSessionId: nothingDueClientSessionId,
          idempotencyKey: `session-plan-v2:${nothingDueClientSessionId}`,
          intent: 'review',
          targetMinutes: 10,
        }),
      ),
    ),
    nothingDue,
    'A nothing_due retry must replay the first result after due state changes',
  );

  const invalidLesson = randomUUID();
  await pool.query(
    `insert into public.lessons (
       id, unit_id, slug, sort_order, title_zh, content_spec, is_published
     ) values ($1, $2, $3, 99, '损坏测试课程', $4, true)`,
    [
      invalidLesson,
      unit,
      `invalid-${invalidLesson}`,
      {
        exercises: [
          {
            activityId: randomUUID(),
            type: 'audio_to_glyph',
            promptAudioAssetId: audioAsset,
            targetConceptIds: [conceptB],
            options: [],
            correctOptionId: correctOption,
            visualHintZh: '损坏内容。',
          },
        ],
      },
    ],
  );
  const countsBeforeInvalidContent = await planWriteCounts();
  let invalidContentRejected = false;
  try {
    const invalidClientSessionId = randomUUID();
    await withUserTransaction(pool, userA, (transaction) =>
      createOrReplaySessionPlanV2(
        transaction,
        userA,
        SessionPlanRequestV2Schema.parse({
          schemaVersion: 'session-plan-request-v2',
          clientSessionId: invalidClientSessionId,
          idempotencyKey: `session-plan-v2:${invalidClientSessionId}`,
          intent: 'learn',
          targetMinutes: 10,
        }),
      ),
    );
  } catch (error) {
    invalidContentRejected =
      error instanceof SessionPlanV2ServiceError && error.code === 'SESSION_CONTENT_INVALID';
  }
  assert.equal(invalidContentRejected, true, 'Malformed published content must fail closed');
  assert.deepEqual(
    await planWriteCounts(),
    countsBeforeInvalidContent,
    'A materialization failure must not leave a partial Session or Activity',
  );
  await pool.query(`delete from public.lessons where id = $1`, [invalidLesson]);

  await pool.query(
    `update public.review_schedule
     set due_at = '2026-07-25T00:00:00.000Z'
     where user_id = $1
       and concept_type = 'pinyin'
       and concept_id = $2
       and skill = 'tone_choice'`,
    [userA, pinyinToneConcept],
  );
  const reviewGeneratedAt = new Date('2030-01-01T00:00:00.000Z');
  const reviewPagination = resolveReviewCenterPagination(
    { schemaVersion: 'review-center-request-v1', limit: 50 },
    reviewGeneratedAt,
  );
  const privateTableCounts = async () =>
    pool
      .query<{
        attempts: string;
        confusion_stats: string;
        review_schedule: string;
        skill_states: string;
      }>(
        `select
           (select count(*) from public.attempts)::text as attempts,
           (select count(*) from public.confusion_stats)::text as confusion_stats,
           (select count(*) from public.review_schedule)::text as review_schedule,
           (select count(*) from public.skill_states)::text as skill_states`,
      )
      .then((result) => result.rows[0]);
  const countsBeforeReviewRead = await privateTableCounts();
  const reviewA = await withUserTransaction(pool, userA, (transaction) =>
    loadReviewCenter(transaction, userA, reviewPagination),
  );
  assert.equal(
    reviewA.summary.dueNowCount,
    2,
    'Confusion work must replace duplicate Hanzi work while preserving due Pinyin work',
  );
  assert.equal(reviewA.items[0]?.kind, 'confusion');
  assert.equal(reviewA.items[0]?.reasonCode, 'confusion_pair');
  const toneReview = reviewA.items.find((item) => item.kind === 'tone');
  assert.equal(toneReview?.contentRef, `pinyin:${pinyinToneConcept}`);
  assert.equal(toneReview?.recommendedActivityType, 'tone_choice');
  assert.equal(toneReview?.reasonCode, 'stability_check');
  assert.equal(
    reviewA.items.some((item) => item.contentRef.includes(unpublishedConcept)),
    false,
    'Unpublished content must never enter Review Center',
  );
  assert.deepEqual(
    reviewA.groups.map((group) => group.kind),
    ['hanzi', 'pinyin', 'tone', 'word', 'sentence', 'confusion'],
    'Review Center must always return all six stable groups',
  );
  assert.equal(
    reviewA.groups.find((group) => group.kind === 'tone')?.count,
    1,
    'A real Pinyin tone schedule must populate the tone group.',
  );
  const reviewPayload = JSON.stringify(reviewA);
  assert.equal(reviewPayload.includes(userA), false, 'Review response must not expose user IDs');
  assert.equal(
    reviewPayload.includes('"correct"'),
    false,
    'Review response must not expose answers',
  );
  assert.equal(reviewPayload.includes('mastery'), false, 'Review response must not expose mastery');

  const reviewB = await withUserTransaction(pool, userB, (transaction) =>
    loadReviewCenter(transaction, userB, reviewPagination),
  );
  assert.equal(reviewB.summary.dueNowCount, 1, 'User B must see only their own due schedule');
  assert.equal(reviewB.items[0]?.kind, 'hanzi');
  assert.equal(
    reviewB.items.some((item) => item.kind === 'confusion'),
    false,
    'User B future confusion work must not leak into due work',
  );
  const forgedReviewRead = await withUserTransaction(pool, userA, (transaction) =>
    loadReviewCenter(transaction, userB, reviewPagination),
  );
  assert.equal(
    forgedReviewRead.summary.dueNowCount,
    0,
    'RLS must deny a mismatched internal user ID even before the response is built',
  );
  assert.deepEqual(
    await privateTableCounts(),
    countsBeforeReviewRead,
    'Review Center reads must not mutate attempts, skill state, schedules, or confusion stats',
  );

  await pool.query(`delete from public."user" where id = any($1::uuid[])`, [[userA, userB]]);
  await removePublishedPinyinFixture();
  await pool.query(`delete from public.curriculum_versions where id = $1`, [curriculumVersion]);
  await pool.query(`delete from public.confusable_pairs where id = $1`, [confusionPair]);
  await pool.query(`delete from public.characters where id = any($1::uuid[])`, [
    [conceptB, confusionConcept, safeConcept, unpublishedConcept],
  ]);
  console.log(
    'PostgreSQL integration passed: Session Plan V2 learn/review materialization, Attempts V2 snapshot scoring, normalized Evidence replay, immutable/idempotent offline concurrency, terminal rejection, capability gating, lifecycle/active recovery, empty-result receipts without empty Sessions, read-only Review Center filtering, cascade deletion, and cross-user denial verified.',
  );
} catch (error) {
  if (!clientReleased) await client.query('rollback').catch(() => undefined);
  await pool
    .query(`delete from public."user" where id = any($1::uuid[])`, [[userA, userB]])
    .catch(() => undefined);
  await removePublishedPinyinFixture().catch(() => undefined);
  await pool
    .query(`delete from public.curriculum_versions where id = $1`, [curriculumVersion])
    .catch(() => undefined);
  await pool
    .query(`delete from public.confusable_pairs where id = $1`, [confusionPair])
    .catch(() => undefined);
  await pool
    .query(`delete from public.characters where id = any($1::uuid[])`, [
      [conceptB, confusionConcept, safeConcept, unpublishedConcept],
    ])
    .catch(() => undefined);
  throw error;
} finally {
  if (!clientReleased) client.release();
  await pool.end();
}
