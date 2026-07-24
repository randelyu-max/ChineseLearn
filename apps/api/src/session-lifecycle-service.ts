import {
  ActiveSessionDataSchema,
  SessionLifecycleStateSchema,
  type ActiveSessionData,
  type SessionAbandonRequest,
  type SessionLifecycleAction,
  type SessionLifecycleRequest,
  type SessionLifecycleState,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

type SessionRow = {
  abandoned_at: Date | null;
  abandoned_reason: string | null;
  client_session_id: string;
  completed_at: Date | null;
  created_at: Date;
  curriculum_version_id: string;
  id: string;
  intent: 'learn' | 'review';
  plan: unknown;
  snapshot_schema_version: 'session-plan-snapshot-v2' | null;
  started_at: Date | null;
  status: 'abandoned' | 'completed' | 'in_progress' | 'planned';
  target_minutes: number;
};

type ActivityRow = {
  content_ref: string;
  content_sha256: string;
  content_version: string;
  created_at: Date;
  estimated_seconds: number;
  evidence_targets: unknown;
  exercise_snapshot: unknown;
  exercise_type: string;
  humor_content_ref: string | null;
  id: string;
  pinyin_support: unknown;
  position: number;
  source_exercise_id: string;
};

type LifecycleEventRow = {
  action: SessionLifecycleAction;
  result_snapshot: unknown;
  session_id: string;
};

type CompletionCountRow = {
  activity_count: string;
  attempted_activity_count: string;
};

export class SessionLifecycleServiceError extends Error {
  constructor(
    readonly code:
      | 'SESSION_ACTIVITY_INCOMPLETE'
      | 'SESSION_IDEMPOTENCY_CONFLICT'
      | 'SESSION_NOT_FOUND'
      | 'SESSION_TRANSITION_INVALID',
    message: string,
  ) {
    super(message);
  }
}

function lifecycleState(row: SessionRow): SessionLifecycleState {
  return SessionLifecycleStateSchema.parse({
    schemaVersion: 'session-lifecycle-v1',
    sessionId: row.id,
    status: row.status,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    abandonedAt: row.abandoned_at?.toISOString() ?? null,
    abandonedReason: row.abandoned_reason,
  });
}

async function sessionForUpdate(
  client: PoolClient,
  userId: string,
  sessionId: string,
): Promise<SessionRow | null> {
  const result = await client.query<SessionRow>(
    `select
       id, client_session_id, curriculum_version_id, intent, status, target_minutes,
       snapshot_schema_version, plan, started_at, completed_at, abandoned_at,
       abandoned_reason, created_at
     from public.learning_sessions
     where id = $1 and user_id = $2
     for update`,
    [sessionId, userId],
  );
  return result.rows[0] ?? null;
}

async function replayedEvent(
  client: PoolClient,
  userId: string,
  idempotencyKey: string,
): Promise<LifecycleEventRow | null> {
  const result = await client.query<LifecycleEventRow>(
    `select session_id, action, result_snapshot
     from public.learning_session_lifecycle_events
     where user_id = $1 and idempotency_key = $2`,
    [userId, idempotencyKey],
  );
  return result.rows[0] ?? null;
}

async function assertCompletionEvidence(
  client: PoolClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  const counts = await client.query<CompletionCountRow>(
    `select
       count(*)::text as activity_count,
       count(*) filter (
         where exists (
           select 1
           from public.attempts a
           where a.session_id = lsa.session_id
             and a.user_id = lsa.user_id
             and (
               a.session_activity_id = lsa.id
               or (
                 a.session_activity_id is null
                 and a.metadata ->> 'activityId' = lsa.source_exercise_id
               )
             )
         )
       )::text as attempted_activity_count
     from public.learning_session_activities lsa
     where lsa.session_id = $1 and lsa.user_id = $2`,
    [sessionId, userId],
  );
  const activityCount = Number(counts.rows[0]?.activity_count ?? 0);
  const attemptedActivityCount = Number(counts.rows[0]?.attempted_activity_count ?? 0);
  if (activityCount > 0 && attemptedActivityCount !== activityCount) {
    throw new SessionLifecycleServiceError(
      'SESSION_ACTIVITY_INCOMPLETE',
      'Every Session activity requires an accepted attempt before completion.',
    );
  }
  if (activityCount === 0) {
    const legacyAttempts = await client.query(
      `select 1
       from public.attempts
       where session_id = $1 and user_id = $2
       limit 1`,
      [sessionId, userId],
    );
    if (legacyAttempts.rowCount === 0) {
      throw new SessionLifecycleServiceError(
        'SESSION_ACTIVITY_INCOMPLETE',
        'The legacy Session requires an accepted attempt before completion.',
      );
    }
  }
}

function targetStatus(action: SessionLifecycleAction) {
  switch (action) {
    case 'start':
      return 'in_progress' as const;
    case 'complete':
      return 'completed' as const;
    case 'abandon':
      return 'abandoned' as const;
  }
}

function transitionAllowed(current: SessionRow['status'], action: SessionLifecycleAction): boolean {
  if (current === targetStatus(action)) return true;
  if (action === 'start') return current === 'planned';
  if (action === 'complete') return current === 'in_progress';
  return current === 'planned' || current === 'in_progress';
}

export async function transitionSession(
  client: PoolClient,
  userId: string,
  sessionId: string,
  action: SessionLifecycleAction,
  request: SessionLifecycleRequest | SessionAbandonRequest,
): Promise<SessionLifecycleState> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const replay = await replayedEvent(client, userId, request.idempotencyKey);
  if (replay) {
    if (replay.session_id !== sessionId || replay.action !== action) {
      throw new SessionLifecycleServiceError(
        'SESSION_IDEMPOTENCY_CONFLICT',
        'The idempotency key belongs to another Session lifecycle action.',
      );
    }
    return SessionLifecycleStateSchema.parse(replay.result_snapshot);
  }

  const session = await sessionForUpdate(client, userId, sessionId);
  if (!session) {
    throw new SessionLifecycleServiceError(
      'SESSION_NOT_FOUND',
      'The learning Session was not found.',
    );
  }
  if (!transitionAllowed(session.status, action)) {
    throw new SessionLifecycleServiceError(
      'SESSION_TRANSITION_INVALID',
      `A ${session.status} Session cannot ${action}.`,
    );
  }

  const target = targetStatus(action);
  let state: SessionLifecycleState;
  if (session.status === target) {
    state = lifecycleState(session);
  } else {
    if (action === 'complete') await assertCompletionEvidence(client, userId, sessionId);
    const reasonCode =
      action === 'abandon' && 'reasonCode' in request ? (request.reasonCode ?? null) : null;
    const updated = await client.query<SessionRow>(
      `update public.learning_sessions
       set status = $3, abandoned_reason = $4
       where id = $1 and user_id = $2
       returning
         id, client_session_id, curriculum_version_id, intent, status, target_minutes,
         snapshot_schema_version, plan, started_at, completed_at, abandoned_at,
         abandoned_reason, created_at`,
      [sessionId, userId, target, reasonCode],
    );
    const updatedSession = updated.rows[0];
    if (!updatedSession) {
      throw new SessionLifecycleServiceError(
        'SESSION_NOT_FOUND',
        'The learning Session was not found.',
      );
    }
    state = lifecycleState(updatedSession);
  }

  await client.query(
    `insert into public.learning_session_lifecycle_events (
       session_id, user_id, idempotency_key, action, from_status, to_status,
       result_snapshot
     ) values ($1, $2, $3, $4, $5, $6, $7)`,
    [sessionId, userId, request.idempotencyKey, action, session.status, state.status, state],
  );
  return state;
}

