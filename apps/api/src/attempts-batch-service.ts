import type {
  AttemptBatchResult,
  AttemptsBatchRequest,
  LearningExercise,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

import {
  answerMatchesExercise,
  evaluateAttempt,
  parseLessonExercises,
  replaySkillState,
  type EvaluatedAttempt,
  type ReplayAttempt,
} from './attempt-processing.js';

type SessionRow = {
  content_spec: unknown;
  status: 'abandoned' | 'completed' | 'in_progress' | 'planned';
};

type InsertedAttemptRow = {
  correct: boolean;
  evidence_weight: string;
  id: string;
  received_at: Date;
};

type ReplayAttemptRow = {
  correct: boolean;
  device_event_at: Date;
  evidence_weight: string;
  hint_level: number;
  id: string;
  offline_sequence: string;
  pinyin_support: string;
};

export type ProcessedAttemptsBatch = Readonly<{
  results: readonly AttemptBatchResult[];
  syncCursor: string;
}>;

function hintLevel(attempt: AttemptsBatchRequest['attempts'][number]): number {
  switch (attempt.hintLevel) {
    case 'none':
      return 0;
    case 'audio_repeat':
      return 1;
    case 'visual_hint':
      return 2;
    case 'full_answer':
      return 4;
  }
}

function exerciseById(exercises: readonly LearningExercise[]) {
  return new Map(exercises.map((exercise) => [exercise.activityId, exercise]));
}

async function existingAttempt(
  client: PoolClient,
  userId: string,
  attemptId: string,
): Promise<InsertedAttemptRow | null> {
  const result = await client.query<InsertedAttemptRow>(
    `select id, correct, evidence_weight::text, received_at
     from public.attempts
     where user_id = $1 and offline_event_id = $2`,
    [userId, attemptId],
  );
  return result.rows[0] ?? null;
}

async function replayConceptState(
  client: PoolClient,
  userId: string,
  conceptId: string,
  evaluation: EvaluatedAttempt,
): Promise<void> {
  await client.query(
    `insert into public.skill_states (
       user_id, concept_type, concept_id, skill
     ) values ($1, $2, $3, $4)
     on conflict do nothing`,
    [userId, evaluation.conceptType, conceptId, evaluation.skill],
  );
  await client.query(
    `select 1
     from public.skill_states
     where user_id = $1 and concept_type = $2 and concept_id = $3 and skill = $4
     for update`,
    [userId, evaluation.conceptType, conceptId, evaluation.skill],
  );
  const history = await client.query<ReplayAttemptRow>(
    `select
       id,
       correct,
       device_event_at,
       evidence_weight::text,
       hint_level,
       coalesce(metadata ->> 'offlineSequence', '0') as offline_sequence,
       coalesce(metadata ->> 'pinyinSupport', 'none') as pinyin_support
     from public.attempts
     where user_id = $1
       and concept_type = $2
       and skill = $3
       and (
         concept_id = $4
         or coalesce(metadata -> 'targetConceptIds', '[]'::jsonb) @> to_jsonb(array[$4::text])
       )
     order by
       device_event_at,
       coalesce((metadata ->> 'offlineSequence')::bigint, 0),
       id`,
    [userId, evaluation.conceptType, evaluation.skill, conceptId],
  );
  const replayAttempts: ReplayAttempt[] = history.rows.map((row) => ({
    correct: row.correct,
    deviceEventAt: row.device_event_at,
    evidenceWeight: Number(row.evidence_weight),
    hintLevel: row.hint_level,
    id: row.id,
    offlineSequence: Number(row.offline_sequence),
    pinyinSupport:
      row.pinyin_support === 'pinyin_visible' ||
      row.pinyin_support === 'pinyin_revealed' ||
      row.pinyin_support === 'full_answer'
        ? row.pinyin_support
        : 'none',
  }));
  const state = replaySkillState(replayAttempts, evaluation.activityType);
  const stableMasteryAt =
    state.mastery >= 0.85 && state.independentCorrectCount >= 3 ? state.lastAttemptAt : null;
  await client.query(
    `update public.skill_states set
       mastery_probability = $5,
       stability_days = $6,
       exposure_count = $7,
       independent_correct_count = $8,
       hinted_correct_count = $9,
       incorrect_count = $10,
       last_attempt_at = $11,
       next_review_at = $12,
       last_evidence = $13,
       stable_mastery_at = $14,
       model_version = 'bkt-v1+stability-v1',
       updated_at = now()
     where user_id = $1 and concept_type = $2 and concept_id = $3 and skill = $4`,
    [
      userId,
      evaluation.conceptType,
      conceptId,
      evaluation.skill,
      state.mastery,
      state.stability,
      state.exposureCount,
      state.independentCorrectCount,
      state.hintedCorrectCount,
      state.incorrectCount,
      state.lastAttemptAt,
      state.nextReviewAt,
      {
        evidenceWeight: replayAttempts.at(-1)?.evidenceWeight ?? 0,
        replayAlgorithm: 'immutable-attempt-replay-v1',
      },
      stableMasteryAt,
    ],
  );
  await client.query(
    `insert into public.review_schedule (
       user_id, concept_type, concept_id, skill, due_at, due_reason,
       interval_days, planner_version, state_version
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     on conflict (user_id, concept_type, concept_id, skill) do update set
       due_at = excluded.due_at,
       due_reason = excluded.due_reason,
       interval_days = excluded.interval_days,
       planner_version = excluded.planner_version,
       state_version = public.review_schedule.state_version + 1,
       updated_at = now()`,
    [
      userId,
      evaluation.conceptType,
      conceptId,
      evaluation.skill,
      state.nextReviewAt,
      state.review.reason,
      state.review.intervalDays,
      state.review.algorithmVersion,
    ],
  );
}

async function insertAttempt(
  client: PoolClient,
  userId: string,
  sessionId: string,
  attempt: AttemptsBatchRequest['attempts'][number],
  evaluation: EvaluatedAttempt,
): Promise<InsertedAttemptRow | null> {
  const primaryConceptId = evaluation.targetConceptIds[0];
  if (!primaryConceptId) return null;
  const inserted = await client.query<InsertedAttemptRow>(
    `insert into public.attempts (
       offline_event_id, session_id, user_id, concept_type, concept_id, skill,
       activity_type, correct, response_ms, hint_level, selected_value, expected_value,
       device_event_at, evidence_weight, metadata
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     on conflict (user_id, offline_event_id) do nothing
     returning id, correct, evidence_weight::text, received_at`,
    [
      attempt.attemptId,
      sessionId,
      userId,
      evaluation.conceptType,
      primaryConceptId,
      evaluation.skill,
      evaluation.activityType,
      evaluation.correct,
      attempt.responseMs,
      hintLevel(attempt),
      evaluation.selectedValue,
      evaluation.expectedValue,
      attempt.occurredAt,
      evaluation.evidenceWeight,
      { ...evaluation.metadata, targetConceptIds: evaluation.targetConceptIds },
    ],
  );
  return inserted.rows[0] ?? null;
}

export async function processAttemptsBatch(
  client: PoolClient,
  userId: string,
  request: AttemptsBatchRequest,
): Promise<ProcessedAttemptsBatch | null> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const session = await client.query<SessionRow>(
    `select ls.status, l.content_spec
     from public.learning_sessions ls
     left join public.lessons l on l.id = ls.lesson_id
     where ls.id = $1 and ls.user_id = $2`,
    [request.sessionId, userId],
  );
  const sessionRow = session.rows[0];
  if (!sessionRow) return null;
  const exercises = exerciseById(parseLessonExercises(sessionRow.content_spec));
  const ordered = [...request.attempts].sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      left.offlineSequence - right.offlineSequence ||
      left.attemptId.localeCompare(right.attemptId),
  );
  const results: AttemptBatchResult[] = [];
  for (const attempt of ordered) {
    if (sessionRow.status === 'completed' || sessionRow.status === 'abandoned') {
      results.push({
        attemptId: attempt.attemptId,
        rejectionCode: 'SESSION_NOT_ACTIVE',
        status: 'rejected',
      });
      continue;
    }
    const exercise = exercises.get(attempt.activityId);
    if (!exercise) {
      results.push({
        attemptId: attempt.attemptId,
        rejectionCode: 'ACTIVITY_NOT_FOUND',
        status: 'rejected',
      });
      continue;
    }
    if (!answerMatchesExercise(attempt, exercise)) {
      results.push({
        attemptId: attempt.attemptId,
        rejectionCode: 'ANSWER_INVALID',
        status: 'rejected',
      });
      continue;
    }
    const evaluation = evaluateAttempt(attempt, exercise);
    const inserted = await insertAttempt(client, userId, request.sessionId, attempt, evaluation);
    if (!inserted) {
      const duplicate = await existingAttempt(client, userId, attempt.attemptId);
      results.push({
        attemptId: attempt.attemptId,
        evidenceWeight: Number(duplicate?.evidence_weight ?? 0),
        isCorrect: duplicate?.correct ?? false,
        status: 'duplicate',
      });
      continue;
    }
    for (const conceptId of evaluation.targetConceptIds) {
      await replayConceptState(client, userId, conceptId, evaluation);
    }
    results.push({
      attemptId: attempt.attemptId,
      evidenceWeight: evaluation.evidenceWeight,
      isCorrect: evaluation.correct,
      status: 'accepted',
    });
  }
  const cursor = await client.query<{ id: string; received_at: Date }>(
    `select id, received_at
     from public.attempts
     where user_id = $1
     order by received_at desc, id desc
     limit 1`,
    [userId],
  );
  const latest = cursor.rows[0];
  return Object.freeze({
    results: Object.freeze(results),
    syncCursor: latest
      ? `${latest.received_at.toISOString()}:${latest.id}`
      : `empty:${request.sessionId}`,
  });
}
