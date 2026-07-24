import { createHash } from 'node:crypto';

import {
  AttemptsBatchResponseDataV2Schema,
  LearningExerciseV2Schema,
  SessionActivitySnapshotV2Schema,
  type AttemptBatchResultV2,
  type AttemptDraftV2,
  type AttemptEvidenceResultV1,
  type AttemptsBatchRequestV2,
  type AttemptsBatchResponseDataV2,
  type SessionActivitySnapshotV2,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

import {
  answerMatchesExerciseV2,
  evaluateAttemptV2,
  supportStateMatchesActivityV2,
  type EvaluatedAttemptV2,
  type EvaluatedEvidenceV2,
} from './attempt-processing-v2.js';
import { replaySkillState, type ReplayAttempt } from './attempt-processing.js';

type SessionRow = {
  status: 'abandoned' | 'completed' | 'in_progress' | 'planned';
};

type SessionActivityRow = {
  content_ref: string;
  content_sha256: string;
  content_version: string;
  estimated_seconds: number;
  evidence_targets: unknown;
  exercise_snapshot: unknown;
  exercise_type: string;
  humor_content_ref: string | null;
  id: string;
  position: number;
  pinyin_support: unknown;
  source_exercise_id: string;
};

type ExistingAttemptRow = {
  attempt_contract_version: string;
  correct: boolean;
  id: string;
  request_sha256: string | null;
  session_activity_id: string | null;
  session_id: string;
};

type EvidenceRow = {
  ability_axis: AttemptEvidenceResultV1['abilityAxis'];
  algorithm_version: string;
  base_quality: string;
  concept_id: string;
  concept_type: AttemptEvidenceResultV1['conceptType'];
  correct: boolean;
  effective_quality: string;
  skill: string;
  support_multiplier: string;
};

type ReplayEvidenceRow = {
  correct: boolean;
  device_event_at: Date;
  effective_quality: string;
  hint_level: number;
  id: string;
  offline_sequence: string;
  pinyin_support: string;
};

type BatchEventRow = {
  request_sha256: string;
  result_snapshot: unknown;
};

export class AttemptsBatchV2ServiceError extends Error {
  constructor(
    readonly code: 'ATTEMPTS_BATCH_IDEMPOTENCY_CONFLICT',
    message: string,
  ) {
    super(message);
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestSha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function hintLevel(attempt: AttemptDraftV2): number {
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

function activitySnapshot(row: SessionActivityRow): SessionActivitySnapshotV2 {
  return SessionActivitySnapshotV2Schema.parse({
    schemaVersion: 'session-activity-v2',
    sessionActivityId: row.id,
    sourceExerciseId: row.source_exercise_id,
    position: row.position,
    exerciseType: row.exercise_type,
    contentRef: row.content_ref,
    contentVersion: row.content_version,
    contentSha256: row.content_sha256,
    exercise: LearningExerciseV2Schema.parse(row.exercise_snapshot),
    evidenceTargets: row.evidence_targets,
    pinyinSupport: row.pinyin_support,
    humorContentRef: row.humor_content_ref,
    estimatedSeconds: row.estimated_seconds,
  });
}

async function findBatchReplay(
  client: PoolClient,
  userId: string,
  request: AttemptsBatchRequestV2,
  hash: string,
): Promise<AttemptsBatchResponseDataV2 | null> {
  const result = await client.query<BatchEventRow>(
    `select request_sha256, result_snapshot
     from public.attempt_batch_v2_events
     where user_id = $1 and idempotency_key = $2`,
    [userId, request.idempotencyKey],
  );
  const event = result.rows[0];
  if (!event) return null;
  if (event.request_sha256 !== hash) {
    throw new AttemptsBatchV2ServiceError(
      'ATTEMPTS_BATCH_IDEMPOTENCY_CONFLICT',
      'The Attempts Batch idempotency key was already used for a different request.',
    );
  }
  return AttemptsBatchResponseDataV2Schema.parse(event.result_snapshot);
}

async function loadActivities(
  client: PoolClient,
  userId: string,
  sessionId: string,
  activityIds: readonly string[],
): Promise<ReadonlyMap<string, SessionActivitySnapshotV2>> {
  const result = await client.query<SessionActivityRow>(
    `select
       id, position, source_exercise_id, exercise_type, content_ref, content_version,
       content_sha256, exercise_snapshot, evidence_targets, pinyin_support,
       humor_content_ref, estimated_seconds
     from public.learning_session_activities
     where user_id = $1 and session_id = $2 and id = any($3::uuid[])
     order by position, id`,
    [userId, sessionId, activityIds],
  );
  return new Map(result.rows.map((row) => [row.id, activitySnapshot(row)]));
}

async function existingAttempt(
  client: PoolClient,
  userId: string,
  attemptId: string,
): Promise<ExistingAttemptRow | null> {
  const result = await client.query<ExistingAttemptRow>(
    `select
       id, session_id, session_activity_id, attempt_contract_version, request_sha256, correct
     from public.attempts
     where user_id = $1 and offline_event_id = $2`,
    [userId, attemptId],
  );
  return result.rows[0] ?? null;
}

async function evidenceForAttempt(
  client: PoolClient,
  userId: string,
  attemptId: string,
): Promise<AttemptEvidenceResultV1[]> {
  const result = await client.query<EvidenceRow>(
    `select
       concept_type, concept_id, skill, ability_axis, correct,
       base_quality::text, support_multiplier::text, effective_quality::text,
       algorithm_version
     from public.attempt_evidence
     where user_id = $1 and attempt_id = $2
     order by evidence_index`,
    [userId, attemptId],
  );
  return result.rows.map((row) => ({
    conceptType: row.concept_type,
    conceptId: row.concept_id,
    skill: row.skill,
    abilityAxis: row.ability_axis,
    correct: row.correct,
    baseQuality: Number(row.base_quality),
    supportMultiplier: Number(row.support_multiplier),
    effectiveQuality: Number(row.effective_quality),
    algorithmVersion: row.algorithm_version,
  }));
}

async function replayEvidenceTarget(
  client: PoolClient,
  userId: string,
  evidence: EvaluatedEvidenceV2,
  activityType: EvaluatedAttemptV2['activityType'],
): Promise<void> {
  await client.query(
    `insert into public.skill_states (user_id, concept_type, concept_id, skill)
     values ($1, $2, $3, $4)
     on conflict do nothing`,
    [userId, evidence.conceptType, evidence.conceptId, evidence.skill],
  );
  await client.query(
    `select 1
     from public.skill_states
     where user_id = $1 and concept_type = $2 and concept_id = $3 and skill = $4
     for update`,
    [userId, evidence.conceptType, evidence.conceptId, evidence.skill],
  );
  const history = await client.query<ReplayEvidenceRow>(
    `select
       a.id,
       a.correct,
       a.device_event_at,
       ae.effective_quality::text,
       a.hint_level,
       coalesce(
         a.offline_sequence,
         case
           when a.metadata ->> 'offlineSequence' ~ '^[0-9]+$'
             then (a.metadata ->> 'offlineSequence')::bigint
         end,
         0
       )::text as offline_sequence,
       coalesce(a.pinyin_support, a.metadata ->> 'pinyinSupport', 'none') as pinyin_support
     from public.attempt_evidence ae
     join public.attempts a on a.id = ae.attempt_id and a.user_id = ae.user_id
     where ae.user_id = $1
       and ae.concept_type = $2
       and ae.concept_id = $3
       and ae.skill = $4
     order by
       a.device_event_at,
       coalesce(
         a.offline_sequence,
         case
           when a.metadata ->> 'offlineSequence' ~ '^[0-9]+$'
             then (a.metadata ->> 'offlineSequence')::bigint
         end,
         0
       ),
       a.id,
       ae.concept_type,
       ae.concept_id,
       ae.skill,
       ae.ability_axis`,
    [userId, evidence.conceptType, evidence.conceptId, evidence.skill],
  );
  const attempts: ReplayAttempt[] = history.rows.map((row) => ({
    correct: row.correct,
    deviceEventAt: row.device_event_at,
    evidenceWeight: Number(row.effective_quality),
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
  const state = replaySkillState(attempts, activityType);
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
       model_version = 'bkt-v1+normalized-evidence-v1',
       updated_at = now()
     where user_id = $1 and concept_type = $2 and concept_id = $3 and skill = $4`,
    [
      userId,
      evidence.conceptType,
      evidence.conceptId,
      evidence.skill,
      state.mastery,
      state.stability,
      state.exposureCount,
      state.independentCorrectCount,
      state.hintedCorrectCount,
      state.incorrectCount,
      state.lastAttemptAt,
      state.nextReviewAt,
      {
        algorithmVersion: evidence.algorithmVersion,
        abilityAxis: evidence.abilityAxis,
        effectiveQuality: attempts.at(-1)?.evidenceWeight ?? 0,
        replayAlgorithm: 'normalized-evidence-replay-v1',
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
      evidence.conceptType,
      evidence.conceptId,
      evidence.skill,
      state.nextReviewAt,
      state.review.reason,
      state.review.intervalDays,
      state.review.algorithmVersion,
    ],
  );
}

async function insertAttemptAndEvidence(
  client: PoolClient,
  userId: string,
  sessionId: string,
  attempt: AttemptDraftV2,
  hash: string,
  evaluation: EvaluatedAttemptV2,
): Promise<string | null> {
  const primary = evaluation.evidence.find((item) => item.role === 'primary');
  if (!primary) throw new Error('The Activity has no primary Evidence Target.');
  const inserted = await client.query<{ id: string }>(
    `insert into public.attempts (
       offline_event_id, session_id, session_activity_id, user_id, concept_type, concept_id,
       skill, activity_type, correct, response_ms, hint_level, selected_value, expected_value,
       device_event_at, evidence_weight, metadata, attempt_contract_version, offline_sequence,
       replay_count, retry_count, pinyin_support, request_sha256
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
       'attempt-event-v2', $17, $18, $19, $20, $21
     )
     on conflict (user_id, offline_event_id) do nothing
     returning id`,
    [
      attempt.attemptId,
      sessionId,
      attempt.sessionActivityId,
      userId,
      primary.conceptType,
      primary.conceptId,
      primary.skill,
      evaluation.activityType,
      evaluation.correct,
      attempt.responseMs,
      hintLevel(attempt),
      evaluation.selectedValue,
      evaluation.expectedValue,
      attempt.occurredAt,
      primary.effectiveQuality,
      {
        clientCorrectnessIgnored: attempt.isCorrectClient,
        evidenceAlgorithmVersion: primary.algorithmVersion,
        replayCount: attempt.replayCount,
        retryCount: attempt.retryCount,
      },
      attempt.offlineSequence,
      attempt.replayCount,
      attempt.retryCount,
      attempt.pinyinSupport,
      hash,
    ],
  );
  const attemptId = inserted.rows[0]?.id;
  if (!attemptId) return null;
  for (const item of evaluation.evidence) {
    await client.query(
      `insert into public.attempt_evidence (
         attempt_id, user_id, evidence_index, concept_type, concept_id, skill, ability_axis,
         target_role, correct, base_quality, support_multiplier, effective_quality,
         algorithm_version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        attemptId,
        userId,
        item.evidenceIndex,
        item.conceptType,
        item.conceptId,
        item.skill,
        item.abilityAxis,
        item.role,
        item.correct,
        item.baseQuality,
        item.supportMultiplier,
        item.effectiveQuality,
        item.algorithmVersion,
      ],
    );
  }
  return attemptId;
}

function publicEvidence(evidence: readonly EvaluatedEvidenceV2[]): AttemptEvidenceResultV1[] {
  return evidence.map((item) =>
    Object.freeze({
      conceptType: item.conceptType,
      conceptId: item.conceptId,
      skill: item.skill,
      abilityAxis: item.abilityAxis,
      correct: item.correct,
      baseQuality: item.baseQuality,
      supportMultiplier: item.supportMultiplier,
      effectiveQuality: item.effectiveQuality,
      algorithmVersion: item.algorithmVersion,
    }),
  );
}

async function processAttempt(
  client: PoolClient,
  userId: string,
  sessionId: string,
  sessionStatus: SessionRow['status'],
  activities: ReadonlyMap<string, SessionActivitySnapshotV2>,
  attempt: AttemptDraftV2,
): Promise<AttemptBatchResultV2> {
  if (sessionStatus !== 'in_progress') {
    return {
      attemptId: attempt.attemptId,
      status: 'rejected',
      rejectionCode: 'SESSION_NOT_ACTIVE',
    };
  }
  const activity = activities.get(attempt.sessionActivityId);
  if (!activity) {
    return {
      attemptId: attempt.attemptId,
      status: 'rejected',
      rejectionCode: 'ACTIVITY_NOT_FOUND',
    };
  }
  if (!answerMatchesExerciseV2(attempt, activity.exercise)) {
    return { attemptId: attempt.attemptId, status: 'rejected', rejectionCode: 'ANSWER_INVALID' };
  }
  if (!supportStateMatchesActivityV2(attempt, activity)) {
    return {
      attemptId: attempt.attemptId,
      status: 'rejected',
      rejectionCode: 'SUPPORT_STATE_INVALID',
    };
  }

  const hash = requestSha256({ sessionId, attempt });
  const existing = await existingAttempt(client, userId, attempt.attemptId);
  if (existing) {
    if (
      existing.attempt_contract_version !== 'attempt-event-v2' ||
      existing.session_id !== sessionId ||
      existing.session_activity_id !== attempt.sessionActivityId ||
      existing.request_sha256 !== hash
    ) {
      return {
        attemptId: attempt.attemptId,
        status: 'rejected',
        rejectionCode: 'ATTEMPT_ID_CONFLICT',
      };
    }
    const evidence = await evidenceForAttempt(client, userId, existing.id);
    if (evidence.length === 0)
      throw new Error('An accepted Attempt is missing normalized Evidence.');
    return {
      attemptId: attempt.attemptId,
      status: 'duplicate',
      isCorrect: existing.correct,
      evidence,
    };
  }

  const evaluation = evaluateAttemptV2(attempt, activity);
  const insertedId = await insertAttemptAndEvidence(
    client,
    userId,
    sessionId,
    attempt,
    hash,
    evaluation,
  );
  if (!insertedId) {
    return processAttempt(client, userId, sessionId, sessionStatus, activities, attempt);
  }
  const replayedSkillKeys = new Set<string>();
  for (const evidence of evaluation.evidence) {
    const skillKey = `${evidence.conceptType}:${evidence.conceptId}:${evidence.skill}`;
    if (replayedSkillKeys.has(skillKey)) continue;
    replayedSkillKeys.add(skillKey);
    await replayEvidenceTarget(client, userId, evidence, evaluation.activityType);
  }
  return {
    attemptId: attempt.attemptId,
    status: 'accepted',
    isCorrect: evaluation.correct,
    evidence: publicEvidence(evaluation.evidence),
  };
}

export async function processAttemptsBatchV2(
  client: PoolClient,
  userId: string,
  request: AttemptsBatchRequestV2,
): Promise<AttemptsBatchResponseDataV2 | null> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const batchHash = requestSha256(request);
  const replay = await findBatchReplay(client, userId, request, batchHash);
  if (replay) return replay;

  const sessionResult = await client.query<SessionRow>(
    `select status
     from public.learning_sessions
     where id = $1 and user_id = $2`,
    [request.sessionId, userId],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const activities = await loadActivities(
    client,
    userId,
    request.sessionId,
    request.attempts.map((attempt) => attempt.sessionActivityId),
  );
  const ordered = [...request.attempts].sort(
    (left, right) =>
      Date.parse(left.occurredAt) - Date.parse(right.occurredAt) ||
      left.offlineSequence - right.offlineSequence ||
      left.attemptId.localeCompare(right.attemptId),
  );
  const results: AttemptBatchResultV2[] = [];
  for (const attempt of ordered) {
    results.push(
      await processAttempt(client, userId, request.sessionId, session.status, activities, attempt),
    );
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
  const response = AttemptsBatchResponseDataV2Schema.parse({
    schemaVersion: 'attempts-batch-response-v2',
    sessionId: request.sessionId,
    results,
    syncCursor: latest
      ? `${latest.received_at.toISOString()}:${latest.id}`
      : `empty:${request.sessionId}`,
  });
  await client.query(
    `insert into public.attempt_batch_v2_events (
       session_id, user_id, idempotency_key, request_sha256, result_snapshot
     ) values ($1, $2, $3, $4, $5)`,
    [request.sessionId, userId, request.idempotencyKey, batchHash, response],
  );
  return response;
}
