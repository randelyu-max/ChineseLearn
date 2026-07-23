import { SemanticVersionSchema, UtcDateTimeSchema, UuidSchema } from '@hanziquest/contracts';
import { z } from 'zod';

import { ScriptTextSchema } from './schemas.ts';

export const HUMOR_CONTENT_SCHEMA_VERSION = 'humor-content-v1' as const;

const StableContentKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const HumorLevelSchema = z.enum(['light', 'playful']);
export const HumorTypeSchema = z.enum([
  'situational',
  'tone_wordplay',
  'character_dialogue',
  'exaggeration',
  'surprise_ending',
  'memory_scene',
]);
export const HumorEditorialStatusSchema = z.enum(['draft', 'approved', 'published', 'archived']);

export const HumorLearningTargetSchema = z
  .object({
    domain: z.enum(['hanzi', 'pinyin']),
    targetId: StableContentKeySchema,
    display: ScriptTextSchema,
  })
  .strict();

const HumorPresentationBaseSchema = z
  .object({
    correctAnswerId: StableContentKeySchema,
    correctAnswer: ScriptTextSchema,
    learningTargetDisplay: ScriptTextSchema,
    prompt: ScriptTextSchema,
  })
  .strict();

export const HumorousVariantSchema = HumorPresentationBaseSchema.extend({
  kind: z.literal('humorous'),
}).strict();

export const NeutralFallbackSchema = HumorPresentationBaseSchema.extend({
  kind: z.literal('neutral'),
}).strict();

export const HumorKnowledgeClaimSchema = z
  .object({
    kind: z.enum(['none', 'mnemonic', 'etymology']),
    disclosure: ScriptTextSchema.optional(),
  })
  .strict();

export const HumorSafetyReviewSchema = z
  .object({
    errorMockery: z.literal('passed'),
    etymologyAccuracy: z.literal('passed'),
    humiliation: z.literal('passed'),
    identityStereotypes: z.literal('passed'),
    learningTargetAccuracy: z.literal('passed'),
    reviewedAt: UtcDateTimeSchema,
    reviewedBy: z.string().trim().min(2).max(120),
  })
  .strict();

export const HumorContentItemSchema = z
  .object({
    id: UuidSchema,
    audience: z.literal('age_neutral_13_plus'),
    authoring: z.literal('human_editorial'),
    delivery: z.literal('bundled'),
    editorialStatus: HumorEditorialStatusSchema,
    humorLevel: HumorLevelSchema,
    humorType: HumorTypeSchema,
    humorousVariant: HumorousVariantSchema,
    knowledgeClaim: HumorKnowledgeClaimSchema,
    learningTarget: HumorLearningTargetSchema,
    locale: z
      .string()
      .trim()
      .min(2)
      .max(35)
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    neutralFallback: NeutralFallbackSchema,
    safetyReview: HumorSafetyReviewSchema,
  })
  .strict();

export const HumorContentPackageSchema = z
  .object({
    schemaVersion: z.literal(HUMOR_CONTENT_SCHEMA_VERSION),
    contentVersion: SemanticVersionSchema,
    items: z.array(HumorContentItemSchema).min(1).max(500),
  })
  .strict();

export type HumorLevel = z.infer<typeof HumorLevelSchema>;
export type HumorType = z.infer<typeof HumorTypeSchema>;
export type HumorContentItem = z.infer<typeof HumorContentItemSchema>;
export type HumorContentPackage = z.infer<typeof HumorContentPackageSchema>;
