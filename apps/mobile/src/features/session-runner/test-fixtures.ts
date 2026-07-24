import {
  LearningExerciseV2Schema,
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
  '53000000-0000-4000-8000-000000000005',
  '53000000-0000-4000-8000-000000000006',
  '53000000-0000-4000-8000-000000000007',
  '53000000-0000-4000-8000-000000000008',
  '53000000-0000-4000-8000-000000000009',
  '53000000-0000-4000-8000-000000000010',
] as const;

const supportedExercises = learningExerciseV2Fixtures.map((exercise) => {
  if (exercise.type === 'audio_to_pinyin') {
    return LearningExerciseV2Schema.parse({
      ...exercise,
      promptAudioAssetKey: '50000000-0000-4000-8000-000000000402',
    });
  }
  if (exercise.type === 'pinyin_to_audio') {
    const audio = [
      ['50000000-0000-4000-8000-000000000403', 'ma4'],
      ['50000000-0000-4000-8000-000000000401', 'ma2'],
      ['50000000-0000-4000-8000-000000000402', 'ma3'],
    ] as const;
    return LearningExerciseV2Schema.parse({
      ...exercise,
      options: exercise.options.map((option, index) => ({
        ...option,
        audioAssetKey: audio[index]![0],
        numbered: audio[index]![1],
      })),
    });
  }
  if (exercise.type === 'tone_choice') {
    return LearningExerciseV2Schema.parse({ ...exercise, promptAudioAssetKey: null });
  }
  return exercise;
});
const hashCharacters = '123456789a';

export const runnerActivities: SessionActivitySnapshotV2[] = supportedExercises.map(
  (exercise, position) => ({
    schemaVersion: 'session-activity-v2',
    sessionActivityId: activityIds[position]!,
    sourceExerciseId: exercise.activityId,
    position,
    exerciseType: exercise.type,
    contentRef: `release.lesson-${position % 2}.exercise-${position}`,
    contentVersion: 'closed-alpha-runner-v1',
    contentSha256: hashCharacters[position]!.repeat(64),
    exercise,
    evidenceTargets: [
      {
        schemaVersion: 'evidence-target-v1',
        conceptType:
          exercise.type.includes('pinyin') || exercise.type === 'tone_choice'
            ? 'pinyin'
            : exercise.type === 'word_build'
              ? 'word'
              : exercise.type === 'sentence_order'
                ? 'sentence'
                : 'character',
        conceptId: `concept.runner.${position}`,
        skill: exercise.type,
        abilityAxis:
          exercise.type === 'tone_choice'
            ? 'tone_discrimination'
            : exercise.type.includes('pinyin')
              ? 'pinyin_recognition'
              : exercise.type === 'sentence_order'
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
    estimatedSeconds: 300,
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
  if (
    exercise.type === 'audio_to_pinyin' ||
    exercise.type === 'pinyin_to_audio' ||
    exercise.type === 'pinyin_to_glyph' ||
    exercise.type === 'tone_choice'
  ) {
    return { optionId: exercise.correctOptionId };
  }
  if (exercise.type === 'glyph_to_pinyin') {
    return { optionId: exercise.acceptedOptionIds[0]! };
  }
  if (exercise.type === 'pinyin_syllable_build') {
    return {
      tileIds: [
        exercise.correctInitialOptionId,
        exercise.correctFinalOptionId,
        exercise.correctToneOptionId,
      ],
    };
  }
  if (exercise.type === 'word_build' || exercise.type === 'sentence_order') {
    return { tileIds: [...exercise.correctTileOrder] };
  }
  throw new Error('Runner fixture includes an unsupported exercise.');
}
