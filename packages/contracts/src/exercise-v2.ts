import { z } from 'zod';

import {
  PinyinFinalSchema,
  PinyinInitialSchema,
  PinyinToneSchema,
  canonicalPinyinBase,
  isLegalPinyinCombination,
  normalizePinyinSyllable,
} from './pinyin.ts';

export const LEARNING_EXERCISE_V2_SCHEMA_VERSION = 'learning-exercise-v2' as const;
export const LearningExerciseV2TypeSchema = z.enum([
  'audio_to_glyph',
  'glyph_to_image',
  'word_build',
  'sentence_order',
  'audio_to_pinyin',
  'pinyin_to_audio',
  'pinyin_to_glyph',
  'glyph_to_pinyin',
  'tone_choice',
  'pinyin_syllable_build',
]);

export const StableLearningContentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const HanGlyphSchema = z.string().regex(/^\p{Script=Han}$/u, 'Expected exactly one Han glyph.');
const BoundedZhSchema = z.string().trim().min(1).max(160);
const AccessibilityTextSchema = z.string().trim().min(1).max(200);
const AssetKeySchema = z.string().trim().min(1).max(200);
const PinyinNumberedSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .refine(
    (value) => normalizePinyinSyllable(value)?.numbered === value,
    'Expected canonical numbered Pinyin.',
  );

const ExerciseHeaderShape = {
  schemaVersion: z.literal(LEARNING_EXERCISE_V2_SCHEMA_VERSION),
  activityId: StableLearningContentIdSchema,
  instructionZh: BoundedZhSchema,
  instructionAccessibilityLabel: AccessibilityTextSchema,
};

function addDuplicateIssue(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  message: string,
): void {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: 'custom', message, path });
  }
}

function addCorrectReferenceIssue(
  optionIds: readonly string[],
  correctOptionId: string,
  context: z.RefinementCtx,
): void {
  if (!optionIds.includes(correctOptionId)) {
    context.addIssue({
      code: 'custom',
      message: 'The correct answer must reference an included option.',
      path: ['correctOptionId'],
    });
  }
}

const GlyphOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    glyph: HanGlyphSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const AudioToGlyphExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('audio_to_glyph'),
    promptAudioAssetKey: AssetKeySchema,
    options: z.array(GlyphOptionSchema).min(2).max(5),
    correctOptionId: StableLearningContentIdSchema,
    visualHintZh: BoundedZhSchema.nullable(),
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.glyph),
      context,
      ['options'],
      'Glyph options must be visually distinct.',
    );
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
  });

const ImageOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    imageAssetKey: AssetKeySchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const GlyphToImageExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('glyph_to_image'),
    promptGlyph: HanGlyphSchema,
    promptAccessibilityLabel: AccessibilityTextSchema,
    options: z.array(ImageOptionSchema).min(2).max(5),
    correctOptionId: StableLearningContentIdSchema,
    visualHintZh: BoundedZhSchema.nullable(),
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.imageAssetKey),
      context,
      ['options'],
      'Image options must use distinct assets.',
    );
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
  });

const WordBuildTileV2Schema = z
  .object({
    tileId: StableLearningContentIdSchema,
    glyph: HanGlyphSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const WordBuildExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('word_build'),
    promptZh: BoundedZhSchema,
    promptAudioAssetKey: AssetKeySchema.nullable(),
    targetWord: z.string().trim().min(2).max(12),
    tiles: z.array(WordBuildTileV2Schema).min(2).max(12),
    correctTileOrder: z.array(StableLearningContentIdSchema).min(2).max(12),
    visualHintZh: BoundedZhSchema.nullable(),
  })
  .strict()
  .superRefine((exercise, context) => {
    const tileIds = exercise.tiles.map((tile) => tile.tileId);
    addDuplicateIssue(tileIds, context, ['tiles'], 'Tile IDs must be unique.');
    addDuplicateIssue(
      exercise.tiles.map((tile) => tile.glyph),
      context,
      ['tiles'],
      'Repeated glyph tiles create an ambiguous answer.',
    );
    const order = exercise.correctTileOrder;
    if (
      new Set(order).size !== order.length ||
      order.length !== tileIds.length ||
      order.some((tileId) => !tileIds.includes(tileId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The correct order must reference every tile exactly once.',
        path: ['correctTileOrder'],
      });
      return;
    }
    const glyphById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile.glyph]));
    if (order.map((tileId) => glyphById.get(tileId) ?? '').join('') !== exercise.targetWord) {
      context.addIssue({
        code: 'custom',
        message: 'The correct order must assemble the target word.',
        path: ['targetWord'],
      });
    }
  });

