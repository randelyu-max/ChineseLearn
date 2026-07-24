import { approvedPinyinContentFixture } from '@hanziquest/curriculum';
import {
  buildPinyinIntegratedSessionPlan,
  type HanziPlanningCandidate,
  type PinyinPlanningCandidate,
  type PinyinSupportPreference,
  type RecentPerformance,
} from '@hanziquest/learning-engine';
import {
  SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION,
  SessionPlanSnapshotSchema,
  type SessionPlanRequest,
  type SessionPlanSnapshot,
} from '@hanziquest/contracts';
import type { PoolClient } from 'pg';

type CurriculumRow = {
  curriculum_version_id: string;
  pinyin_support_mode: PinyinSupportPreference;
};

type ConceptRow = {
  concept_id: string;
  concept_type: 'character' | 'sentence' | 'story' | 'word';
  difficulty: string | null;
  due_at: Date | null;
  exposure_count: number | null;
  lesson_id: string;
  mastery_probability: string | null;
  role: 'optional' | 'review' | 'target' | 'transfer';
};

type AttemptSignalRow = {
  correct: boolean;
  hint_level: number;
};

export type AuthoritativePlanningState = Readonly<{
  abilityEstimate: number;
  curriculumVersionId: string;
  eligibleCurriculumNodeIds: readonly string[];
  hanziCandidates: readonly HanziPlanningCandidate[];
  lessonId: string | null;
  masteredConceptIds: readonly string[];
  pinyinSupportPreference: PinyinSupportPreference;
  pinyinSupportSignals: Readonly<{
    consecutiveErrors: number;
    consecutiveIndependentSuccesses: number;
    fullAnswerRevealRate: number;
    recentIndependentAccuracy: number;
  }>;
  recentPerformance: RecentPerformance;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function numberFromDatabase(value: string | null, fallback: number): number {
  return value === null ? fallback : clamp(Number(value), 0, 1);
}

function categoryForConcept(row: ConceptRow, now: Date, mastery: number) {
  if (row.due_at && row.due_at.getTime() <= now.getTime()) return 'overdue_review' as const;
  if (row.role === 'transfer') return 'transfer_reading' as const;
  if (mastery >= 0.8) return 'quick_success' as const;
  if ((row.exposure_count ?? 0) > 0 || row.role === 'review') return 'weak_review' as const;
  return 'new_content' as const;
}

function hanziCandidatesFromRows(
  rows: readonly ConceptRow[],
  now: Date,
  supportPreference: PinyinSupportPreference,
): HanziPlanningCandidate[] {
  const supportBoost =
    supportPreference === 'always'
      ? 0.35
      : supportPreference === 'tap_to_reveal'
        ? 0.2
        : supportPreference === 'adaptive'
          ? 0.25
          : 0.05;
  const candidates: HanziPlanningCandidate[] = rows.map((row) => {
    const mastery = numberFromDatabase(row.mastery_probability, 0.15);
    const category = categoryForConcept(row, now, mastery);
    return Object.freeze({
      category,
      confusionPenalty: 0,
      curriculumNodeId: row.lesson_id,
      difficulty: numberFromDatabase(row.difficulty, category === 'new_content' ? 0.35 : 0.2),
      estimatedSeconds: row.concept_type === 'sentence' || row.concept_type === 'story' ? 90 : 60,
      id: `hanzi:${row.lesson_id}:${row.concept_type}:${row.concept_id}:${row.role}`,
      learningDomain: 'hanzi' as const,
      pinyinSupportEligible: row.concept_type !== 'story',
      prerequisiteConceptIds: Object.freeze([]),
      scores: Object.freeze({
        confusion: 0,
        curriculumNeed: row.role === 'target' ? 1 : 0.5,
        interest: row.role === 'optional' ? 0.7 : 0.5,
        overdue: category === 'overdue_review' ? 1 : 0,
        recentError: mastery < 0.5 ? 1 - mastery : 0,
        weakness: 1 - mastery,
      }),
      supportBoost,
      targetConceptIds: Object.freeze([row.concept_id]),
    });
  });

  const easiest = [...candidates].sort((left, right) => left.difficulty - right.difficulty)[0];
  if (easiest && !candidates.some((candidate) => candidate.category === 'quick_success')) {
    candidates.push(
      Object.freeze({
        ...easiest,
        category: 'quick_success' as const,
        difficulty: Math.min(0.1, easiest.difficulty),
        id: `${easiest.id}:confidence-close`,
        scores: Object.freeze({ ...easiest.scores, curriculumNeed: 0, weakness: 0 }),
      }),
    );
  }
  return candidates;
}

function pinyinCandidates(): PinyinPlanningCandidate[] {
  const node = 'pinyin-content-v1';
  const common = {
    confusion: 0,
    confusionPenalty: 0,
    curriculumNeed: 0.8,
    curriculumNodeId: node,
    duePriority: 0,
    estimatedSeconds: 50,
    interest: 0.5,
    prerequisiteConceptIds: Object.freeze([]),
    recentError: 0,
    supportBoost: 0.2,
    weakness: 0.7,
  } as const;
  const candidates: PinyinPlanningCandidate[] = [
    ...approvedPinyinContentFixture.initials.map((item) =>
      Object.freeze({
        ...common,
        difficulty: item.value === 'none' ? 0.1 : 0.25,
        id: `pinyin:initial:${item.id}`,
        kind: 'new' as const,
        skillType: 'initial' as const,
        targetConceptIds: Object.freeze([item.id]),
      }),
    ),
    ...approvedPinyinContentFixture.finals.map((item) =>
      Object.freeze({
        ...common,
        difficulty: 0.3,
        id: `pinyin:final:${item.id}`,
        kind: 'new' as const,
        skillType: 'final' as const,
        targetConceptIds: Object.freeze([item.id]),
      }),
    ),
    ...approvedPinyinContentFixture.tones.map((item) =>
      Object.freeze({
        ...common,
        difficulty: item.tone === 5 ? 0.35 : 0.25,
        id: `pinyin:tone:${item.tone}`,
        kind: 'new' as const,
        skillType: 'tone' as const,
        targetConceptIds: Object.freeze([`pinyin-tone:${item.tone}`]),
      }),
    ),
    ...approvedPinyinContentFixture.syllables.map((item) =>
      Object.freeze({
        ...common,
        difficulty: 0.4,
        id: `pinyin:syllable:${item.id}`,
        kind: 'new' as const,
        skillType: 'syllable' as const,
        targetConceptIds: Object.freeze([item.id]),
      }),
    ),
  ];
  const confidenceClose = candidates[0];
  if (confidenceClose) {
    candidates.push(
      Object.freeze({
        ...confidenceClose,
        difficulty: 0.05,
        id: `${confidenceClose.id}:confidence-close`,
        kind: 'review' as const,
        weakness: 0,
      }),
    );
  }
  return candidates;
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
  };
}

