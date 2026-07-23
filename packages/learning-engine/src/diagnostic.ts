export const DIAGNOSTIC_ALGORITHM_VERSION = 'diagnostic-v1' as const;

export const diagnosticAxes = Object.freeze([
  'spoken_audio_comprehension',
  'pinyin_recognition',
  'tone_discrimination',
  'hanzi_recognition',
  'word_reading',
  'sentence_reading',
] as const);

export type DiagnosticAxis = (typeof diagnosticAxes)[number];
export type DiagnosticLevel = 0 | 1 | 2 | 3 | 4;
export type DiagnosticPresentation =
  | 'audio_choice'
  | 'audio_tone_choice'
  | 'pinyin_choice'
  | 'hanzi_choice'
  | 'word_reading'
  | 'sentence_reading';
export type DiagnosticStopReason =
  'confidence_reached' | 'consecutive_errors' | 'time_limit' | 'item_limit' | 'content_exhausted';
export type RecommendedPinyinSupportMode = 'always' | 'adaptive' | 'tap_to_reveal' | 'hidden';
export type RecommendedStartingPoint =
  | 'spoken_audio_foundations'
  | 'pinyin_foundations'
  | 'hanzi_recognition_foundations'
  | 'word_reading'
  | 'sentence_reading'
  | 'short_sentence_reading';

export type DiagnosticItem = Readonly<{
  axis: DiagnosticAxis;
  id: string;
  level: DiagnosticLevel;
  presentation: DiagnosticPresentation;
}>;

export type DiagnosticObservation = Readonly<{
  axis: DiagnosticAxis;
  correct: boolean;
  itemId: string;
  level: DiagnosticLevel;
  observedAtMs: number;
}>;

export type DiagnosticState = Readonly<{
  consecutiveErrors: number;
  observations: readonly DiagnosticObservation[];
  presentedItemIds: readonly string[];
  seed: string;
  startedAtMs: number;
}>;

export type DiagnosticAxisEstimate = Readonly<{
  confidence: number;
  estimatedLevel: DiagnosticLevel;
  observedEvidenceCount: number;
}>;

export type DiagnosticResult = Readonly<{
  algorithmVersion: typeof DIAGNOSTIC_ALGORITHM_VERSION;
  axes: Readonly<Record<DiagnosticAxis, DiagnosticAxisEstimate>>;
  durationMs: number;
  observedEvidenceCount: number;
  recommendedPinyinSupportMode: RecommendedPinyinSupportMode;
  recommendedStartingPoint: RecommendedStartingPoint;
  seed: string;
  stopReason: DiagnosticStopReason;
}>;

export type DiagnosticConfig = Readonly<{
  confidenceThreshold: number;
  consecutiveErrorLimit: number;
  maxDurationMs: number;
  maxItems: number;
  minimumEvidencePerAxis: number;
}>;

export type DiagnosticDependencies = Readonly<{
  nowMs(): number;
  random(): number;
}>;

export type DiagnosticStep =
  | Readonly<{ kind: 'present_item'; item: DiagnosticItem }>
  | Readonly<{ kind: 'complete'; result: DiagnosticResult }>;

export const defaultDiagnosticConfig = Object.freeze({
  confidenceThreshold: 0.8,
  consecutiveErrorLimit: 5,
  maxDurationMs: 6 * 60 * 1_000,
  maxItems: 36,
  minimumEvidencePerAxis: 4,
} satisfies DiagnosticConfig);

const axisPriority: Readonly<Record<DiagnosticAxis, number>> = Object.freeze({
  spoken_audio_comprehension: 0,
  pinyin_recognition: 1,
  tone_discrimination: 2,
  hanzi_recognition: 3,
  word_reading: 4,
  sentence_reading: 5,
});

const presentationPriority: Readonly<Record<DiagnosticPresentation, number>> = Object.freeze({
  audio_choice: 0,
  audio_tone_choice: 1,
  pinyin_choice: 2,
  hanzi_choice: 3,
  word_reading: 4,
  sentence_reading: 5,
});

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteOr(value, minimum)));
}

function normalizedNow(dependencies: DiagnosticDependencies, minimum: number): number {
  return Math.max(minimum, finiteOr(dependencies.nowMs(), minimum));
}

function normalizedRandom(dependencies: DiagnosticDependencies): number {
  return clamp(dependencies.random(), 0, 0.999_999_999);
}

function normalizedConfig(config: Partial<DiagnosticConfig>): DiagnosticConfig {
  return Object.freeze({
    confidenceThreshold: clamp(
      config.confidenceThreshold ?? defaultDiagnosticConfig.confidenceThreshold,
      0.5,
      1,
    ),
    consecutiveErrorLimit: Math.max(
      1,
      Math.trunc(
        finiteOr(
          config.consecutiveErrorLimit ?? defaultDiagnosticConfig.consecutiveErrorLimit,
          defaultDiagnosticConfig.consecutiveErrorLimit,
        ),
      ),
    ),
    maxDurationMs: Math.max(
      1,
      Math.trunc(
        finiteOr(
          config.maxDurationMs ?? defaultDiagnosticConfig.maxDurationMs,
          defaultDiagnosticConfig.maxDurationMs,
        ),
      ),
    ),
    maxItems: Math.max(
      1,
      Math.trunc(
        finiteOr(
          config.maxItems ?? defaultDiagnosticConfig.maxItems,
          defaultDiagnosticConfig.maxItems,
        ),
      ),
    ),
    minimumEvidencePerAxis: Math.max(
      1,
      Math.trunc(
        finiteOr(
          config.minimumEvidencePerAxis ?? defaultDiagnosticConfig.minimumEvidencePerAxis,
          defaultDiagnosticConfig.minimumEvidencePerAxis,
        ),
      ),
    ),
  });
}

