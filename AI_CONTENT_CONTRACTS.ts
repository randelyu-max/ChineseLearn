/**
 * HanziQuest AI content contracts
 *
 * Place this file in packages/contracts/src/ai-content.ts, then split it into
 * smaller modules as the codebase grows. These schemas are intentionally strict:
 * model output is untrusted until it passes schema validation, deterministic
 * curriculum validation, and age-appropriate safety checks.
 */

import { z } from "zod";

export const ScriptTrackSchema = z.enum(["simplified", "traditional"]);
export const InterestSchema = z.enum([
  "animals",
  "dinosaurs",
  "football",
  "space",
  "vehicles",
  "food",
  "school",
  "family",
  "nature",
  "science",
  "chinese_mythology",
]);

export const AgeBandSchema = z.enum(["6-7", "8-10", "11-13"]);

const ConceptIdSchema = z.string().uuid();
const HanGlyphSchema = z
  .string()
  .min(1)
  .max(4)
  .regex(/^[\p{Script=Han}〇々]+$/u, "Expected one or more Han glyphs");

const SafeIdentifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

/**
 * Internal request accepted by the HanziQuest server.
 * childId is used only to load learning state and consent. It MUST be removed
 * before constructing the provider payload.
 */
export const StoryGenerationRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    childId: z.string().uuid(),
    curriculumVersion: SafeIdentifierSchema,
    scriptTrack: ScriptTrackSchema,
    ageBand: AgeBandSchema,
    interest: InterestSchema,
    targetCharacterIds: z.array(ConceptIdSchema).min(1).max(6),
    targetSentencePatternCodes: z.array(SafeIdentifierSchema).max(4).default([]),
    maximumIntentionalUnknownGlyphs: z.number().int().min(0).max(2).default(0),
    sentenceCount: z.number().int().min(3).max(8).default(5),
    maximumHanGlyphsPerSentence: z.number().int().min(4).max(30).default(18),
    locale: z.enum(["zh-CN", "zh-TW", "en-US", "en-GB"]).default("zh-CN"),
  })
  .strict();

/**
 * De-identified, minimized payload that may be sent to the AI provider.
 * It contains no child ID, name, household ID, exact age, school, location,
 * free-form child text, or raw speech.
 */
export const ProviderStoryInputSchema = z
  .object({
    schemaVersion: z.literal("story-input-v1"),
    requestNonce: z.string().uuid(),
    curriculumVersion: SafeIdentifierSchema,
    scriptTrack: ScriptTrackSchema,
    ageBand: AgeBandSchema,
    interest: InterestSchema,
    allowedGlyphs: z.array(HanGlyphSchema).min(10).max(1200),
    allowedWords: z.array(z.string().min(1).max(24)).min(5).max(2000),
    targetGlyphs: z.array(HanGlyphSchema).min(1).max(6),
    targetSentencePatterns: z.array(z.string().min(1).max(60)).max(4),
    permittedUnknownGlyphs: z.array(HanGlyphSchema).max(2),
    requiredTargetOccurrences: z.number().int().min(1).max(5).default(2),
    sentenceCount: z.number().int().min(3).max(8),
    maximumHanGlyphsPerSentence: z.number().int().min(4).max(30),
    prohibitedTopicCodes: z.array(SafeIdentifierSchema).min(1),
  })
  .strict();

export const StorySentenceSchema = z
  .object({
    text: z.string().min(1).max(60),
    targetConceptIds: z.array(ConceptIdSchema).max(8),
    intentionalUnknownGlyphs: z.array(HanGlyphSchema).max(2),
  })
  .strict();

export const StoryQuestionSchema = z
  .object({
    questionId: SafeIdentifierSchema,
    prompt: z.string().min(1).max(60),
    options: z.array(z.string().min(1).max(30)).min(2).max(4),
    correctOptionIndex: z.number().int().min(0).max(3),
    evidenceSentenceIndex: z.number().int().min(0).max(7),
    skill: z.literal("story_comprehension"),
  })
  .strict()
  .superRefine((question, ctx) => {
    if (question.correctOptionIndex >= question.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctOptionIndex"],
        message: "correctOptionIndex must reference an existing option",
      });
    }
  });