export async function loadActiveSession(
  client: PoolClient,
  userId: string,
): Promise<ActiveSessionData> {
  const result = await client.query<SessionRow>(
    `select
       id, client_session_id, curriculum_version_id, intent, status, target_minutes,
       snapshot_schema_version, plan, started_at, completed_at, abandoned_at,
       abandoned_reason, created_at
     from public.learning_sessions
     where user_id = $1 and status in ('planned', 'in_progress')
     order by created_at desc, id desc
     limit 1`,
    [userId],
  );
  const session = result.rows[0];
  if (!session) {
    return ActiveSessionDataSchema.parse({
      schemaVersion: 'active-session-v1',
      availability: 'none',
      session: null,
    });
  }
  const activities = await client.query<ActivityRow>(
    `select
       id, position, source_exercise_id, exercise_type, content_ref, content_version,
       content_sha256, exercise_snapshot, evidence_targets, pinyin_support,
       humor_content_ref, estimated_seconds, created_at
     from public.learning_session_activities
     where session_id = $1 and user_id = $2
     order by position`,
    [session.id, userId],
  );
  return ActiveSessionDataSchema.parse({
    schemaVersion: 'active-session-v1',
    availability: 'active',
    session: {
      header: {
        sessionId: session.id,
        clientSessionId: session.client_session_id,
        intent: session.intent,
        status: session.status,
        targetMinutes: session.target_minutes,
        snapshotSchemaVersion: session.snapshot_schema_version,
        curriculumVersionId: session.curriculum_version_id,
        createdAt: session.created_at.toISOString(),
        startedAt: session.started_at?.toISOString() ?? null,
      },
      snapshot: {
        plan: session.plan,
        activities: activities.rows.map((activity) => ({
          schemaVersion: 'session-activity-v2',
          sessionActivityId: activity.id,
          sourceExerciseId: activity.source_exercise_id,
          position: activity.position,
          exerciseType: activity.exercise_type,
          contentRef: activity.content_ref,
          contentVersion: activity.content_version,
          contentSha256: activity.content_sha256,
          exercise: activity.exercise_snapshot,
          evidenceTargets: activity.evidence_targets,
          pinyinSupport: activity.pinyin_support,
          humorContentRef: activity.humor_content_ref,
          estimatedSeconds: activity.estimated_seconds,
        })),
      },
    },
  });
}
