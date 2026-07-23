import { normalizePinyinSyllable, type PinyinTone } from '@hanziquest/contracts';

export type PinyinToGlyphCandidate = Readonly<{
  accessibilityLabel: string;
  glyph: string;
  numbered: string;
  optionId: string;
}>;

export type PinyinToGlyphOption = Readonly<{
  accessibilityLabel: string;
  glyph: string;
  numbered: string;
  optionId: string;
  tone: PinyinTone;
}>;

export type PinyinToGlyphExerciseDefinition = Readonly<{
  activityId: string;
  contextHintZh: string | null;
  correctOptionId: string;
  options: readonly PinyinToGlyphOption[];
  prompt: Readonly<{
    accessibilityLabel: string;
    display: string;
    numbered: string;
    tone: PinyinTone;
  }>;
  targetOptionId: string;
}>;

export type PinyinToGlyphState = Readonly<{
  retryCount: number;
  selectedOptionId: string | null;
  status: 'awaiting-answer' | 'correct-feedback' | 'incorrect-feedback';
}>;

const HAN_GLYPH_PATTERN = /^\p{Script=Han}$/u;
const TONE_LABELS: Readonly<Record<PinyinTone, string>> = {
  1: '第一声',
  2: '第二声',
  3: '第三声',
  4: '第四声',
  5: '轻声',
};

