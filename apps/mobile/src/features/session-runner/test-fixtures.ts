import {
  learningExerciseV2Fixtures,
  type ActiveSessionData,
  type SessionActivitySnapshotV2,
} from '@hanziquest/contracts';

import { cacheRecordFromActiveSession } from '../formal-session/model';
import type { FormalSessionCacheRecord } from '../offline-storage/model';

export const RUNNER_USER_ID = '51000000-0000-4000-8000-000000000001';
export const RUNNER_SESSION_ID = '52000000-0000-4000-8000-000000000001';
export const RUNNER_NOW = '2026-07-24T12:00:00.000Z';

const activityIds = [
  '53000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000002',
  '53000000-0000-4000-8000-000000000003',
  '53000000-0000-4000-8000-000000000004',
] as const;

const supportedExercises = learningExerciseV2Fixtures.slice(0, 4);

export const runnerActivities: SessionActivitySnapshotV2[] = supportedExercises.map(
  (exercise, position) => ({
    schemaVersion: 'session-activity-v2',
    sessionActivityId: activityIds[position]!,
    sourceExerciseId: exercise.activityId,
    position,
    exerciseType: exercise.type,
    contentRef: `release.lesson-${position % 2}.exercise-${position}`,
    contentVersion: 'closed-alpha-runner-v1',
    contentSha256: `${position + 1}`.repeat(64),
    exercise,
    evidenceTargets: [
      {
        schemaVersion: 'evidence-target-v1',
        conceptType:
          exercise.type === 'word_build'
            ? 'word'
            : exercise.type === 'sentence_order'
              ? 'sentence'
              : 'character',
        conceptId: `concept.runner.${position}`,
        skill: exercise.type,
        abilityAxis:
          exercise.type === 'sentence_order'
            ? 'sentence_reading'
            : exercise.type === 'word_build'
              ? 'word_reading'
              : 'hanzi_recognition',
        role: 'primary',
      },
    ],
    pinyinSupport:
      position === 0
        ? {
            profileMode: 'tap_to_reveal',
            allowReveal: true,
            fadeStage: 0,
            initialEvidenceSupport: 'none',
            presentation: 'tap_to_reveal',
            reason: 'preference_tap_to_reveal',
          }
        : null,
    humorContentRef: null,
    estimatedSeconds: 30,
  }),
);

export function runnerActiveData(
  status: 'in_progress' | 'planned' = 'in_progress',
): ActiveSessionData {
  const plan = {
    schemaVersion: 'session-plan-snapshot-v2' as const,
    sessionId: RUNNER_SESSION_ID,
    clientSessionId: '54000000-0000-4000-8000-000000000001',
    intent: 'learn' as const,
    curriculumVersionId: '55000000-0000-4000-8000-000000000001',
    contentManifestSha256: 'a'.repeat(64),
    humorContentVersion: 'humor-content-v1',
    humorPreference: 'light' as const,
    planningAlgorithmVersion: 'pinyin-session-planner-v1+session-materializer-v2',
    targetMinutes: 10,
    estimatedSeconds: 120,
    createdAt: RUNNER_NOW,
    activities: runnerActivities,
  };
  return {
    schemaVersion: 'active-session-v1',
    availability: 'active',
    session: {
      header: {
        sessionId: RUNNER_SESSION_ID,
        clientSessionId: plan.clientSessionId,
        intent: 'learn',
        status,
        targetMinutes: 10,
        snapshotSchemaVersion: 'session-plan-snapshot-v2',
        curriculumVersionId: plan.curriculumVersionId,
        createdAt: RUNNER_NOW,
        startedAt: status === 'in_progress' ? RUNNER_NOW : null,
      },
      snapshot: { plan, activities: runnerActivities },
    },
  };
}

export function runnerSession(
  status: 'in_progress' | 'planned' = 'in_progress',
): FormalSessionCacheRecord {
  return cacheRecordFromActiveSession(RUNNER_USER_ID, runnerActiveData(status), RUNNER_NOW);
}

export function correctAnswerAt(index: number) {
  const exercise = runnerActivities[index]?.exercise;
  if (!exercise) throw new Error('Runner fixture activity is missing.');
  if (exercise.type === 'audio_to_glyph' || exercise.type === 'glyph_to_image') {
    return { optionId: exercise.correctOptionId };
  }
  if (exercise.type === 'word_build' || exercise.type === 'sentence_order') {
    return { tileIds: [...exercise.correctTileOrder] };
  }
  throw new Error('Runner fixture includes an unsupported exercise.');
}
