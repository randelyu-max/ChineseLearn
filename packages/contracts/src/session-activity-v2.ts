import { z } from 'zod';

import {
  LearningExerciseV2Schema,
  LearningExerciseV2TypeSchema,
  StableLearningContentIdSchema,
} from './exercise-v2.ts';
import { UuidSchema } from './ids.ts';

export const SESSION_ACTIVITY_V2_SCHEMA_VERSION = 'session-activity-v2' as const;
export const EVIDENCE_TARGET_V1_SCHEMA_VERSION = 'evidence-target-v1' as const;
export const MAX_SESSION_ACTIVITIES_V2 = 20;

export const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/, 'Expected lowercase SHA-256.');

export const EvidenceTargetV1Schema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_TARGET_V1_SCHEMA_VERSION),
    conceptType: z.enum(['character', 'word', 'sentence', 'pinyin']),
    conceptId: StableLearningContentIdSchema,
    skill: StableLearningContentIdSchema,
    abilityAxis: z.enum([
      'spoken_audio_comprehension',
      'pinyin_recognition',
      'tone_discrimination',
      'hanzi_recognition',
      'word_reading',
      'sentence_reading',
      'confusion_discrimination',
    ]),
    role: z.enum(['primary', 'secondary', 'transfer']),
  })
  .strict();

export const PinyinSupportDecisionV2Schema = z
  .object({
    profileMode: z.enum(['always', 'adaptive', 'tap_to_reveal', 'hidden']),
    allowReveal: z.boolean(),
    fadeStage: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    initialEvidenceSupport: z.enum(['none', 'pinyin_visible']),
    presentation: z.enum(['visible', 'tap_to_reveal', 'hidden']),
    reason: z.enum([
      'preference_always',
      'preference_tap_to_reveal',
      'preference_hidden',
      'frustration_recovery',
      'support_not_yet_faded',
      'partial_fade',
      'sustained_independent_success',
    ]),
  })
  .strict()
  .superRefine((decision, context) => {
    const expectedPresentation =
      decision.profileMode === 'always'
        ? 'visible'
        : decision.profileMode === 'tap_to_reveal'
          ? 'tap_to_reveal'
          : decision.profileMode === 'hidden'
            ? 'hidden'
            : null;
    if (expectedPresentation !== null && decision.presentation !== expectedPresentation) {
      context.addIssue({
        code: 'custom',
        message: 'An explicit profile mode must determine presentation.',
        path: ['presentation'],
      });
    }
    if (
      (decision.presentation === 'visible') !==
      (decision.initialEvidenceSupport === 'pinyin_visible')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Visible Pinyin and initial evidence support must agree.',
        path: ['initialEvidenceSupport'],
      });
    }
    if (decision.presentation === 'hidden' && decision.allowReveal) {
      context.addIssue({
        code: 'custom',
        message: 'Hidden presentation cannot permit a reveal.',
        path: ['allowReveal'],
      });
    }
  });

export const SessionActivitySnapshotV2Schema = z
  .object({
    schemaVersion: z.literal(SESSION_ACTIVITY_V2_SCHEMA_VERSION),
    sessionActivityId: UuidSchema,
    sourceExerciseId: StableLearningContentIdSchema,
    position: z
      .number()
      .int()
      .min(0)
      .max(MAX_SESSION_ACTIVITIES_V2 - 1),
    exerciseType: LearningExerciseV2TypeSchema,
    contentRef: StableLearningContentIdSchema,
    contentVersion: z.string().trim().min(1).max(64),
    contentSha256: Sha256HexSchema,
    exercise: LearningExerciseV2Schema,
    evidenceTargets: z.array(EvidenceTargetV1Schema).min(1).max(20),
    pinyinSupport: PinyinSupportDecisionV2Schema.nullable(),
    humorContentRef: StableLearningContentIdSchema.nullable(),
    estimatedSeconds: z.number().int().min(10).max(300),
  })
  .strict()
  .superRefine((activity, context) => {
    if (activity.exercise.type !== activity.exerciseType) {
      context.addIssue({
        code: 'custom',
        message: 'Exercise type must match the embedded exercise.',
        path: ['exerciseType'],
      });
    }
    if (activity.exercise.activityId !== activity.sourceExerciseId) {
      context.addIssue({
        code: 'custom',
        message: 'Source exercise ID must match the embedded exercise.',
        path: ['sourceExerciseId'],
      });
    }
    const evidenceKeys = activity.evidenceTargets.map((target) =>
      [target.conceptType, target.conceptId, target.skill, target.abilityAxis, target.role].join(
        ':',
      ),
    );
    if (new Set(evidenceKeys).size !== evidenceKeys.length) {
      context.addIssue({
        code: 'custom',
        message: 'Evidence targets must not contain duplicates.',
        path: ['evidenceTargets'],
      });
    }
    if (!activity.evidenceTargets.some((target) => target.role === 'primary')) {
      context.addIssue({
        code: 'custom',
        message: 'Every activity requires at least one primary evidence target.',
        path: ['evidenceTargets'],
      });
    }
  });

export type EvidenceTargetV1 = z.infer<typeof EvidenceTargetV1Schema>;
export type PinyinSupportDecisionV2 = z.infer<typeof PinyinSupportDecisionV2Schema>;
export type SessionActivitySnapshotV2 = z.infer<typeof SessionActivitySnapshotV2Schema>;
