import {
  learningExerciseV2Fixtures,
  type ActiveSessionData,
  type AttemptDraftV2,
  type SessionActivitySnapshotV2,
  type SessionLifecycleState,
  type SessionPlanResultV2,
  type SessionPlanSnapshotV2,
} from '@hanziquest/contracts';

export const USER_A = '10000000-0000-4000-8000-000000000001';
export const USER_B = '10000000-0000-4000-8000-000000000002';
export const SESSION_A = '20000000-0000-4000-8000-000000000001';
export const SESSION_B = '20000000-0000-4000-8000-000000000002';
export const ACTIVITY_A = '30000000-0000-4000-8000-000000000001';
export const NOW = '2026-07-24T10:00:00.000Z';

const exercise = learningExerciseV2Fixtures[0];

export const activityFixture: SessionActivitySnapshotV2 = {
  schemaVersion: 'session-activity-v2',
  sessionActivityId: ACTIVITY_A,
  sourceExerciseId: exercise.activityId,
  position: 0,
  exerciseType: exercise.type,
  contentRef: 'content.hanzi.water',
  contentVersion: 'curriculum-test-v1',
  contentSha256: 'a'.repeat(64),
  exercise,
  evidenceTargets: [
    {
      schemaVersion: 'evidence-target-v1',
      conceptType: 'character',
      conceptId: 'hanzi.water',
      skill: 'audio_to_glyph',
      abilityAxis: 'hanzi_recognition',
      role: 'primary',
    },
  ],
  pinyinSupport: null,
  humorContentRef: null,
  estimatedSeconds: 30,
};

export function planFixture(
  sessionId = SESSION_A,
  clientSessionId = '21000000-0000-4000-8000-000000000001',
): SessionPlanSnapshotV2 {
  return {
    schemaVersion: 'session-plan-snapshot-v2',
    sessionId,
    clientSessionId,
    intent: 'learn',
    curriculumVersionId: '22000000-0000-4000-8000-000000000001',
    contentManifestSha256: 'b'.repeat(64),
    humorContentVersion: 'humor-content-v1',
    humorPreference: 'light',
    planningAlgorithmVersion: 'pinyin-session-planner-v1+session-materializer-v2',
    targetMinutes: 10,
    estimatedSeconds: 30,
    createdAt: NOW,
    activities: [
      {
        ...activityFixture,
        sessionActivityId:
          sessionId === SESSION_A ? ACTIVITY_A : '30000000-0000-4000-8000-000000000002',
      },
    ],
  };
}

export function activeFixture(
  sessionId = SESSION_A,
  status: 'in_progress' | 'planned' = 'planned',
): ActiveSessionData {
  const plan = planFixture(
    sessionId,
    sessionId === SESSION_A
      ? '21000000-0000-4000-8000-000000000001'
      : '21000000-0000-4000-8000-000000000002',
  );
  return {
    schemaVersion: 'active-session-v1',
    availability: 'active',
    session: {
      header: {
        sessionId,
        clientSessionId: plan.clientSessionId,
        intent: plan.intent,
        status,
        targetMinutes: plan.targetMinutes,
        snapshotSchemaVersion: 'session-plan-snapshot-v2',
        curriculumVersionId: plan.curriculumVersionId,
        createdAt: NOW,
        startedAt: status === 'in_progress' ? '2026-07-24T10:01:00.000Z' : null,
      },
      snapshot: {
        plan,
        activities: plan.activities,
      },
    },
  };
}

export function plannedResultFixture(sessionId = SESSION_A): SessionPlanResultV2 {
  const plan = planFixture(sessionId);
  return {
    schemaVersion: 'session-plan-result-v2',
    result: 'planned',
    session: {
      sessionId,
      clientSessionId: plan.clientSessionId,
      status: 'planned',
      createdAt: NOW,
      snapshot: plan,
    },
  };
}

export const attemptV2Fixture: AttemptDraftV2 = {
  attemptId: '40000000-0000-4000-8000-000000000001',
  sessionActivityId: ACTIVITY_A,
  answer: { optionId: 'option.shui' },
  isCorrectClient: false,
  responseMs: 900,
  hintLevel: 'none',
  pinyinSupport: 'none',
  replayCount: 0,
  retryCount: 0,
  occurredAt: '2026-07-24T10:02:00.000Z',
  offlineSequence: 1,
};

export function lifecycleFixture(
  status: 'abandoned' | 'completed' | 'in_progress' | 'planned',
): SessionLifecycleState {
  return {
    schemaVersion: 'session-lifecycle-v1',
    sessionId: SESSION_A,
    status,
    startedAt: status === 'planned' ? null : '2026-07-24T10:01:00.000Z',
    completedAt: status === 'completed' ? '2026-07-24T10:05:00.000Z' : null,
    abandonedAt: status === 'abandoned' ? '2026-07-24T10:05:00.000Z' : null,
    abandonedReason: status === 'abandoned' ? 'user_requested' : null,
  };
}

export function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}
