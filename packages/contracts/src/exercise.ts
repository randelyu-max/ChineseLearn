import { z } from 'zod';

import { UuidSchema } from './ids.ts';

export const ExerciseOptionSchema = z
  .object({
    optionId: UuidSchema,
    glyph: z.string().regex(/^\p{Script=Han}$/u, 'Each option must contain exactly one Han glyph.'),
    accessibilityLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const AudioToGlyphExerciseSchema = z
  .object({
    activityId: UuidSchema,
    type: z.literal('audio_to_glyph'),
    promptAudioAssetId: UuidSchema,
    targetConceptIds: z.array(UuidSchema).min(1),
    options: z.array(ExerciseOptionSchema).min(2).max(4),
    correctOptionId: UuidSchema,
    visualHintZh: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((exercise, context) => {
    const ids = exercise.options.map((option) => option.optionId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Option IDs must be unique.',
        path: ['options'],
      });
    }
    if (!ids.includes(exercise.correctOptionId)) {
      context.addIssue({
        code: 'custom',
        message: 'correctOptionId must reference one of the options.',
        path: ['correctOptionId'],
      });
    }
  });

export type ExerciseOption = z.infer<typeof ExerciseOptionSchema>;
export type AudioToGlyphExercise = z.infer<typeof AudioToGlyphExerciseSchema>;

export const ImageExerciseOptionSchema = z
  .object({
    optionId: UuidSchema,
    imageAssetId: UuidSchema,
    accessibilityLabel: z.string().trim().min(1).max(120),
  })
  .strict();

export const GlyphToImageExerciseSchema = z
  .object({
    activityId: UuidSchema,
    type: z.literal('glyph_to_image'),
    promptGlyph: z
      .string()
      .regex(/^\p{Script=Han}$/u, 'Prompt must contain exactly one Han glyph.'),
    promptAudioAssetId: UuidSchema,
    targetConceptIds: z.array(UuidSchema).min(1),
    options: z.array(ImageExerciseOptionSchema).min(2).max(4),
    correctOptionId: UuidSchema,
    visualHintZh: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((exercise, context) => {
    const optionIds = exercise.options.map((option) => option.optionId);
    const imageIds = exercise.options.map((option) => option.imageAssetId);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Option IDs must be unique.',
        path: ['options'],
      });
    }
    if (new Set(imageIds).size !== imageIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Image asset IDs must be unique.',
        path: ['options'],
      });
    }
    if (!optionIds.includes(exercise.correctOptionId)) {
      context.addIssue({
        code: 'custom',
        message: 'correctOptionId must reference one of the options.',
        path: ['correctOptionId'],
      });
    }
  });

export type ImageExerciseOption = z.infer<typeof ImageExerciseOptionSchema>;
export type GlyphToImageExercise = z.infer<typeof GlyphToImageExerciseSchema>;

export const WordBuildTileSchema = z
  .object({
    tileId: UuidSchema,
    glyph: z.string().regex(/^\p{Script=Han}$/u, 'Each tile must contain exactly one Han glyph.'),
    accessibilityLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const WordBuildExerciseSchema = z
  .object({
    activityId: UuidSchema,
    type: z.literal('word_build'),
    promptZh: z.string().trim().min(1).max(120),
    promptAudioAssetId: UuidSchema,
    targetConceptIds: z.array(UuidSchema).min(1),
    targetWord: z.string().min(2).max(8),
    tiles: z.array(WordBuildTileSchema).min(2).max(8),
    correctTileOrder: z.array(UuidSchema).min(2).max(8),
    visualHintZh: z.string().trim().min(1).max(120),
  })
  .strict()
  .superRefine((exercise, context) => {
    const tileIds = exercise.tiles.map((tile) => tile.tileId);
    if (new Set(tileIds).size !== tileIds.length) {
      context.addIssue({ code: 'custom', message: 'Tile IDs must be unique.', path: ['tiles'] });
    }
    const orderIds = exercise.correctTileOrder;
    if (
      new Set(orderIds).size !== orderIds.length ||
      orderIds.length !== tileIds.length ||
      orderIds.some((tileId) => !tileIds.includes(tileId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'correctTileOrder must contain every tile exactly once.',
        path: ['correctTileOrder'],
      });
    }
    const glyphById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile.glyph]));
    const assembled = orderIds.map((tileId) => glyphById.get(tileId) ?? '').join('');
    if (assembled !== exercise.targetWord) {
      context.addIssue({
        code: 'custom',
        message: 'The correct tile order must assemble targetWord.',
        path: ['targetWord'],
      });
    }
  });

export type WordBuildTile = z.infer<typeof WordBuildTileSchema>;
export type WordBuildExercise = z.infer<typeof WordBuildExerciseSchema>;

export const SentenceOrderTileSchema = z
  .object({
    tileId: UuidSchema,
    text: z.string().trim().min(1).max(20),
    accessibilityLabel: z.string().trim().min(1).max(100),
  })
  .strict();

export const SentenceOrderExerciseSchema = z
  .object({
    activityId: UuidSchema,
    type: z.literal('sentence_order'),
    promptZh: z.string().trim().min(1).max(120),
    promptAudioAssetId: UuidSchema,
    targetConceptIds: z.array(UuidSchema).min(1),
    targetSentence: z.string().trim().min(2).max(80),
    tiles: z.array(SentenceOrderTileSchema).min(2).max(12),
    correctTileOrder: z.array(UuidSchema).min(2).max(12),
    visualHintZh: z.string().trim().min(1).max(160),
  })
  .strict()
  .superRefine((exercise, context) => {
    const tileIds = exercise.tiles.map((tile) => tile.tileId);
    const orderIds = exercise.correctTileOrder;
    if (new Set(tileIds).size !== tileIds.length) {
      context.addIssue({ code: 'custom', message: 'Tile IDs must be unique.', path: ['tiles'] });
    }
    if (
      new Set(orderIds).size !== orderIds.length ||
      orderIds.length !== tileIds.length ||
      orderIds.some((tileId) => !tileIds.includes(tileId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'correctTileOrder must contain every tile exactly once.',
        path: ['correctTileOrder'],
      });
    }
    const textById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile.text]));
    const assembled = orderIds.map((tileId) => textById.get(tileId) ?? '').join('');
    if (assembled !== exercise.targetSentence) {
      context.addIssue({
        code: 'custom',
        message: 'The correct tile order must assemble targetSentence.',
        path: ['targetSentence'],
      });
    }
  });

export type SentenceOrderTile = z.infer<typeof SentenceOrderTileSchema>;
export type SentenceOrderExercise = z.infer<typeof SentenceOrderExerciseSchema>;
