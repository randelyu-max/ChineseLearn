import { z } from 'zod';

import { LearningExerciseV2Schema } from './exercise-v2.ts';
import { EvidenceTargetV1Schema } from './session-activity-v2.ts';

export const PINYIN_LESSON_EXERCISE_V1_SCHEMA_VERSION = 'pinyin-lesson-exercise-v1' as const;
export const PINYIN_EXERCISES_CLIENT_CAPABILITY = 'pinyin-exercises-v1' as const;

export const PinyinSkillTypeSchema = z.enum(['initial', 'final', 'syllable', 'tone']);

const PinyinExerciseSchema = LearningExerciseV2Schema.refine(
  (exercise) =>
    [
      'audio_to_pinyin',
      'pinyin_to_audio',
      'pinyin_to_glyph',
      'glyph_to_pinyin',
      'tone_choice',
      'pinyin_syllable_build',
    ].includes(exercise.type),
  'Expected one of the six formal Pinyin exercise types.',
);

export const PinyinLessonExerciseV1Schema = z
  .object({
    schemaVersion: z.literal(PINYIN_LESSON_EXERCISE_V1_SCHEMA_VERSION),
    minimumClientCapability: z.literal(PINYIN_EXERCISES_CLIENT_CAPABILITY),
    exercise: PinyinExerciseSchema,
    evidenceTargets: z.array(EvidenceTargetV1Schema).min(1).max(20),
    pinyinSkillType: PinyinSkillTypeSchema,
    pinyinSupportApplicable: z.literal(false),
    estimatedSeconds: z.number().int().min(10).max(300),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.evidenceTargets.some((target) => target.skill !== source.exercise.type)) {
      context.addIssue({
        code: 'custom',
        message: 'Every Pinyin Evidence target skill must match the exercise type.',
        path: ['evidenceTargets'],
      });
    }
    if (!source.evidenceTargets.some((target) => target.conceptType === 'pinyin')) {
      context.addIssue({
        code: 'custom',
        message: 'Every Pinyin exercise requires a Pinyin concept target.',
        path: ['evidenceTargets'],
      });
    }
    if (
      source.exercise.type === 'tone_choice' &&
      !source.evidenceTargets.some(
        (target) =>
          target.conceptType === 'pinyin' &&
          target.abilityAxis === 'tone_discrimination' &&
          target.role === 'primary',
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Tone choice requires a primary Pinyin tone-discrimination target.',
        path: ['evidenceTargets'],
      });
    }
    if (
      source.exercise.type === 'pinyin_to_glyph' &&
      (!source.evidenceTargets.some(
        (target) => target.conceptType === 'pinyin' && target.abilityAxis === 'pinyin_recognition',
      ) ||
        !source.evidenceTargets.some(
          (target) =>
            target.conceptType === 'character' && target.abilityAxis === 'hanzi_recognition',
        ))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Pinyin-to-glyph requires explicit Pinyin and Hanzi Evidence targets.',
        path: ['evidenceTargets'],
      });
    }
  });

export type PinyinLessonExerciseV1 = z.infer<typeof PinyinLessonExerciseV1Schema>;
export type PinyinSkillType = z.infer<typeof PinyinSkillTypeSchema>;
