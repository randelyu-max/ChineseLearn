import {
  ActiveSessionDataSchema,
  SessionLifecycleStateSchema,
  SessionPlanResultV2Schema,
  SessionPlanSnapshotV2Schema,
  type ActiveSessionData,
  type SessionLifecycleState,
  type SessionPlanResultV2,
} from '@hanziquest/contracts';

import {
  FormalSessionCacheRecordSchema,
  type FormalSessionCacheRecord,
} from '../offline-storage/model';

export class FormalSessionDataError extends Error {
  constructor(
    readonly code:
      | 'ACTIVE_SESSION_REQUIRED'
      | 'SESSION_ID_MISMATCH'
      | 'SNAPSHOT_SCHEMA_DOWNGRADE'
      | 'TERMINAL_SESSION_REQUIRED',
    message: string,
  ) {
    super(message);
  }
}

export function cacheRecordFromActiveSession(
  userId: string,
  input: ActiveSessionData,
  nowIso: string,
): FormalSessionCacheRecord {
  const active = ActiveSessionDataSchema.parse(input);
  if (active.availability !== 'active') {
    throw new FormalSessionDataError(
      'ACTIVE_SESSION_REQUIRED',
      'An active server Session is required for caching.',
    );
  }
  if (
    active.session.header.snapshotSchemaVersion !== 'session-plan-snapshot-v2' ||
    active.session.snapshot.plan.schemaVersion !== 'session-plan-snapshot-v2'
  ) {
    throw new FormalSessionDataError(
      'SNAPSHOT_SCHEMA_DOWNGRADE',
      'Only the formal V2 Session snapshot may enter the production cache.',
    );
  }
  const plan = SessionPlanSnapshotV2Schema.parse(active.session.snapshot.plan);
  return FormalSessionCacheRecordSchema.parse({
    schemaVersion: 'formal-session-cache-v2',
    userId,
    sessionId: active.session.header.sessionId,
    snapshotSchemaVersion: 'session-plan-snapshot-v2',
    status: active.session.header.status,
    intent: active.session.header.intent,
    clientSessionId: active.session.header.clientSessionId,
    targetMinutes: active.session.header.targetMinutes,
    curriculumVersionId: active.session.header.curriculumVersionId,
    createdAt: active.session.header.createdAt,
    startedAt: active.session.header.startedAt,
    completedAt: null,
    abandonedAt: null,
    plan,
    activities: active.session.snapshot.activities,
    currentActivityPosition: 0,
    updatedAt: nowIso,
  });
}

export function cacheRecordFromPlanResult(
  userId: string,
  input: SessionPlanResultV2,
  nowIso: string,
): FormalSessionCacheRecord | null {
  const result = SessionPlanResultV2Schema.parse(input);
  if (result.session === null) return null;
  if (result.session.snapshot.schemaVersion !== 'session-plan-snapshot-v2') {
    throw new FormalSessionDataError(
      'SNAPSHOT_SCHEMA_DOWNGRADE',
      'A V1 or Demo Session cannot enter the formal V2 cache.',
    );
  }
  const plan = SessionPlanSnapshotV2Schema.parse(result.session.snapshot);
  return FormalSessionCacheRecordSchema.parse({
    schemaVersion: 'formal-session-cache-v2',
    userId,
    sessionId: result.session.sessionId,
    snapshotSchemaVersion: 'session-plan-snapshot-v2',
    status: result.session.status,
    intent: plan.intent,
    clientSessionId: result.session.clientSessionId,
    targetMinutes: plan.targetMinutes,
    curriculumVersionId: plan.curriculumVersionId,
    createdAt: result.session.createdAt,
    startedAt: null,
    completedAt: null,
    abandonedAt: null,
    plan,
    activities: plan.activities,
    currentActivityPosition: 0,
    updatedAt: nowIso,
  });
}

export function applyLifecycleState(
  record: FormalSessionCacheRecord,
  input: SessionLifecycleState,
  nowIso: string,
): FormalSessionCacheRecord {
  const state = SessionLifecycleStateSchema.parse(input);
  if (state.sessionId !== record.sessionId) {
    throw new FormalSessionDataError(
      'SESSION_ID_MISMATCH',
      'Lifecycle state must identify the cached Session.',
    );
  }
  return FormalSessionCacheRecordSchema.parse({
    ...record,
    status: state.status,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    abandonedAt: state.abandonedAt,
    updatedAt: nowIso,
  });
}