function seededRank(seed: string, value: string): number {
  let hash = 2166136261;
  for (const character of `${seed}:${value}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function candidateDistance(
  target: ReturnType<typeof normalizePinyinSyllable> & object,
  candidate: ReturnType<typeof normalizePinyinSyllable> & object,
): number {
  if (candidate.numbered === target.numbered) return 0;
  if (candidate.base === target.base) return 1;
  if (candidate.initial === target.initial || candidate.final === target.final) return 2;
  if (candidate.tone === target.tone) return 3;
  return 4;
}

export function buildPinyinToGlyphExercise(
  input: Readonly<{
    activityId: string;
    candidates: readonly PinyinToGlyphCandidate[];
    contextHintZh?: string;
    optionCount?: 3 | 4 | 5;
    seed: string;
    targetOptionId: string;
  }>,
): PinyinToGlyphExerciseDefinition {
  const optionCount = input.optionCount ?? 4;
  const candidates = [
    ...new Map(input.candidates.map((candidate) => [candidate.optionId, candidate])).values(),
  ];
  if (candidates.length < optionCount) {
    throw new Error(`Pinyin-to-glyph exercises require at least ${optionCount} candidates.`);
  }
  if (new Set(candidates.map((candidate) => candidate.glyph)).size !== candidates.length) {
    throw new Error('Pinyin-to-glyph candidates must use distinct Han glyphs.');
  }

  const normalizedByOptionId = new Map(
    candidates.map((candidate) => {
      if (!HAN_GLYPH_PATTERN.test(candidate.glyph)) {
        throw new Error(`Expected one Han glyph for option ${candidate.optionId}.`);
      }
      if (!candidate.accessibilityLabel.trim()) {
        throw new Error(`Missing accessibility label for option ${candidate.optionId}.`);
      }
      const normalized = normalizePinyinSyllable(candidate.numbered);
      if (!normalized) throw new Error(`Invalid Pinyin candidate: ${candidate.numbered}`);
      return [candidate.optionId, normalized] as const;
    }),
  );

  const target = candidates.find((candidate) => candidate.optionId === input.targetOptionId);
  if (!target) throw new Error('The target Han glyph must be present in candidates.');
  const normalizedTarget = normalizedByOptionId.get(target.optionId)!;
  const exactReadingCount = [...normalizedByOptionId.values()].filter(
    (normalized) => normalized.numbered === normalizedTarget.numbered,
  ).length;
  const contextHintZh = input.contextHintZh?.trim() || null;
  if (exactReadingCount > 1 && !contextHintZh) {
    throw new Error('Ambiguous Pinyin-to-glyph choices require a context hint.');
  }

  const distractors = candidates
    .filter((candidate) => candidate.optionId !== target.optionId)
    .map((candidate) => ({
      candidate,
      distance: candidateDistance(normalizedTarget, normalizedByOptionId.get(candidate.optionId)!),
      rank: seededRank(input.seed, candidate.optionId),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.rank - right.rank ||
        left.candidate.optionId.localeCompare(right.candidate.optionId),
    )
    .slice(0, optionCount - 1)
    .map(({ candidate }) => candidate);

  const options = [target, ...distractors]
    .map((candidate) => {
      const normalized = normalizedByOptionId.get(candidate.optionId)!;
      return Object.freeze({
        accessibilityLabel: candidate.accessibilityLabel,
        glyph: candidate.glyph,
        numbered: normalized.numbered,
        optionId: candidate.optionId,
        tone: normalized.tone,
      });
    })
    .sort(
      (left, right) =>
        seededRank(`${input.seed}:options`, left.optionId) -
          seededRank(`${input.seed}:options`, right.optionId) ||
        left.optionId.localeCompare(right.optionId),
    );

  return Object.freeze({
    activityId: input.activityId,
    contextHintZh,
    correctOptionId: target.optionId,
    options: Object.freeze(options),
    prompt: Object.freeze({
      accessibilityLabel: `${normalizedTarget.display}，${TONE_LABELS[normalizedTarget.tone]}`,
      display: normalizedTarget.display,
      numbered: normalizedTarget.numbered,
      tone: normalizedTarget.tone,
    }),
    targetOptionId: target.optionId,
  });
}

const demoCandidates: readonly PinyinToGlyphCandidate[] = [
  {
    accessibilityLabel: '马，骑马的马',
    glyph: '马',
    numbered: 'ma3',
    optionId: '54000000-0000-4000-8000-000000000001',
  },
  {
    accessibilityLabel: '码，号码的码',
    glyph: '码',
    numbered: 'ma3',
    optionId: '54000000-0000-4000-8000-000000000002',
  },
  {
    accessibilityLabel: '妈，妈妈的妈',
    glyph: '妈',
    numbered: 'ma1',
    optionId: '54000000-0000-4000-8000-000000000003',
  },
  {
    accessibilityLabel: '麻，麻布的麻',
    glyph: '麻',
    numbered: 'ma2',
    optionId: '54000000-0000-4000-8000-000000000004',
  },
  {
    accessibilityLabel: '骂，责骂的骂',
    glyph: '骂',
    numbered: 'ma4',
    optionId: '54000000-0000-4000-8000-000000000005',
  },
  {
    accessibilityLabel: '吗，疑问词吗',
    glyph: '吗',
    numbered: 'ma5',
    optionId: '54000000-0000-4000-8000-000000000006',
  },
];

export const pinyinToGlyphDemoExercise = buildPinyinToGlyphExercise({
  activityId: '54000000-0000-4000-8000-000000000010',
  candidates: demoCandidates,
  contextHintZh: '提示：这个字出现在“骑 ___”里。',
  seed: 'pinyin-to-glyph-demo-v1',
  targetOptionId: demoCandidates[0]!.optionId,
});

export function createPinyinToGlyphState(): PinyinToGlyphState {
  return {
    retryCount: 0,
    selectedOptionId: null,
    status: 'awaiting-answer',
  };
}

export function selectPinyinToGlyphOption(
  exercise: PinyinToGlyphExerciseDefinition,
  state: PinyinToGlyphState,
  optionId: string,
): PinyinToGlyphState {
  if (state.status !== 'awaiting-answer') return state;
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }
  return {
    ...state,
    selectedOptionId: optionId,
    status: optionId === exercise.correctOptionId ? 'correct-feedback' : 'incorrect-feedback',
  };
}

export function retryPinyinToGlyph(state: PinyinToGlyphState): PinyinToGlyphState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        retryCount: state.retryCount + 1,
        selectedOptionId: null,
        status: 'awaiting-answer',
      };
}

export function pinyinToGlyphLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 112;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 112 };
}
