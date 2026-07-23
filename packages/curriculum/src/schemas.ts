import { SemanticVersionSchema, UuidSchema } from '@hanziquest/contracts';
import { z } from 'zod';

const NonEmptyTextSchema = z.string().trim().min(1).max(500);
const SlugSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case slug.');
const ContentIdSchema = UuidSchema;

export const CURRICULUM_PACKAGE_SCHEMA_VERSION = 'curriculum-package-v1' as const;

export const ScriptVariantSchema = z.enum(['simplified', 'traditional']);
export const ContentStatusSchema = z.enum(['draft', 'approved', 'published', 'archived']);
export const DifficultySchema = z.number().int().min(1).max(5);

export const ContentAssetSchema = z
  .object({
    id: ContentIdSchema,
    kind: z.enum(['audio', 'image']),
    delivery: z.enum(['bundled_file', 'system_tts']),
    localPath: z.string().trim().min(1).max(240).optional(),
    speechText: z.string().trim().min(1).max(120).optional(),
    locale: z.string().trim().min(2).max(20).optional(),
    licenseIdentifier: z.string().trim().min(1).max(80),
    sourceName: z.string().trim().min(1).max(160),
    sourceReference: z.string().trim().min(1).max(500),
    attribution: z.string().trim().min(1).max(300),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.delivery === 'bundled_file' && !asset.localPath) {
      context.addIssue({
        code: 'custom',
        message: 'Bundled files require localPath.',
        path: ['localPath'],
      });
    }
    if (asset.delivery === 'system_tts' && (!asset.speechText || !asset.locale)) {
      context.addIssue({
        code: 'custom',
        message: 'System TTS assets require speechText and locale.',
        path: ['speechText'],
      });
    }
  });

export const ScriptTextSchema = z
  .object({
    simplified: NonEmptyTextSchema,
    traditional: NonEmptyTextSchema,
  })
  .strict();

export const PronunciationSchema = z
  .object({
    pinyin: NonEmptyTextSchema.max(120),
    isPrimary: z.boolean(),
    usageNoteZh: NonEmptyTextSchema.optional(),
  })
  .strict();

export const CharacterConceptSchema = z
  .object({
    conceptId: ContentIdSchema,
    glyph: ScriptTextSchema,
    pronunciations: z
      .object({
        mandarin: z.array(PronunciationSchema).min(1),
        cantonese: z.array(NonEmptyTextSchema).min(1).optional(),
      })
      .strict(),
    meaningZhChild: NonEmptyTextSchema,
    meaningEnParent: NonEmptyTextSchema,
    radical: NonEmptyTextSchema.max(8).optional(),
    strokeCount: z.number().int().positive().max(64).optional(),
    frequencyRank: z.number().int().positive().optional(),
    difficulty: DifficultySchema,
    prerequisiteConceptIds: z.array(ContentIdSchema).default([]),
    confusableConceptIds: z.array(ContentIdSchema).default([]),
    audioAssetId: ContentIdSchema.optional(),
    status: ContentStatusSchema,
  })
  .strict();

export const WordSchema = z
  .object({
    id: ContentIdSchema,
    text: ScriptTextSchema,
    pinyin: NonEmptyTextSchema.max(160),
    meaningZhChild: NonEmptyTextSchema,
    meaningEnParent: NonEmptyTextSchema,
    characterConceptIds: z.array(ContentIdSchema).min(1),
    targetConceptIds: z.array(ContentIdSchema).min(1),
    spokenFrequency: DifficultySchema,
    readingDifficulty: DifficultySchema,
    contextTags: z.array(SlugSchema).max(16).default([]),
    audioAssetId: ContentIdSchema.optional(),
    status: ContentStatusSchema,
  })
  .strict();

export const SentenceSchema = z
  .object({
    id: ContentIdSchema,
    text: ScriptTextSchema,
    pinyin: NonEmptyTextSchema.max(300),
    meaningEnParent: NonEmptyTextSchema,
    characterConceptIds: z.array(ContentIdSchema).min(1),
    targetConceptIds: z.array(ContentIdSchema).min(1),
    difficulty: DifficultySchema,
    maxUnknownCharacters: z.number().int().nonnegative().max(10),
    audioAssetId: ContentIdSchema.optional(),
    status: ContentStatusSchema,
  })
  .strict();

export const ComprehensionQuestionSchema = z
  .object({
    id: ContentIdSchema,
    prompt: ScriptTextSchema,
    options: z.array(ScriptTextSchema).min(2).max(4),
    correctOptionIndex: z.number().int().nonnegative(),
    evidenceSentenceIds: z.array(ContentIdSchema).min(1),
  })
  .strict();

