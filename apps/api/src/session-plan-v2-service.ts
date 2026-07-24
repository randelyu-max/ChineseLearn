import { createHash, randomUUID } from 'node:crypto';

import {
  LearningExerciseSchema,
  LearningExerciseV2Schema,
  SessionActivitySnapshotV2Schema,
  SessionPlanResultV2Schema,
  SessionPlanSnapshotSchema,
  SessionPlanSnapshotV2Schema,
  type LearningExercise,
  type LearningExerciseV2,
  type SessionPlanRequestV2,
  type SessionPlanResultV2,
  type SessionPlanSnapshotV2,
} from '@hanziquest/contracts';
import {
  buildPinyinIntegratedSessionPlan,
  calculatePredictedSuccess,
  type HanziPlanningCandidate,
  type PinyinSupportPreference,
  type RecentPerformance,
} from '@hanziquest/learning-engine';
import type { PoolClient } from 'pg';

export const SESSION_PLAN_V2_MATERIALIZER_VERSION =
  'pinyin-session-planner-v1+session-materializer-v2';

export const PINYIN_SESSION_V2_CAPABILITY = Object.freeze({
  attempts: false,
  planning: false,
});

const PINYIN_EXERCISE_TYPES = new Set([
  'audio_to_pinyin',
  'pinyin_to_audio',
  'pinyin_to_glyph',
  'glyph_to_pinyin',
  'tone_choice',
  'pinyin_syllable_build',
]);

type CurriculumAuthorityRow = {
  curriculum_version_id: string;
  curriculum_version: string;
  humor_preference: 'light' | 'off' | 'playful';
  manifest_sha256: string | null;
  pinyin_support_mode: PinyinSupportPreference;
};

type LessonRow = {
  content_spec: unknown;
  lesson_id: string;
};

type LessonConceptRow = {
  concept_id: string;
  concept_type: 'character' | 'sentence' | 'story' | 'word';
  lesson_id: string;
  role: 'optional' | 'review' | 'target' | 'transfer';
};

type SkillStateRow = {
  concept_id: string;
  concept_type: 'character' | 'sentence' | 'story' | 'word';
  difficulty: string;
  exposure_count: number;
  mastery_probability: string;
  skill: string;
};

type DueReviewRow = {
  concept_id: string;
  concept_type: 'character' | 'sentence' | 'story' | 'word';
  skill: string;
};

type ConfusionRiskRow = {
  concept_id: string;
  risk: string;
};

type AttemptSignalRow = {
  correct: boolean;
  hint_level: number;
};

type ActiveSessionRow = {
  client_session_id: string;
  created_at: Date;
  id: string;
  plan: unknown;
  status: 'in_progress' | 'planned';
};

type PlanEventRow = {
  client_session_id: string;
  idempotency_key: string;
  result_snapshot: unknown;
};

type ExerciseDimensions = Readonly<{
  abilityAxis:
    'hanzi_recognition' | 'sentence_reading' | 'spoken_audio_comprehension' | 'word_reading';
  conceptType: 'character' | 'sentence' | 'word';
  skill: 'audio_to_glyph' | 'glyph_to_image' | 'sentence_order' | 'word_build';
}>;

export type MaterializableCandidate = Readonly<{
  candidate: HanziPlanningCandidate;
  dimensions: ExerciseDimensions;
  exercise: LearningExerciseV2;
  lessonId: string;
  targetConceptIds: readonly string[];
}>;

export type AuthoritativePlanningStateV2 = Readonly<{
  abilityEstimate: number;
  candidates: readonly HanziPlanningCandidate[];
  contentManifestSha256: string;
  contentVersion: string;
  curriculumVersionId: string;
  eligibleCurriculumNodeIds: readonly string[];
  humorPreference: 'light' | 'off' | 'playful';
  masteredConceptIds: readonly string[];
  materialsByCandidateId: ReadonlyMap<string, MaterializableCandidate>;
  pinyinSupportPreference: PinyinSupportPreference;
  pinyinSupportSignals: Readonly<{
    consecutiveErrors: number;
    consecutiveIndependentSuccesses: number;
    fullAnswerRevealRate: number;
    recentIndependentAccuracy: number;
  }>;
  recentPerformance: RecentPerformance;
}>;