const SentenceTileV2Schema = z
  .object({
    tileId: StableLearningContentIdSchema,
    text: z.string().trim().min(1).max(24),
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const SentenceOrderExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('sentence_order'),
    promptZh: BoundedZhSchema,
    promptAudioAssetKey: AssetKeySchema.nullable(),
    targetSentence: z.string().trim().min(2).max(120),
    tiles: z.array(SentenceTileV2Schema).min(2).max(16),
    correctTileOrder: z.array(StableLearningContentIdSchema).min(2).max(16),
    visualHintZh: BoundedZhSchema.nullable(),
  })
  .strict()
  .superRefine((exercise, context) => {
    const tileIds = exercise.tiles.map((tile) => tile.tileId);
    addDuplicateIssue(tileIds, context, ['tiles'], 'Tile IDs must be unique.');
    addDuplicateIssue(
      exercise.tiles.map((tile) => tile.text),
      context,
      ['tiles'],
      'Repeated sentence tiles create an ambiguous answer.',
    );
    const order = exercise.correctTileOrder;
    if (
      new Set(order).size !== order.length ||
      order.length !== tileIds.length ||
      order.some((tileId) => !tileIds.includes(tileId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The correct order must reference every tile exactly once.',
        path: ['correctTileOrder'],
      });
      return;
    }
    const textById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile.text]));
    if (order.map((tileId) => textById.get(tileId) ?? '').join('') !== exercise.targetSentence) {
      context.addIssue({
        code: 'custom',
        message: 'The correct order must assemble the target sentence.',
        path: ['targetSentence'],
      });
    }
  });

const PinyinPromptSchema = z
  .object({
    display: z.string().trim().min(1).max(12),
    numbered: PinyinNumberedSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict()
  .superRefine((prompt, context) => {
    const normalized = normalizePinyinSyllable(prompt.numbered);
    if (normalized && normalized.display !== prompt.display) {
      context.addIssue({
        code: 'custom',
        message: 'Pinyin display must match the normalized numbered syllable.',
        path: ['display'],
      });
    }
  });

const PinyinOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    display: z.string().trim().min(1).max(12),
    numbered: PinyinNumberedSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict()
  .superRefine((option, context) => {
    const normalized = normalizePinyinSyllable(option.numbered);
    if (normalized && normalized.display !== option.display) {
      context.addIssue({
        code: 'custom',
        message: 'Pinyin display must match the normalized numbered syllable.',
        path: ['display'],
      });
    }
  });

export const AudioToPinyinExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('audio_to_pinyin'),
    promptAudioAssetKey: AssetKeySchema,
    options: z.array(PinyinOptionSchema).min(2).max(5),
    correctOptionId: StableLearningContentIdSchema,
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.numbered),
      context,
      ['options'],
      'Pinyin options must have distinct readings.',
    );
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
  });

const AudioOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    audioAssetKey: AssetKeySchema,
    numbered: PinyinNumberedSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const PinyinToAudioExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('pinyin_to_audio'),
    prompt: PinyinPromptSchema,
    options: z.array(AudioOptionSchema).min(3).max(5),
    correctOptionId: StableLearningContentIdSchema,
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.audioAssetKey),
      context,
      ['options'],
      'Audio options must use distinct assets.',
    );
    addDuplicateIssue(
      exercise.options.map((option) => option.numbered),
      context,
      ['options'],
      'Audio options must have distinct readings.',
    );
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
    const answer = exercise.options.find((option) => option.optionId === exercise.correctOptionId);
    if (answer && answer.numbered !== exercise.prompt.numbered) {
      context.addIssue({
        code: 'custom',
        message: 'The correct audio must match the prompt reading.',
        path: ['correctOptionId'],
      });
    }
  });

const PinyinGlyphOptionSchema = GlyphOptionSchema.extend({
  numbered: PinyinNumberedSchema,
}).strict();