export const StorySchema = z
  .object({
    id: ContentIdSchema,
    title: ScriptTextSchema,
    sourceType: z.literal('editorial'),
    scriptTrack: ScriptVariantSchema,
    ageBand: z.enum(['5-6', '7-8', '9-10', '11-12']),
    interestTags: z.array(SlugSchema).max(8).default([]),
    sentenceIds: z.array(ContentIdSchema).min(3).max(8),
    targetConceptIds: z.array(ContentIdSchema).min(1),
    comprehensionQuestions: z.array(ComprehensionQuestionSchema).min(1),
    transferPrompt: ScriptTextSchema,
    knownCharacterCoverage: z.number().min(0).max(1),
    status: ContentStatusSchema,
  })
  .strict();

export const ActivityTypeSchema = z.enum([
  'audio_to_glyph',
  'glyph_to_audio',
  'glyph_to_image',
  'glyph_to_meaning',
  'meaning_to_glyph',
  'confusion_discrimination',
  'new_character_reveal',
  'word_build',
  'sentence_order',
  'story_comprehension',
]);

export const ActivityReferencesSchema = z
  .object({
    characterConceptIds: z.array(ContentIdSchema).default([]),
    wordIds: z.array(ContentIdSchema).default([]),
    sentenceIds: z.array(ContentIdSchema).default([]),
    storyIds: z.array(ContentIdSchema).default([]),
    assetIds: z.array(ContentIdSchema).default([]),
  })
  .strict();

export const ActivitySchema = z
  .object({
    id: ContentIdSchema,
    type: ActivityTypeSchema,
    targetConceptIds: z.array(ContentIdSchema).min(1),
    references: ActivityReferencesSchema,
    supportLevel: z.enum(['none', 'audio_repeat', 'visual_hint', 'word_context']),
    difficulty: DifficultySchema,
    estimatedSeconds: z.number().int().min(10).max(300),
  })
  .strict();

export const LessonSchema = z
  .object({
    id: ContentIdSchema,
    slug: SlugSchema,
    title: ScriptTextSchema,
    order: z.number().int().nonnegative(),
    kind: z.enum(['standard', 'story_challenge', 'world_finale']),
    prerequisiteLessonIds: z.array(ContentIdSchema).default([]),
    activityIds: z.array(ContentIdSchema).min(1),
    expectedMinutes: z.number().int().min(5).max(10),
  })
  .strict();

export const UnitSchema = z
  .object({
    id: ContentIdSchema,
    slug: SlugSchema,
    title: ScriptTextSchema,
    order: z.number().int().nonnegative(),
    prerequisiteUnitIds: z.array(ContentIdSchema).default([]),
    lessonIds: z.array(ContentIdSchema).min(1),
  })
  .strict();

export const WorldSchema = z
  .object({
    id: ContentIdSchema,
    slug: SlugSchema,
    title: ScriptTextSchema,
    theme: SlugSchema,
    order: z.number().int().nonnegative(),
    prerequisiteWorldIds: z.array(ContentIdSchema).default([]),
    unitIds: z.array(ContentIdSchema).min(1),
  })
  .strict();

export const CurriculumTrackSchema = z
  .object({
    id: ContentIdSchema,
    slug: SlugSchema,
    title: ScriptTextSchema,
    scriptVariant: ScriptVariantSchema,
    primaryPronunciation: z.literal('mandarin'),
    worldIds: z.array(ContentIdSchema).min(1),
  })
  .strict();

export const CurriculumPackageSchema = z
  .object({
    schemaVersion: z.literal(CURRICULUM_PACKAGE_SCHEMA_VERSION),
    curriculumVersion: SemanticVersionSchema,
    minimumAppVersion: SemanticVersionSchema,
    track: CurriculumTrackSchema,
    worlds: z.array(WorldSchema).min(1),
    units: z.array(UnitSchema).min(1),
    lessons: z.array(LessonSchema).min(1),
    activities: z.array(ActivitySchema).min(1),
    characters: z.array(CharacterConceptSchema).min(1),
    words: z.array(WordSchema).min(1),
    sentences: z.array(SentenceSchema).min(1),
    stories: z.array(StorySchema).min(1),
    assets: z.array(ContentAssetSchema).default([]),
  })
  .strict();

export type ScriptVariant = z.infer<typeof ScriptVariantSchema>;
export type ScriptText = z.infer<typeof ScriptTextSchema>;
export type CharacterConcept = z.infer<typeof CharacterConceptSchema>;
export type Word = z.infer<typeof WordSchema>;
export type Sentence = z.infer<typeof SentenceSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type World = z.infer<typeof WorldSchema>;
export type CurriculumTrack = z.infer<typeof CurriculumTrackSchema>;
export type CurriculumPackage = z.infer<typeof CurriculumPackageSchema>;
export type ContentAsset = z.infer<typeof ContentAssetSchema>;