function mapAxes<T>(mapper: (axis: DiagnosticAxis) => T): Record<DiagnosticAxis, T> {
  return {
    spoken_audio_comprehension: mapper('spoken_audio_comprehension'),
    pinyin_recognition: mapper('pinyin_recognition'),
    tone_discrimination: mapper('tone_discrimination'),
    hanzi_recognition: mapper('hanzi_recognition'),
    word_reading: mapper('word_reading'),
    sentence_reading: mapper('sentence_reading'),
  };
}

function estimateAxis(
  axis: DiagnosticAxis,
  observations: readonly DiagnosticObservation[],
  minimumEvidence: number,
): DiagnosticAxisEstimate {
  const evidence = observations.filter((observation) => observation.axis === axis);
  const correctLevels = evidence
    .filter((observation) => observation.correct)
    .map((observation) => observation.level);
  const estimatedLevel = (
    correctLevels.length === 0 ? 0 : Math.max(...correctLevels)
  ) as DiagnosticLevel;
  const hasUpperBoundary = evidence.some(
    (observation) => !observation.correct && observation.level > estimatedLevel,
  );
  const agreement =
    evidence.length === 0
      ? 0
      : evidence.filter(
          (observation) => observation.correct === observation.level <= estimatedLevel,
        ).length / evidence.length;
  const evidenceCoverage = Math.min(1, evidence.length / minimumEvidence);
  const boundaryCoverage = hasUpperBoundary || estimatedLevel === 4 ? 1 : 0.75;
  const confidence = clamp(evidenceCoverage * boundaryCoverage * (0.75 + agreement * 0.25), 0, 1);

  return Object.freeze({
    confidence,
    estimatedLevel,
    observedEvidenceCount: evidence.length,
  });
}

export function estimateDiagnosticAxes(
  observations: readonly DiagnosticObservation[],
  minimumEvidencePerAxis = defaultDiagnosticConfig.minimumEvidencePerAxis,
): Readonly<Record<DiagnosticAxis, DiagnosticAxisEstimate>> {
  const minimumEvidence = Math.max(1, Math.trunc(finiteOr(minimumEvidencePerAxis, 1)));
  return Object.freeze(mapAxes((axis) => estimateAxis(axis, observations, minimumEvidence)));
}

export function createDiagnosticState(
  seed: string,
  dependencies: DiagnosticDependencies,
): DiagnosticState {
  const normalizedSeed = seed.trim();
  if (normalizedSeed.length === 0) throw new Error('A diagnostic seed is required.');
  return Object.freeze({
    consecutiveErrors: 0,
    observations: Object.freeze([]),
    presentedItemIds: Object.freeze([]),
    seed: normalizedSeed,
    startedAtMs: normalizedNow(dependencies, 0),
  });
}

function assertDiagnosticItem(item: DiagnosticItem): void {
  if (
    item.id.trim().length === 0 ||
    !diagnosticAxes.includes(item.axis) ||
    !Number.isInteger(item.level) ||
    item.level < 0 ||
    item.level > 4 ||
    !(item.presentation in presentationPriority)
  ) {
    throw new Error('Diagnostic item metadata is invalid.');
  }
}

export function recordDiagnosticObservation(
  state: DiagnosticState,
  item: DiagnosticItem,
  correct: boolean,
  dependencies: DiagnosticDependencies,
): DiagnosticState {
  assertDiagnosticItem(item);
  if (state.presentedItemIds.includes(item.id)) {
    throw new Error('A diagnostic item cannot contribute evidence twice.');
  }
  const observation = Object.freeze({
    axis: item.axis,
    correct,
    itemId: item.id,
    level: item.level,
    observedAtMs: normalizedNow(dependencies, state.startedAtMs),
  });
  return Object.freeze({
    ...state,
    consecutiveErrors: correct ? 0 : state.consecutiveErrors + 1,
    observations: Object.freeze([...state.observations, observation]),
    presentedItemIds: Object.freeze([...state.presentedItemIds, item.id]),
  });
}

function nextTargetLevel(
  axis: DiagnosticAxis,
  observations: readonly DiagnosticObservation[],
): DiagnosticLevel {
  const evidence = observations.filter((observation) => observation.axis === axis);
  const latest = evidence.at(-1);
  if (!latest) return 0;
  return clamp(latest.level + (latest.correct ? 1 : -1), 0, 4) as DiagnosticLevel;
}

