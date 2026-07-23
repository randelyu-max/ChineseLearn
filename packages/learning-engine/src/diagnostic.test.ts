import { describe, expect, it } from 'vitest';

import {
  createDiagnosticState,
  createSeededRandom,
  diagnosticAxes,
  planNextDiagnosticStep,
  recordDiagnosticObservation,
  type DiagnosticConfig,
  type DiagnosticDependencies,
  type DiagnosticItem,
  type DiagnosticResult,
} from './diagnostic.ts';
import {
  diagnosticFixtureItems,
  diagnosticProfileFixtures,
  diagnosticStopFixtures,
  fixtureAnswer,
  type DiagnosticProfileFixture,
} from './diagnostic.fixtures.ts';

function runDiagnostic(input: {
  answer(item: DiagnosticItem): boolean;
  config?: Partial<DiagnosticConfig>;
  elapsedPerItemMs?: number;
  items?: readonly DiagnosticItem[];
  seed?: string;
}): Readonly<{ itemIds: readonly string[]; result: DiagnosticResult }> {
  const seed = input.seed ?? 'diagnostic-test-seed';
  let nowMs = 10_000;
  const dependencies: DiagnosticDependencies = {
    nowMs: () => nowMs,
    random: createSeededRandom(seed),
  };
  let state = createDiagnosticState(seed, dependencies);
  const itemIds: string[] = [];

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const step = planNextDiagnosticStep(
      state,
      input.items ?? diagnosticFixtureItems,
      dependencies,
      input.config,
    );
    if (step.kind === 'complete') {
      return Object.freeze({ itemIds: Object.freeze(itemIds), result: step.result });
    }
    itemIds.push(step.item.id);
    nowMs += input.elapsedPerItemMs ?? 1_000;
    state = recordDiagnosticObservation(state, step.item, input.answer(step.item), dependencies);
  }

  throw new Error('Diagnostic fixture exceeded the test iteration guard.');
}

function runProfile(fixture: DiagnosticProfileFixture, seed = fixture.id) {
  return runDiagnostic({
    answer: (item) => fixtureAnswer(fixture, item),
    seed,
  });
}

describe('multidimensional diagnostic profile fixtures', () => {
  it('distinguishes advanced spoken comprehension from starting Pinyin and Hanzi recognition', () => {
    const { result } = runProfile(
      diagnosticProfileFixtures.spokenAdvancedPinyinStartingHanziStarting,
    );

    expect(result.axes.spoken_audio_comprehension.estimatedLevel).toBe(4);
    expect(result.axes.pinyin_recognition.estimatedLevel).toBe(0);
    expect(result.axes.hanzi_recognition.estimatedLevel).toBe(0);
    expect(result.recommendedStartingPoint).toBe('pinyin_foundations');
    expect(result.recommendedPinyinSupportMode).toBe('always');
  });

  it('uses strong Pinyin as adaptive support while Hanzi recognition is starting', () => {
    const { result } = runProfile(
      diagnosticProfileFixtures.spokenAdvancedPinyinAdvancedHanziStarting,
    );

    expect(result.axes.pinyin_recognition.estimatedLevel).toBe(4);
    expect(result.axes.hanzi_recognition.estimatedLevel).toBe(0);
    expect(result.recommendedStartingPoint).toBe('hanzi_recognition_foundations');
    expect(result.recommendedPinyinSupportMode).toBe('adaptive');
  });

  it('places advanced Pinyin with developing Hanzi at sentence reading', () => {
    const { result } = runProfile(diagnosticProfileFixtures.pinyinAdvancedHanziDeveloping);

    expect(result.axes.pinyin_recognition.estimatedLevel).toBe(4);
    expect(result.axes.hanzi_recognition.estimatedLevel).toBe(2);
    expect(result.recommendedStartingPoint).toBe('sentence_reading');
  });

  it('allows advanced Hanzi readers to start with short sentences and hidden Pinyin', () => {
    const { result } = runProfile(diagnosticProfileFixtures.hanziReadingAdvanced);

    expect(result.axes.hanzi_recognition.estimatedLevel).toBe(4);
    expect(result.axes.sentence_reading.estimatedLevel).toBe(4);
    expect(result.recommendedStartingPoint).toBe('short_sentence_reading');
    expect(result.recommendedPinyinSupportMode).toBe('hidden');
  });

  it('gives a beginner a supportive audio-first foundation without negative labels', () => {
    const { itemIds, result } = runProfile(diagnosticProfileFixtures.beginner);

    expect(itemIds[0]).toMatch(/^spoken_audio_comprehension-/);
    expect(result.axes.spoken_audio_comprehension.estimatedLevel).toBe(0);
    expect(result.recommendedStartingPoint).toBe('spoken_audio_foundations');
    expect(JSON.stringify(result)).not.toMatch(/很差|弱|不及格|失败|\bweak\b|\bfail(?:ed|ure)?\b/i);
  });
});