export const PinyinToGlyphExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('pinyin_to_glyph'),
    prompt: PinyinPromptSchema,
    contextHintZh: BoundedZhSchema.nullable(),
    options: z.array(PinyinGlyphOptionSchema).min(3).max(5),
    correctOptionId: StableLearningContentIdSchema,
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.glyph),
      context,
      ['options'],
      'Glyph options must be distinct.',
    );
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
    const answer = exercise.options.find((option) => option.optionId === exercise.correctOptionId);
    if (answer && answer.numbered !== exercise.prompt.numbered) {
      context.addIssue({
        code: 'custom',
        message: 'The correct glyph reading must match the prompt.',
        path: ['correctOptionId'],
      });
    }
    const exactReadingCount = exercise.options.filter(
      (option) => option.numbered === exercise.prompt.numbered,
    ).length;
    if (exactReadingCount > 1 && exercise.contextHintZh === null) {
      context.addIssue({
        code: 'custom',
        message: 'Homophone choices require a Chinese context hint.',
        path: ['contextHintZh'],
      });
    }
  });

export const GlyphToPinyinExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('glyph_to_pinyin'),
    targetGlyph: HanGlyphSchema,
    targetAccessibilityLabel: AccessibilityTextSchema,
    contextZh: BoundedZhSchema.nullable(),
    knownReadings: z.array(PinyinNumberedSchema).min(1).max(8),
    options: z.array(PinyinOptionSchema).min(3).max(5),
    acceptedOptionIds: z.array(StableLearningContentIdSchema).min(1).max(5),
    hintZh: BoundedZhSchema.nullable(),
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => option.numbered),
      context,
      ['options'],
      'Pinyin options must have distinct readings.',
    );
    addDuplicateIssue(
      exercise.knownReadings,
      context,
      ['knownReadings'],
      'Known readings must be unique.',
    );
    addDuplicateIssue(
      exercise.acceptedOptionIds,
      context,
      ['acceptedOptionIds'],
      'Accepted answer IDs must be unique.',
    );
    if (exercise.acceptedOptionIds.some((optionId) => !ids.includes(optionId))) {
      context.addIssue({
        code: 'custom',
        message: 'Every accepted answer must reference an included option.',
        path: ['acceptedOptionIds'],
      });
    }
    const readingById = new Map(
      exercise.options.map((option) => [option.optionId, option.numbered]),
    );
    if (
      exercise.acceptedOptionIds.some(
        (optionId) => !exercise.knownReadings.includes(readingById.get(optionId) ?? ''),
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Accepted answers must be declared readings of the glyph.',
        path: ['acceptedOptionIds'],
      });
    }
    if (
      exercise.knownReadings.length > 1 &&
      (exercise.contextZh === null || !exercise.contextZh.includes(exercise.targetGlyph))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Polyphonic glyphs require context containing the target glyph.',
        path: ['contextZh'],
      });
    }
  });

const ToneOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    tone: PinyinToneSchema,
    display: z.string().trim().min(1).max(12),
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const ToneChoiceExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('tone_choice'),
    promptAudioAssetKey: AssetKeySchema.nullable(),
    baseSyllable: z.string().trim().min(1).max(8),
    targetSyllable: PinyinNumberedSchema,
    contextZh: BoundedZhSchema.nullable(),
    options: z.array(ToneOptionSchema).length(5),
    correctOptionId: StableLearningContentIdSchema,
  })
  .strict()
  .superRefine((exercise, context) => {
    const target = normalizePinyinSyllable(exercise.targetSyllable);
    if (target && target.base !== exercise.baseSyllable) {
      context.addIssue({
        code: 'custom',
        message: 'The base syllable must match the target.',
        path: ['baseSyllable'],
      });
    }
    const ids = exercise.options.map((option) => option.optionId);
    addDuplicateIssue(ids, context, ['options'], 'Option IDs must be unique.');
    addDuplicateIssue(
      exercise.options.map((option) => String(option.tone)),
      context,
      ['options'],
      'The five tone options must be distinct.',
    );
    if (
      exercise.options
        .map((option) => option.tone)
        .sort()
        .join(',') !== '1,2,3,4,5'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Tone choice must contain tones one through five.',
        path: ['options'],
      });
    }
    addCorrectReferenceIssue(ids, exercise.correctOptionId, context);
    const answer = exercise.options.find((option) => option.optionId === exercise.correctOptionId);
    if (target && answer && answer.tone !== target.tone) {
      context.addIssue({
        code: 'custom',
        message: 'The correct option tone must match the target.',
        path: ['correctOptionId'],
      });
    }
    for (const [index, option] of exercise.options.entries()) {
      const normalized = normalizePinyinSyllable(`${exercise.baseSyllable}${option.tone}`);
      if (!normalized || normalized.display !== option.display) {
        context.addIssue({
          code: 'custom',
          message: 'Tone option display must match its canonical tone.',
          path: ['options', index, 'display'],
        });
      }
    }
  });

const InitialOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    value: PinyinInitialSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();
const FinalOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    value: PinyinFinalSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();
const BuildToneOptionSchema = z
  .object({
    optionId: StableLearningContentIdSchema,
    value: PinyinToneSchema,
    accessibilityLabel: AccessibilityTextSchema,
  })
  .strict();

export const PinyinSyllableBuildExerciseV2Schema = z
  .object({
    ...ExerciseHeaderShape,
    type: z.literal('pinyin_syllable_build'),
    targetSyllable: PinyinNumberedSchema,
    initialOptions: z.array(InitialOptionSchema).min(2).max(24),
    finalOptions: z.array(FinalOptionSchema).min(2).max(40),
    toneOptions: z.array(BuildToneOptionSchema).min(2).max(5),
    correctInitialOptionId: StableLearningContentIdSchema,
    correctFinalOptionId: StableLearningContentIdSchema,
    correctToneOptionId: StableLearningContentIdSchema,
  })
  .strict()
  .superRefine((exercise, context) => {
    const groups = [
      {
        name: 'initialOptions',
        values: exercise.initialOptions,
        correct: exercise.correctInitialOptionId,
      },
      {
        name: 'finalOptions',
        values: exercise.finalOptions,
        correct: exercise.correctFinalOptionId,
      },
      {
        name: 'toneOptions',
        values: exercise.toneOptions,
        correct: exercise.correctToneOptionId,
      },
    ] as const;
    for (const group of groups) {
      addDuplicateIssue(
        group.values.map((option) => option.optionId),
        context,
        [group.name],
        'Option IDs must be unique within each assembly step.',
      );
      addDuplicateIssue(
        group.values.map((option) => String(option.value)),
        context,
        [group.name],
        'Option values must be unique within each assembly step.',
      );
      if (!group.values.some((option) => option.optionId === group.correct)) {
        context.addIssue({
          code: 'custom',
          message: 'The correct answer must reference an included option.',
          path: [group.name],
        });
      }
    }
    const initial = exercise.initialOptions.find(
      (option) => option.optionId === exercise.correctInitialOptionId,
    )?.value;
    const final = exercise.finalOptions.find(
      (option) => option.optionId === exercise.correctFinalOptionId,
    )?.value;
    const tone = exercise.toneOptions.find(
      (option) => option.optionId === exercise.correctToneOptionId,
    )?.value;
    if (initial !== undefined && final !== undefined && !isLegalPinyinCombination(initial, final)) {
      context.addIssue({
        code: 'custom',
        message: 'The correct initial and final must form legal Mandarin Pinyin.',
        path: ['correctFinalOptionId'],
      });
      return;
    }
    if (initial !== undefined && final !== undefined && tone !== undefined) {
      const base = canonicalPinyinBase(initial, final);
      const normalized = base ? normalizePinyinSyllable(`${base}${tone}`) : null;
      if (!normalized || normalized.numbered !== exercise.targetSyllable) {
        context.addIssue({
          code: 'custom',
          message: 'The correct assembly must produce the target syllable.',
          path: ['targetSyllable'],
        });
      }
    }
  });

export const LearningExerciseV2Schema = z.discriminatedUnion('type', [
  AudioToGlyphExerciseV2Schema,
  GlyphToImageExerciseV2Schema,
  WordBuildExerciseV2Schema,
  SentenceOrderExerciseV2Schema,
  AudioToPinyinExerciseV2Schema,
  PinyinToAudioExerciseV2Schema,
  PinyinToGlyphExerciseV2Schema,
  GlyphToPinyinExerciseV2Schema,
  ToneChoiceExerciseV2Schema,
  PinyinSyllableBuildExerciseV2Schema,
]);

export type LearningExerciseV2 = z.infer<typeof LearningExerciseV2Schema>;
export type LearningExerciseV2Type = z.infer<typeof LearningExerciseV2TypeSchema>;