export async function loadAuthoritativePlanningState(
  client: PoolClient,
  userId: string,
  now: Date,
): Promise<AuthoritativePlanningState | null> {
  const curriculum = await client.query<CurriculumRow>(
    `select cv.id as curriculum_version_id, p.pinyin_support_mode
     from public.profiles p
     join public.active_curriculum_releases acr
       on acr.spoken_track = 'mandarin'
      and acr.script_track::text = p.script_preference
     join public.curriculum_versions cv
       on cv.id = acr.curriculum_version_id
      and cv.status = 'published'
     where p.id = $1`,
    [userId],
  );
  const authority = curriculum.rows[0];
  if (!authority) return null;

  const concepts = await client.query<ConceptRow>(
    `select
       lc.concept_id::text,
       lc.concept_type::text,
       coalesce(ss.difficulty, 0.35)::text as difficulty,
       rs.due_at,
       coalesce(ss.exposure_count, 0) as exposure_count,
       l.id::text as lesson_id,
       coalesce(ss.mastery_probability, 0.15)::text as mastery_probability,
       lc.role
     from public.worlds w
     join public.units u on u.world_id = w.id
     join public.lessons l on l.unit_id = u.id
     join public.lesson_concepts lc on lc.lesson_id = l.id
     left join lateral (
       select difficulty, exposure_count, mastery_probability
       from public.skill_states
       where user_id = $1
         and concept_type = lc.concept_type
         and concept_id = lc.concept_id
       order by mastery_probability asc
       limit 1
     ) ss on true
     left join lateral (
       select due_at
       from public.review_schedule
       where user_id = $1
         and concept_type = lc.concept_type
         and concept_id = lc.concept_id
       order by due_at asc
       limit 1
     ) rs on true
     where w.curriculum_version_id = $2
       and w.is_published
       and u.is_published
       and l.is_published
     order by l.sort_order, lc.sort_order, lc.concept_id`,
    [userId, authority.curriculum_version_id],
  );
  const attemptSignals = await client.query<AttemptSignalRow>(
    `select correct, hint_level
     from public.attempts
     where user_id = $1
     order by received_at desc
     limit 20`,
    [userId],
  );
  const hanziCandidates = hanziCandidatesFromRows(
    concepts.rows,
    now,
    authority.pinyin_support_mode,
  );
  const performance = performanceFromAttempts(attemptSignals.rows);
  const masteredConceptIds = concepts.rows
    .filter((row) => numberFromDatabase(row.mastery_probability, 0.15) >= 0.8)
    .map((row) => row.concept_id);
  const abilityEstimate =
    concepts.rows.length === 0
      ? 0.5
      : concepts.rows.reduce(
          (total, row) => total + numberFromDatabase(row.mastery_probability, 0.15),
          0,
        ) / concepts.rows.length;

  return Object.freeze({
    abilityEstimate,
    curriculumVersionId: authority.curriculum_version_id,
    eligibleCurriculumNodeIds: Object.freeze([
      ...new Set(concepts.rows.map((row) => row.lesson_id)),
      'pinyin-content-v1',
    ]),
    hanziCandidates: Object.freeze(hanziCandidates),
    lessonId: concepts.rows[0]?.lesson_id ?? null,
    masteredConceptIds: Object.freeze([...new Set(masteredConceptIds)]),
    pinyinSupportPreference: authority.pinyin_support_mode,
    pinyinSupportSignals: Object.freeze(performance.pinyinSupportSignals),
    recentPerformance: Object.freeze(performance.recentPerformance),
  });
}

export function buildAuthoritativeSessionPlan(
  request: SessionPlanRequest,
  state: AuthoritativePlanningState,
): SessionPlanSnapshot {
  const plan = buildPinyinIntegratedSessionPlan({
    abilityEstimate: state.abilityEstimate,
    eligibleCurriculumNodeIds: state.eligibleCurriculumNodeIds,
    hanziCandidates: state.hanziCandidates,
    masteredConceptIds: state.masteredConceptIds,
    pinyinCandidates: pinyinCandidates(),
    pinyinSupportPreference: state.pinyinSupportPreference,
    pinyinSupportSignals: state.pinyinSupportSignals,
    recentPerformance: state.recentPerformance,
    seed: request.clientSessionId,
    targetMinutes: request.targetMinutes,
  });
  return SessionPlanSnapshotSchema.parse({
    schemaVersion: SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION,
    ...plan,
  });
}