export const GeneratedStorySchema = z
  .object({
    schemaVersion: z.literal("story-v1"),
    status: z.enum(["generated", "cannot_generate"]),
    refusalCode: SafeIdentifierSchema.optional(),
    title: z.string().min(1).max(30).optional(),
    scriptTrack: ScriptTrackSchema,
    sentences: z.array(StorySentenceSchema).min(3).max(8).optional(),
    questions: z.array(StoryQuestionSchema).min(1).max(3).optional(),
    illustrationBrief: z.string().max(300).optional(),
    safety: z
      .object({
        ageAppropriate: z.boolean(),
        containsPersonalData: z.boolean(),
        containsExternalContactPrompt: z.boolean(),
        containsSecretKeepingPrompt: z.boolean(),
        flags: z.array(SafeIdentifierSchema).max(20),
      })
      .strict(),
  })
  .strict()
  .superRefine((story, ctx) => {
    if (story.status === "generated") {
      for (const field of ["title", "sentences", "questions"] as const) {
        if (story[field] === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required when status=generated`,
          });
        }
      }
      if (!story.safety.ageAppropriate || story.safety.containsPersonalData) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["safety"],
          message: "Generated child content failed declared safety constraints",
        });
      }
    }

    if (story.status === "cannot_generate" && !story.refusalCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["refusalCode"],
        message: "refusalCode is required when status=cannot_generate",
      });
    }

    story.questions?.forEach((question, questionIndex) => {
      if (story.sentences && question.evidenceSentenceIndex >= story.sentences.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "evidenceSentenceIndex"],
          message: "evidenceSentenceIndex must reference an existing sentence",
        });
      }
    });
  });

export const StoryValidationIssueSchema = z
  .object({
    code: SafeIdentifierSchema,
    severity: z.enum(["warning", "error"]),
    path: z.string().max(160),
    message: z.string().min(1).max(300),
    valuePreview: z.string().max(100).optional(),
  })
  .strict();

export const StoryValidationReportSchema = z
  .object({
    schemaVersion: z.literal("story-validation-v1"),
    accepted: z.boolean(),
    checkedAt: z.string().datetime({ offset: true }),
    validatorVersion: SafeIdentifierSchema,
    knownGlyphCoverage: z.number().min(0).max(1),
    targetOccurrenceCounts: z.record(HanGlyphSchema, z.number().int().nonnegative()),
    unknownGlyphs: z.array(HanGlyphSchema),
    sentenceHanGlyphCounts: z.array(z.number().int().nonnegative()),
    deterministicAnswerChecksPassed: z.boolean(),
    scriptConsistencyPassed: z.boolean(),
    moderationPassed: z.boolean(),
    issues: z.array(StoryValidationIssueSchema).max(100),
  })
  .strict();

/** Deterministically computed first-party facts. */
export const WeeklyReportFactsSchema = z
  .object({
    childId: z.string().uuid(),
    weekStart: z.string().date(),
    activeDays: z.number().int().min(0).max(7),
    targetDays: z.number().int().min(1).max(7),
    learningMinutes: z.number().int().nonnegative().max(1000),
    newlyStableCharacters: z
      .array(
        z
          .object({
            conceptId: ConceptIdSchema,
            glyph: HanGlyphSchema,
          })
          .strict(),
      )
      .max(100),
    storiesCompleted: z.number().int().nonnegative().max(100),
    independentSentenceRate: z.number().min(0).max(1).nullable(),
    hintRate: z.number().min(0).max(1),
    confusionPairs: z
      .array(
        z
          .object({
            left: HanGlyphSchema,
            right: HanGlyphSchema,
            risk: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(10),
    homePracticeSuggestionCode: SafeIdentifierSchema,
  })
  .strict();

/** Provider-safe report facts: childId is deliberately omitted. */
export const ProviderWeeklyReportInputSchema = WeeklyReportFactsSchema.omit({ childId: true })
  .extend({
    schemaVersion: z.literal("weekly-report-input-v1"),
    parentLocale: z.enum(["zh-CN", "zh-TW", "en-US", "en-GB"]),
    approvedSuggestionText: z.string().min(1).max(240),
  })
  .strict();

export const GeneratedWeeklyReportSchema = z
  .object({
    schemaVersion: z.literal("weekly-report-v1"),
    locale: z.enum(["zh-CN", "zh-TW", "en-US", "en-GB"]),
    headline: z.string().min(1).max(80),
    summary: z.string().min(1).max(500),
    strength: z.string().min(1).max(240),
    focus: z.string().min(1).max(240),
    homePractice: z.string().min(1).max(240),
    prohibitedClaimsPresent: z.boolean(),
  })
  .strict();

export const SpeechAssessmentConsentSchema = z
  .object({
    childId: z.string().uuid(),
    consentRecordId: z.string().uuid(),
    cloudSpeechEnabled: z.literal(true),
    consentDocumentVersion: SafeIdentifierSchema,
    grantedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const SpeechAlignmentResultSchema = z
  .object({
    schemaVersion: z.literal("speech-alignment-v1"),
    targetText: z.string().min(1).max(120),
    recognizedText: z.string().max(160),
    overallConfidence: z.number().min(0).max(1),
    lowConfidence: z.boolean(),
    operations: z
      .array(
        z
          .object({
            type: z.enum(["match", "substitution", "omission", "insertion", "long_pause"]),
            targetGlyph: HanGlyphSchema.optional(),
            recognizedGlyph: HanGlyphSchema.optional(),
            targetIndex: z.number().int().nonnegative().optional(),
            durationMs: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .max(200),
    retryTargetGlyphs: z.array(HanGlyphSchema).max(6),
    rawAudioPersisted: z.literal(false),
  })
  .strict();

export type StoryGenerationRequest = z.infer<typeof StoryGenerationRequestSchema>;
export type ProviderStoryInput = z.infer<typeof ProviderStoryInputSchema>;
export type GeneratedStory = z.infer<typeof GeneratedStorySchema>;
export type StoryValidationReport = z.infer<typeof StoryValidationReportSchema>;
export type WeeklyReportFacts = z.infer<typeof WeeklyReportFactsSchema>;
export type ProviderWeeklyReportInput = z.infer<typeof ProviderWeeklyReportInputSchema>;
export type GeneratedWeeklyReport = z.infer<typeof GeneratedWeeklyReportSchema>;
export type SpeechAssessmentConsent = z.infer<typeof SpeechAssessmentConsentSchema>;
export type SpeechAlignmentResult = z.infer<typeof SpeechAlignmentResultSchema>;

/**
 * Never pass StoryGenerationRequest directly to an AI provider.
 * Build and validate ProviderStoryInput instead.
 */
export function assertProviderPayloadIsDeidentified(payload: unknown): ProviderStoryInput {
  return ProviderStoryInputSchema.parse(payload);
}