describe('diagnostic stopping rules', () => {
  it('stops upward probing after the configured consecutive-error limit', () => {
    const { result } = runDiagnostic({
      answer: () => false,
      config: diagnosticStopFixtures.consecutiveErrors.config,
      seed: diagnosticStopFixtures.consecutiveErrors.id,
    });

    expect(result.stopReason).toBe('consecutive_errors');
    expect(result.observedEvidenceCount).toBe(3);
  });

  it('stops when the injected clock reaches the time limit', () => {
    const { result } = runDiagnostic({
      answer: () => true,
      config: diagnosticStopFixtures.timeLimit.config,
      elapsedPerItemMs: 2_000,
      seed: diagnosticStopFixtures.timeLimit.id,
    });

    expect(result.stopReason).toBe('time_limit');
    expect(result.durationMs).toBeGreaterThanOrEqual(5_000);
  });

  it('stops at the configured item limit', () => {
    const { result } = runDiagnostic({
      answer: () => true,
      config: diagnosticStopFixtures.itemLimit.config,
      seed: diagnosticStopFixtures.itemLimit.id,
    });

    expect(result.stopReason).toBe('item_limit');
    expect(result.observedEvidenceCount).toBe(5);
  });

  it('reports confidence reached for complete consistent evidence', () => {
    const { result } = runProfile(diagnosticProfileFixtures.hanziReadingAdvanced);

    expect(result.stopReason).toBe('confidence_reached');
    for (const axis of diagnosticAxes) {
      expect(result.axes[axis].confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.axes[axis].observedEvidenceCount).toBeGreaterThanOrEqual(4);
    }
  });

  it('reports content exhaustion when no eligible item remains', () => {
    const { result } = runDiagnostic({
      answer: () => true,
      items: diagnosticFixtureItems.slice(0, 1),
    });

    expect(result.stopReason).toBe('content_exhausted');
    expect(result.observedEvidenceCount).toBe(1);
  });
});

describe('diagnostic determinism and invariants', () => {
  it('is reproducible for a fixed seed and does not mutate content', () => {
    const before = JSON.stringify(diagnosticFixtureItems);
    const first = runProfile(diagnosticProfileFixtures.pinyinAdvancedHanziDeveloping, 'fixed-seed');
    const second = runProfile(
      diagnosticProfileFixtures.pinyinAdvancedHanziDeveloping,
      'fixed-seed',
    );

    expect(first).toEqual(second);
    expect(JSON.stringify(diagnosticFixtureItems)).toBe(before);
  });

  it('prefers audio and Pinyin evidence before reading axes', () => {
    const random = createSeededRandom('priority-seed');
    let nowMs = 0;
    const dependencies = { nowMs: () => nowMs, random };
    let state = createDiagnosticState('priority-seed', dependencies);
    const first = planNextDiagnosticStep(state, diagnosticFixtureItems, dependencies);
    expect(first.kind).toBe('present_item');
    if (first.kind !== 'present_item') return;
    expect(first.item.presentation).toBe('audio_choice');
    nowMs += 1_000;
    state = recordDiagnosticObservation(state, first.item, true, dependencies);
    const second = planNextDiagnosticStep(state, diagnosticFixtureItems, dependencies);
    expect(second.kind).toBe('present_item');
    if (second.kind === 'present_item') expect(second.item.presentation).toBe('pinyin_choice');
  });

  it('keeps all generated estimates and confidence values bounded across seeded response streams', () => {
    for (let fixtureIndex = 0; fixtureIndex < 100; fixtureIndex += 1) {
      const answerRandom = createSeededRandom(`answers-${fixtureIndex}`);
      const { result } = runDiagnostic({
        answer: () => answerRandom() >= 0.5,
        config: { consecutiveErrorLimit: 99, maxItems: 18 },
        seed: `planner-${fixtureIndex}`,
      });

      expect(result.observedEvidenceCount).toBeLessThanOrEqual(18);
      expect(Number.isFinite(result.durationMs)).toBe(true);
      for (const axis of diagnosticAxes) {
        const estimate = result.axes[axis];
        expect(estimate.estimatedLevel).toBeGreaterThanOrEqual(0);
        expect(estimate.estimatedLevel).toBeLessThanOrEqual(4);
        expect(estimate.confidence).toBeGreaterThanOrEqual(0);
        expect(estimate.confidence).toBeLessThanOrEqual(1);
        expect(estimate.observedEvidenceCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects duplicate evidence and an empty seed', () => {
    const dependencies = { nowMs: () => 0, random: createSeededRandom('validation') };
    expect(() => createDiagnosticState(' ', dependencies)).toThrow(/seed/i);
    const state = createDiagnosticState('validation', dependencies);
    const item = diagnosticFixtureItems[0];
    expect(item).toBeDefined();
    if (!item) return;
    const observed = recordDiagnosticObservation(state, item, true, dependencies);
    expect(() => recordDiagnosticObservation(observed, item, true, dependencies)).toThrow(
      /cannot contribute evidence twice/i,
    );
  });
});
