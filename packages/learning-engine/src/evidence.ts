export const PINYIN_EVIDENCE_ALGORITHM_VERSION = 'pinyin-evidence-v1' as const;

export const evidenceAxes = Object.freeze([
  'spoken_audio_comprehension',
  'pinyin_recognition',
  'tone_discrimination',
  'hanzi_recognition',
  'word_reading',
  'sentence_reading',
] as const);

export const pinyinSupportLevels = Object.freeze([
  'none',
  'pinyin_visible',
  'pinyin_revealed',
  'full_answer',
] as const);

export type EvidenceAxis = (typeof evidenceAxes)[number];
export type PinyinSupportLevel = (typeof pinyinSupportLevels)[number];

export type PinyinEvidenceInput = Readonly<{
  axis: EvidenceAxis;
  baseQuality: number;
  isCorrect: boolean;
  pinyinSupport: PinyinSupportLevel;
}>;

export type PinyinEvidenceMetadata = Readonly<{
  algorithmVersion: typeof PINYIN_EVIDENCE_ALGORITHM_VERSION;
  axis: EvidenceAxis;
  baseQuality: number;
  independentEvidenceQuality: number;
  independentEvidenceWeight: number;
  isCorrect: boolean;
  pinyinSupport: PinyinSupportLevel;
}>;

export const pinyinSupportEvidenceWeights = Object.freeze({
  full_answer: 0.1,
  none: 1,
  pinyin_revealed: 0.45,
  pinyin_visible: 0.75,
} satisfies Record<PinyinSupportLevel, number>);

function clampUnit(value: number): number {
  const finiteValue = Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(0, finiteValue));
}

function usesIndependentHanziEvidence(axis: EvidenceAxis): boolean {
  return axis === 'hanzi_recognition' || axis === 'word_reading' || axis === 'sentence_reading';
}

/**
 * Weights independent Hanzi evidence without changing whether the submitted answer was correct.
 * Pinyin support only affects Hanzi-dependent axes; it must not reduce Pinyin or audio evidence.
 */
export function calculatePinyinEvidenceWeighting(
  input: PinyinEvidenceInput,
): PinyinEvidenceMetadata {
  const baseQuality = clampUnit(input.baseQuality);
  const independentEvidenceWeight = usesIndependentHanziEvidence(input.axis)
    ? pinyinSupportEvidenceWeights[input.pinyinSupport]
    : 1;

  return Object.freeze({
    algorithmVersion: PINYIN_EVIDENCE_ALGORITHM_VERSION,
    axis: input.axis,
    baseQuality,
    independentEvidenceQuality: baseQuality * independentEvidenceWeight,
    independentEvidenceWeight,
    isCorrect: input.isCorrect,
    pinyinSupport: input.pinyinSupport,
  });
}