export function confidenceClosingMaterial(
  materials: readonly MaterializableCandidate[],
  abilityEstimate: number,
): MaterializableCandidate | null {
  return (
    materials
      .map((material) => {
        const candidate = Object.freeze({
          ...material.candidate,
          category: 'quick_success' as const,
          difficulty: Math.min(0.1, material.candidate.difficulty),
          id: `${material.candidate.id}:confidence-close`,
          supportBoost: Math.max(0.65, material.candidate.supportBoost),
          scores: Object.freeze({
            ...material.candidate.scores,
            curriculumNeed: 0,
            weakness: 0,
          }),
        });
        return {
          candidate,
          material,
          predictedSuccess: calculatePredictedSuccess({
            abilityEstimate,
            confusionPenalty: candidate.confusionPenalty,
            difficulty: candidate.difficulty,
            supportBoost: candidate.supportBoost,
          }),
        };
      })
      .filter((item) => item.predictedSuccess >= 0.9)
      .sort(
        (left, right) =>
          right.predictedSuccess - left.predictedSuccess ||
          left.candidate.id.localeCompare(right.candidate.id),
      )
      .map(({ candidate, material }) => Object.freeze({ ...material, candidate }))[0] ?? null
  );
}

export class SessionPlanV2ServiceError extends Error {
  constructor(
    readonly code:
      'SESSION_CONTENT_INVALID' | 'SESSION_IDEMPOTENCY_CONFLICT' | 'SESSION_PLAN_INVALID',
    message: string,
  ) {
    super(message);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function databaseNumber(value: string | undefined, fallback: number): number {
  return value === undefined ? fallback : clamp(Number(value), 0, 1);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentSha256(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function dimensions(exercise: LearningExercise): ExerciseDimensions {
  switch (exercise.type) {
    case 'audio_to_glyph':
      return {
        abilityAxis: 'spoken_audio_comprehension',
        conceptType: 'character',
        skill: 'audio_to_glyph',
      };
    case 'glyph_to_image':
      return {
        abilityAxis: 'hanzi_recognition',
        conceptType: 'character',
        skill: 'glyph_to_image',
      };
    case 'word_build':
      return {
        abilityAxis: 'word_reading',
        conceptType: 'word',
        skill: 'word_build',
      };
    case 'sentence_order':
      return {
        abilityAxis: 'sentence_reading',
        conceptType: 'sentence',
        skill: 'sentence_order',
      };
  }
}

function materializeExercise(exercise: LearningExercise): LearningExerciseV2 {
  const header = {
    schemaVersion: 'learning-exercise-v2' as const,
    activityId: exercise.activityId,
    instructionZh: '请完成这道练习。',
    instructionAccessibilityLabel: '请阅读或聆听题目，然后完成练习。',
  };
  switch (exercise.type) {
    case 'audio_to_glyph':
      return LearningExerciseV2Schema.parse({
        ...header,
        type: exercise.type,
        promptAudioAssetKey: exercise.promptAudioAssetId,
        options: exercise.options,
        correctOptionId: exercise.correctOptionId,
        visualHintZh: exercise.visualHintZh,
      });
    case 'glyph_to_image':
      return LearningExerciseV2Schema.parse({
        ...header,
        type: exercise.type,
        promptGlyph: exercise.promptGlyph,
        promptAccessibilityLabel: `汉字${exercise.promptGlyph}`,
        options: exercise.options.map((option) => ({
          optionId: option.optionId,
          imageAssetKey: option.imageAssetId,
          accessibilityLabel: option.accessibilityLabel,
        })),
        correctOptionId: exercise.correctOptionId,
        visualHintZh: exercise.visualHintZh,
      });
    case 'word_build':
      return LearningExerciseV2Schema.parse({
        ...header,
        type: exercise.type,
        promptZh: exercise.promptZh,
        promptAudioAssetKey: exercise.promptAudioAssetId,
        targetWord: exercise.targetWord,
        tiles: exercise.tiles,
        correctTileOrder: exercise.correctTileOrder,
        visualHintZh: exercise.visualHintZh,
      });
    case 'sentence_order':
      return LearningExerciseV2Schema.parse({
        ...header,
        type: exercise.type,
        promptZh: exercise.promptZh,
        promptAudioAssetKey: exercise.promptAudioAssetId,
        targetSentence: exercise.targetSentence,
        tiles: exercise.tiles,
        correctTileOrder: exercise.correctTileOrder,
        visualHintZh: exercise.visualHintZh,
      });
  }
}

function rawExercises(contentSpec: unknown): readonly unknown[] {
  if (typeof contentSpec !== 'object' || contentSpec === null) return [];
  const exercises = (contentSpec as Record<string, unknown>).exercises;
  return Array.isArray(exercises) ? exercises : [];
}

function supportedExercises(contentSpec: unknown): readonly LearningExercise[] {
  const supported: LearningExercise[] = [];
  for (const candidate of rawExercises(contentSpec)) {
    const type =
      candidate && typeof candidate === 'object'
        ? (candidate as Record<string, unknown>).type
        : undefined;
    if (
      typeof type === 'string' &&
      PINYIN_EXERCISE_TYPES.has(type) &&
      !PINYIN_SESSION_V2_CAPABILITY.planning
    ) {
      continue;
    }
    if (
      !['audio_to_glyph', 'glyph_to_image', 'word_build', 'sentence_order'].includes(String(type))
    ) {
      continue;
    }
    const parsed = LearningExerciseSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new SessionPlanV2ServiceError(
        'SESSION_CONTENT_INVALID',
        'A published Hanzi exercise cannot be materialized safely.',
      );
    }
    supported.push(parsed.data);
  }
  return supported;
}

function stateKey(conceptType: string, conceptId: string, skill: string): string {
  return `${conceptType}:${conceptId}:${skill}`;
}

function performanceFromAttempts(rows: readonly AttemptSignalRow[]) {
  if (rows.length === 0) {
    return {
      pinyinSupportSignals: {
        consecutiveErrors: 0,
        consecutiveIndependentSuccesses: 0,
        fullAnswerRevealRate: 0,
        recentIndependentAccuracy: 0.7,
      },
      recentPerformance: {
        accuracy: 0.8,
        fullHintRate: 0,
        responseStable: true,
        transferSucceeded: false,
      },
    } as const;
  }
  const correctCount = rows.filter((row) => row.correct).length;
  const fullAnswerCount = rows.filter((row) => row.hint_level >= 4).length;
  let consecutiveErrors = 0;
  let consecutiveIndependentSuccesses = 0;
  for (const row of rows) {
    if (!row.correct && consecutiveIndependentSuccesses === 0) consecutiveErrors += 1;
    else if (row.correct && row.hint_level === 0 && consecutiveErrors === 0)
      consecutiveIndependentSuccesses += 1;
    else break;
  }
  const accuracy = correctCount / rows.length;
  const fullHintRate = fullAnswerCount / rows.length;
  return {
    pinyinSupportSignals: {
      consecutiveErrors,
      consecutiveIndependentSuccesses,
      fullAnswerRevealRate: fullHintRate,
      recentIndependentAccuracy: accuracy,
    },
    recentPerformance: {
      accuracy,
      fullHintRate,
      responseStable: rows.length >= 3,
      transferSucceeded: false,
    },
  } as const;
}

export async function loadAuthoritativePlanningStateV2(
  client: PoolClient,
  userId: string,
  intent: SessionPlanRequestV2['intent'],
  now: Date,
): Promise<AuthoritativePlanningStateV2 | null> {
  const authorityResult = await client.query<CurriculumAuthorityRow>(
    `select
       cv.id as curriculum_version_id,
       cv.version as curriculum_version,
       cv.manifest_sha256,
       p.pinyin_support_mode,
       p.humor_preference
     from public.profiles p
     cross join lateral (
       select id, version, manifest_sha256
       from public.curriculum_versions
       where status = 'published'
       order by published_at desc nulls last, created_at desc
       limit 1
     ) cv
     where p.id = $1`,
    [userId],
  );
  const authority = authorityResult.rows[0];
  if (!authority || !authority.manifest_sha256?.match(/^[a-f0-9]{64}$/)) return null;

  const lessons = await client.query<LessonRow>(
    `select l.id::text as lesson_id, l.content_spec
         from public.worlds w
         join public.units u on u.world_id = w.id
         join public.lessons l on l.unit_id = u.id
         where w.curriculum_version_id = $1
           and w.is_published and u.is_published and l.is_published
         order by w.sort_order, u.sort_order, l.sort_order, l.id`,
    [authority.curriculum_version_id],
  );
  const lessonConcepts = await client.query<LessonConceptRow>(
    `select
           lc.lesson_id::text,
           lc.concept_type::text,
           lc.concept_id::text,
           lc.role
         from public.lesson_concepts lc
         join public.lessons l on l.id = lc.lesson_id
         join public.units u on u.id = l.unit_id
         join public.worlds w on w.id = u.world_id
         where w.curriculum_version_id = $1
           and w.is_published and u.is_published and l.is_published`,
    [authority.curriculum_version_id],
  );
  const skillStates = await client.query<SkillStateRow>(
    `select
           concept_type::text, concept_id::text, skill::text,
           mastery_probability::text, difficulty::text, exposure_count
         from public.skill_states
         where user_id = $1`,
    [userId],
  );
  const dueReviews = await client.query<DueReviewRow>(
    `select concept_type::text, concept_id::text, skill::text
         from public.review_schedule
         where user_id = $1 and due_at <= $2`,
    [userId, now],
  );
  const confusionRisks = await client.query<ConfusionRiskRow>(
    `select cp.left_character_id::text as concept_id, cs.risk::text
         from public.confusion_stats cs
         join public.confusable_pairs cp on cp.id = cs.pair_id
         where cs.user_id = $1
           and cs.next_practice_at <= $2
           and cp.is_published
         union all
         select cp.right_character_id::text as concept_id, cs.risk::text
         from public.confusion_stats cs
         join public.confusable_pairs cp on cp.id = cs.pair_id
         where cs.user_id = $1
           and cs.next_practice_at <= $2
           and cp.is_published`,
    [userId, now],
  );
  const attemptSignals = await client.query<AttemptSignalRow>(
    `select correct, hint_level
         from public.attempts
         where user_id = $1
         order by received_at desc
         limit 20`,
    [userId],
  );

  const conceptsByLesson = new Map<string, LessonConceptRow[]>();
  for (const concept of lessonConcepts.rows) {
    const current = conceptsByLesson.get(concept.lesson_id) ?? [];
    current.push(concept);
    conceptsByLesson.set(concept.lesson_id, current);
  }
  const skillByKey = new Map(
    skillStates.rows.map((state) => [
      stateKey(state.concept_type, state.concept_id, state.skill),
      state,
    ]),
  );
  const dueKeys = new Set(
    dueReviews.rows.map((review) => stateKey(review.concept_type, review.concept_id, review.skill)),
  );
  const confusionByConcept = new Map<string, number>();
  for (const row of confusionRisks.rows) {
    confusionByConcept.set(
      row.concept_id,
      Math.max(confusionByConcept.get(row.concept_id) ?? 0, databaseNumber(row.risk, 0)),
    );
  }

  const materialsByCandidateId = new Map<string, MaterializableCandidate>();
  const candidates: HanziPlanningCandidate[] = [];
  for (const lesson of lessons.rows) {
    const lessonTargets = conceptsByLesson.get(lesson.lesson_id) ?? [];
    for (const sourceExercise of supportedExercises(lesson.content_spec)) {
      const exerciseDimensions = dimensions(sourceExercise);
      const targetConcepts = sourceExercise.targetConceptIds.map((conceptId) => {
        const declaration = lessonTargets.find(
          (candidate) =>
            candidate.concept_id === conceptId &&
            candidate.concept_type === exerciseDimensions.conceptType,
        );
        if (!declaration) {
          throw new SessionPlanV2ServiceError(
            'SESSION_CONTENT_INVALID',
            'A published exercise target is not declared by its Lesson.',
          );
        }
        return declaration;
      });
      const targetStates = targetConcepts.map((target) =>
        skillByKey.get(stateKey(target.concept_type, target.concept_id, exerciseDimensions.skill)),
      );
      const isDue = targetConcepts.some((target) =>
        dueKeys.has(stateKey(target.concept_type, target.concept_id, exerciseDimensions.skill)),
      );
      if (intent === 'review' && !isDue) continue;
      const mastery =
        targetStates.reduce(
          (total, state) => total + databaseNumber(state?.mastery_probability, 0.15),
          0,
        ) / Math.max(1, targetStates.length);
      const difficulty =
        targetStates.reduce((total, state) => total + databaseNumber(state?.difficulty, 0.35), 0) /
        Math.max(1, targetStates.length);
      const exposures = targetStates.reduce(
        (total, state) => total + (state?.exposure_count ?? 0),
        0,
      );
      const confusionPenalty = Math.max(
        ...targetConcepts.map((target) => confusionByConcept.get(target.concept_id) ?? 0),
        0,
      );
      const isTransfer = targetConcepts.some((target) => target.role === 'transfer');
      const category =
        intent === 'review' || isDue
          ? 'overdue_review'
          : confusionPenalty >= 0.5
            ? 'confusion_review'
            : isTransfer
              ? 'transfer_reading'
              : exposures > 0
                ? 'weak_review'
                : 'new_content';
      const candidateId = `hanzi:${lesson.lesson_id}:${sourceExercise.activityId}`;
      const candidate = Object.freeze({
        category,
        confusionPenalty,
        curriculumNodeId: lesson.lesson_id,
        difficulty,
        estimatedSeconds:
          sourceExercise.type === 'sentence_order'
            ? 120
            : sourceExercise.type === 'word_build'
              ? 90
              : 60,
        id: candidateId,
        learningDomain: 'hanzi' as const,
        pinyinSupportEligible: sourceExercise.type !== 'sentence_order',
        prerequisiteConceptIds: Object.freeze([]),
        scores: Object.freeze({
          confusion: confusionPenalty,
          curriculumNeed: targetConcepts.some((target) => target.role === 'target') ? 1 : 0.5,
          interest: targetConcepts.some((target) => target.role === 'optional') ? 0.7 : 0.5,
          overdue: isDue ? 1 : 0,
          recentError: mastery < 0.5 ? 1 - mastery : 0,
          weakness: 1 - mastery,
        }),
        supportBoost: authority.pinyin_support_mode === 'hidden' ? 0.05 : 0.25,
        targetConceptIds: Object.freeze([...sourceExercise.targetConceptIds]),
      }) satisfies HanziPlanningCandidate;
      const material = Object.freeze({
        candidate,
        dimensions: exerciseDimensions,
        exercise: materializeExercise(sourceExercise),
        lessonId: lesson.lesson_id,
        targetConceptIds: Object.freeze([...sourceExercise.targetConceptIds]),
      });
      candidates.push(candidate);
      materialsByCandidateId.set(candidateId, material);
    }
  }

  const masteryValues = skillStates.rows.map((state) =>
    databaseNumber(state.mastery_probability, 0.15),
  );
  const abilityEstimate =
    masteryValues.length === 0
      ? 0.5
      : masteryValues.reduce((total, value) => total + value, 0) / masteryValues.length;
  const closingMaterial = confidenceClosingMaterial(
    [...materialsByCandidateId.values()],
    abilityEstimate,
  );
  if (closingMaterial) {
    candidates.push(closingMaterial.candidate);
    materialsByCandidateId.set(closingMaterial.candidate.id, closingMaterial);
  }

  const performance = performanceFromAttempts(attemptSignals.rows);
  return Object.freeze({
    abilityEstimate,
    candidates: Object.freeze(candidates),
    contentManifestSha256: authority.manifest_sha256,
    contentVersion: authority.curriculum_version,
    curriculumVersionId: authority.curriculum_version_id,
    eligibleCurriculumNodeIds: Object.freeze(lessons.rows.map((lesson) => lesson.lesson_id)),
    humorPreference: authority.humor_preference,
    masteredConceptIds: Object.freeze([
      ...new Set(
        skillStates.rows
          .filter((state) => databaseNumber(state.mastery_probability, 0.15) >= 0.8)
          .map((state) => state.concept_id),
      ),
    ]),
    materialsByCandidateId,
    pinyinSupportPreference: authority.pinyin_support_mode,
    pinyinSupportSignals: Object.freeze(performance.pinyinSupportSignals),
    recentPerformance: Object.freeze(performance.recentPerformance),
  });
}

export function buildMaterializedSessionPlanV2(
  request: SessionPlanRequestV2,
  state: AuthoritativePlanningStateV2,
  sessionId: string,
  createdAt: Date,
  createActivityId: () => string = randomUUID,
): SessionPlanSnapshotV2 | null {
  const plan = buildPinyinIntegratedSessionPlan({
    abilityEstimate: state.abilityEstimate,
    eligibleCurriculumNodeIds: state.eligibleCurriculumNodeIds,
    hanziCandidates: state.candidates,
    masteredConceptIds: state.masteredConceptIds,
    pinyinCandidates: [],
    pinyinSupportPreference: state.pinyinSupportPreference,
    pinyinSupportSignals: state.pinyinSupportSignals,
    recentPerformance: state.recentPerformance,
    seed: request.clientSessionId,
    targetMinutes: request.targetMinutes,
  });
  if (plan.status !== 'planned' || plan.activities.length === 0) return null;

  const activities = plan.activities.map((planned, position) => {
    const material = state.materialsByCandidateId.get(planned.candidateId);
    if (!material) {
      throw new SessionPlanV2ServiceError(
        'SESSION_PLAN_INVALID',
        'The planner selected content without a materializable source.',
      );
    }
    const activity = {
      schemaVersion: 'session-activity-v2',
      sessionActivityId: createActivityId(),
      sourceExerciseId: material.exercise.activityId,
      position,
      exerciseType: material.exercise.type,
      contentRef: `lesson.${material.lessonId}.exercise.${material.exercise.activityId}`,
      contentVersion: state.contentVersion,
      contentSha256: contentSha256(material.exercise),
      exercise: material.exercise,
      evidenceTargets: material.targetConceptIds.map((conceptId, targetIndex) => ({
        schemaVersion: 'evidence-target-v1' as const,
        conceptType: material.dimensions.conceptType,
        conceptId,
        skill: material.dimensions.skill,
        abilityAxis: material.dimensions.abilityAxis,
        role: targetIndex === 0 ? ('primary' as const) : ('secondary' as const),
      })),
      pinyinSupport: planned.pinyinSupport
        ? {
            profileMode: state.pinyinSupportPreference,
            ...planned.pinyinSupport,
          }
        : null,
      humorContentRef: null,
      estimatedSeconds: planned.estimatedSeconds,
    };
    return SessionActivitySnapshotV2Schema.parse(activity);
  });
  return SessionPlanSnapshotV2Schema.parse({
    schemaVersion: 'session-plan-snapshot-v2',
    sessionId,
    clientSessionId: request.clientSessionId,
    intent: request.intent,
    curriculumVersionId: state.curriculumVersionId,
    contentManifestSha256: state.contentManifestSha256,
    humorContentVersion: null,
    humorPreference: state.humorPreference,
    planningAlgorithmVersion: SESSION_PLAN_V2_MATERIALIZER_VERSION,
    targetMinutes: request.targetMinutes,
    estimatedSeconds: activities.reduce((total, activity) => total + activity.estimatedSeconds, 0),
    createdAt: createdAt.toISOString(),
    activities,
  });
}

async function findEvent(
  client: PoolClient,
  userId: string,
  request: SessionPlanRequestV2,
): Promise<SessionPlanResultV2 | null> {
  const result = await client.query<PlanEventRow>(
    `select client_session_id, idempotency_key, result_snapshot
     from public.learning_session_plan_v2_events
     where user_id = $1
       and (idempotency_key = $2 or client_session_id = $3)
     order by created_at, id
     limit 2`,
    [userId, request.idempotencyKey, request.clientSessionId],
  );
  if (result.rows.length > 1) {
    throw new SessionPlanV2ServiceError(
      'SESSION_IDEMPOTENCY_CONFLICT',
      'The idempotency key and client Session ID identify different results.',
    );
  }
  const event = result.rows[0];
  if (!event) return null;
  if (
    event.idempotency_key !== request.idempotencyKey ||
    event.client_session_id !== request.clientSessionId
  ) {
    throw new SessionPlanV2ServiceError(
      'SESSION_IDEMPOTENCY_CONFLICT',
      'The Session planning identity conflicts with an earlier request.',
    );
  }
  return SessionPlanResultV2Schema.parse(event.result_snapshot);
}

async function activeSession(client: PoolClient, userId: string): Promise<ActiveSessionRow | null> {
  const result = await client.query<ActiveSessionRow>(
    `select id, client_session_id, status, plan, created_at
     from public.learning_sessions
     where user_id = $1 and status in ('planned', 'in_progress')
     order by created_at desc, id desc
     limit 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

function activeResult(
  row: ActiveSessionRow,
): Extract<SessionPlanResultV2, { result: 'active_session_exists' }> {
  const snapshot =
    typeof row.plan === 'object' &&
    row.plan !== null &&
    (row.plan as Record<string, unknown>).schemaVersion === 'session-plan-snapshot-v2'
      ? SessionPlanSnapshotV2Schema.parse(row.plan)
      : SessionPlanSnapshotSchema.parse(row.plan);
  return SessionPlanResultV2Schema.parse({
    schemaVersion: 'session-plan-result-v2',
    result: 'active_session_exists',
    session: {
      sessionId: row.id,
      clientSessionId: row.client_session_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      snapshot,
    },
  }) as Extract<SessionPlanResultV2, { result: 'active_session_exists' }>;
}

async function saveEvent(
  client: PoolClient,
  userId: string,
  request: SessionPlanRequestV2,
  result: SessionPlanResultV2,
): Promise<void> {
  await client.query(
    `insert into public.learning_session_plan_v2_events (
       session_id, user_id, client_session_id, idempotency_key, intent,
       result_kind, result_snapshot
     ) values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      result.session?.sessionId ?? null,
      userId,
      request.clientSessionId,
      request.idempotencyKey,
      request.intent,
      result.result,
      result,
    ],
  );
}

export async function createOrReplaySessionPlanV2(
  client: PoolClient,
  userId: string,
  request: SessionPlanRequestV2,
): Promise<{ created: boolean; result: SessionPlanResultV2 }> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const replay = await findEvent(client, userId, request);
  if (replay) return { created: false, result: replay };

  const active = await activeSession(client, userId);
  if (active) {
    const result = activeResult(active);
    await saveEvent(client, userId, request, result);
    return { created: false, result };
  }

  const clock = await client.query<{ now: Date }>(`select transaction_timestamp() as now`);
  const now = clock.rows[0]?.now ?? new Date();
  const state = await loadAuthoritativePlanningStateV2(client, userId, request.intent, now);
  if (!state) {
    const result = SessionPlanResultV2Schema.parse({
      schemaVersion: 'session-plan-result-v2',
      result: 'insufficient_safe_content',
      session: null,
    });
    await saveEvent(client, userId, request, result);
    return {
      created: false,
      result,
    };
  }
  if (request.intent === 'review' && state.candidates.length === 0) {
    const result = SessionPlanResultV2Schema.parse({
      schemaVersion: 'session-plan-result-v2',
      result: 'nothing_due',
      session: null,
    });
    await saveEvent(client, userId, request, result);
    return {
      created: false,
      result,
    };
  }

  const sessionId = randomUUID();
  const snapshot = buildMaterializedSessionPlanV2(request, state, sessionId, now);
  if (!snapshot) {
    const result = SessionPlanResultV2Schema.parse({
      schemaVersion: 'session-plan-result-v2',
      result: request.intent === 'review' ? 'nothing_due' : 'insufficient_safe_content',
      session: null,
    });
    await saveEvent(client, userId, request, result);
    return {
      created: false,
      result,
    };
  }
  await client.query(
    `select public.materialize_learning_session_v2(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
     )`,
    [
      sessionId,
      request.clientSessionId,
      request.idempotencyKey,
      state.curriculumVersionId,
      request.intent,
      request.targetMinutes,
      SESSION_PLAN_V2_MATERIALIZER_VERSION,
      state.contentManifestSha256,
      snapshot.humorContentVersion,
      now,
      snapshot,
      JSON.stringify(snapshot.activities),
    ],
  );
  const result = SessionPlanResultV2Schema.parse({
    schemaVersion: 'session-plan-result-v2',
    result: 'planned',
    session: {
      sessionId,
      clientSessionId: request.clientSessionId,
      status: 'planned',
      createdAt: now.toISOString(),
      snapshot,
    },
  });
  if (result.result !== 'planned') {
    throw new SessionPlanV2ServiceError(
      'SESSION_PLAN_INVALID',
      'The materialized Session result is invalid.',
    );
  }
  await saveEvent(client, userId, request, result);
  return { created: true, result };
}