function recommendedPinyinSupport(
  axes: Readonly<Record<DiagnosticAxis, DiagnosticAxisEstimate>>,
): RecommendedPinyinSupportMode {
  const pinyin = axes.pinyin_recognition.estimatedLevel;
  const tone = axes.tone_discrimination.estimatedLevel;
  const hanzi = axes.hanzi_recognition.estimatedLevel;
  const sentence = axes.sentence_reading.estimatedLevel;
  if (pinyin <= 1) return 'always';
  if (hanzi >= 3 && sentence >= 3 && pinyin >= 3 && tone >= 2) return 'hidden';
  if (pinyin >= 3 && hanzi >= 3) return 'tap_to_reveal';
  return 'adaptive';
}

function recommendedStart(
  axes: Readonly<Record<DiagnosticAxis, DiagnosticAxisEstimate>>,
): RecommendedStartingPoint {
  if (axes.spoken_audio_comprehension.estimatedLevel === 0) return 'spoken_audio_foundations';
  if (axes.pinyin_recognition.estimatedLevel <= 1 && axes.hanzi_recognition.estimatedLevel <= 1) {
    return 'pinyin_foundations';
  }
  if (axes.hanzi_recognition.estimatedLevel <= 1) return 'hanzi_recognition_foundations';
  if (axes.word_reading.estimatedLevel <= 1) return 'word_reading';
  if (axes.sentence_reading.estimatedLevel <= 2) return 'sentence_reading';
  return 'short_sentence_reading';
}

function createDiagnosticResult(
  state: DiagnosticState,
  stopReason: DiagnosticStopReason,
  nowMs: number,
  config: DiagnosticConfig,
): DiagnosticResult {
  const axes = estimateDiagnosticAxes(state.observations, config.minimumEvidencePerAxis);
  return Object.freeze({
    algorithmVersion: DIAGNOSTIC_ALGORITHM_VERSION,
    axes,
    durationMs: Math.max(0, nowMs - state.startedAtMs),
    observedEvidenceCount: state.observations.length,
    recommendedPinyinSupportMode: recommendedPinyinSupport(axes),
    recommendedStartingPoint: recommendedStart(axes),
    seed: state.seed,
    stopReason,
  });
}

function stopReason(
  state: DiagnosticState,
  axes: Readonly<Record<DiagnosticAxis, DiagnosticAxisEstimate>>,
  nowMs: number,
  config: DiagnosticConfig,
): DiagnosticStopReason | null {
  if (diagnosticAxes.every((axis) => axes[axis].confidence >= config.confidenceThreshold)) {
    return 'confidence_reached';
  }
  if (state.consecutiveErrors >= config.consecutiveErrorLimit) return 'consecutive_errors';
  if (nowMs - state.startedAtMs >= config.maxDurationMs) return 'time_limit';
  if (state.observations.length >= config.maxItems) return 'item_limit';
  return null;
}

function availableItemsForAxis(
  axis: DiagnosticAxis,
  state: DiagnosticState,
  items: readonly DiagnosticItem[],
  dependencies: DiagnosticDependencies,
): readonly Readonly<{ item: DiagnosticItem; distance: number; tieBreak: number }>[] {
  const targetLevel = nextTargetLevel(axis, state.observations);
  return items
    .filter((item) => item.axis === axis && !state.presentedItemIds.includes(item.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((item) =>
      Object.freeze({
        distance: Math.abs(item.level - targetLevel),
        item,
        tieBreak: normalizedRandom(dependencies),
      }),
    )
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        presentationPriority[left.item.presentation] -
          presentationPriority[right.item.presentation] ||
        left.tieBreak - right.tieBreak ||
        left.item.id.localeCompare(right.item.id),
    );
}

export function planNextDiagnosticStep(
  state: DiagnosticState,
  items: readonly DiagnosticItem[],
  dependencies: DiagnosticDependencies,
  configOverrides: Partial<DiagnosticConfig> = {},
): DiagnosticStep {
  const config = normalizedConfig(configOverrides);
  const nowMs = normalizedNow(dependencies, state.startedAtMs);
  const axes = estimateDiagnosticAxes(state.observations, config.minimumEvidencePerAxis);
  const reason = stopReason(state, axes, nowMs, config);
  if (reason) {
    return Object.freeze({
      kind: 'complete',
      result: createDiagnosticResult(state, reason, nowMs, config),
    });
  }

  const orderedAxes = [...diagnosticAxes].sort(
    (left, right) =>
      axes[left].observedEvidenceCount - axes[right].observedEvidenceCount ||
      axes[left].confidence - axes[right].confidence ||
      axisPriority[left] - axisPriority[right],
  );

  for (const axis of orderedAxes) {
    if (axes[axis].confidence >= config.confidenceThreshold) continue;
    const available = availableItemsForAxis(axis, state, items, dependencies);
    const selected = available[0]?.item;
    if (selected) {
      assertDiagnosticItem(selected);
      return Object.freeze({ item: selected, kind: 'present_item' });
    }
  }

  return Object.freeze({
    kind: 'complete',
    result: createDiagnosticResult(state, 'content_exhausted', nowMs, config),
  });
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed.trim() || 'diagnostic');
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
