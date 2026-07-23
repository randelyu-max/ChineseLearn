import { describe, expect, it } from 'vitest';

import {
  createConfusionPair,
  createEmptyConfusionStats,
  defaultConfusionRiskParameters,
  evaluateConfusionRisk,
  recordConfusionOpportunity,
  type ConfusionStats,
} from './confusion';

function recordMany(
  initial: ConfusionStats,
  shownConceptId: string,
  selectedConceptIds: readonly string[],
): ConfusionStats {
  return selectedConceptIds.reduce(
    (stats, selectedConceptId) =>
      recordConfusionOpportunity(stats, { selectedConceptId, shownConceptId }),
    initial,
  );
}

describe('confusion pair statistics', () => {
  it('canonicalizes A/B and B/A into the same shared pair', () => {
    expect(createConfusionPair('person', 'enter')).toEqual(createConfusionPair('enter', 'person'));
  });

  it('keeps A-to-B and B-to-A opportunities separate', () => {
    const pair = createConfusionPair('A', 'B');
    let stats = createEmptyConfusionStats(pair);
    stats = recordConfusionOpportunity(stats, { selectedConceptId: 'B', shownConceptId: 'A' });
    stats = recordConfusionOpportunity(stats, { selectedConceptId: 'B', shownConceptId: 'B' });
    stats = recordConfusionOpportunity(stats, { selectedConceptId: 'A', shownConceptId: 'B' });

    expect(stats).toMatchObject({
      leftAsRightCount: 1,
      leftShownCount: 1,
      rightAsLeftCount: 1,
      rightShownCount: 2,
    });
    expect(stats.pair).toBe(pair);
  });

  it('does not count an unrelated distractor as the paired confusion', () => {
    const pair = createConfusionPair('A', 'B');
    const stats = recordConfusionOpportunity(createEmptyConfusionStats(pair), {
      selectedConceptId: 'C',
      shownConceptId: 'A',
    });
    expect(stats.leftShownCount).toBe(1);
    expect(stats.leftAsRightCount).toBe(0);
  });

  it('rejects invalid pairs and observations outside the pair', () => {
    expect(() => createConfusionPair('A', 'A')).toThrow(/different concepts/);
    const stats = createEmptyConfusionStats(createConfusionPair('A', 'B'));
    expect(() =>
      recordConfusionOpportunity(stats, { selectedConceptId: 'A', shownConceptId: 'C' }),
    ).toThrow(/does not belong/);
  });

  it('does not mutate an existing statistics snapshot', () => {
    const initial = createEmptyConfusionStats(createConfusionPair('A', 'B'));
    const updated = recordConfusionOpportunity(initial, {
      selectedConceptId: 'B',
      shownConceptId: 'A',
    });
    expect(initial.leftShownCount).toBe(0);
    expect(updated.leftShownCount).toBe(1);
  });
});

describe('confusion risk evaluation', () => {
  it('does not activate on an insufficient sample even with a perfect error rate', () => {
    const pair = createConfusionPair('A', 'B');
    const stats = recordMany(createEmptyConfusionStats(pair), 'A', ['B', 'B', 'B']);
    const result = evaluateConfusionRisk(stats);

    expect(result.directions.leftAsRight.conditionalProbability).toBe(1);
    expect(result.riskScore).toBe(0);
    expect(result.isActive).toBe(false);
    expect(result.recommendedPracticeActivities).toBe(0);
  });

  it('activates one direction without falsely activating the reverse direction', () => {
    const pair = createConfusionPair('A', 'B');
    let stats = recordMany(createEmptyConfusionStats(pair), 'A', ['B', 'B', 'B', 'A', 'A']);
    stats = recordMany(stats, 'B', ['B', 'B', 'B', 'B', 'A']);
    const result = evaluateConfusionRisk(stats);

    expect(result.directions.leftAsRight.conditionalProbability).toBe(0.6);
    expect(result.directions.leftAsRight.isActive).toBe(true);
    expect(result.directions.rightAsLeft.conditionalProbability).toBe(0.2);
    expect(result.directions.rightAsLeft.isActive).toBe(false);
    expect(result.recommendedPracticeActivities).toBe(2);
  });

  it('does not let a high-rate insufficient reverse sample inflate practice intensity', () => {
    const pair = createConfusionPair('A', 'B');
    let stats = recordMany(createEmptyConfusionStats(pair), 'A', ['B', 'B', 'B', 'A', 'A']);
    stats = recordMany(stats, 'B', ['A']);
    const result = evaluateConfusionRisk(stats);

    expect(result.directions.rightAsLeft.conditionalProbability).toBe(1);
    expect(result.directions.rightAsLeft.isActive).toBe(false);
    expect(result.riskScore).toBe(0.6);
    expect(result.recommendedPracticeActivities).toBe(2);
  });

  it('reduces special practice after additional correct opportunities lower risk', () => {
    const pair = createConfusionPair('A', 'B');
    const initial = recordMany(createEmptyConfusionStats(pair), 'A', ['B', 'B', 'B', 'A', 'A']);
    const before = evaluateConfusionRisk(initial);
    const improved = recordMany(initial, 'A', ['A', 'A', 'A', 'A']);
    const after = evaluateConfusionRisk(improved);

    expect(before.recommendedPracticeActivities).toBe(2);
    expect(after.directions.leftAsRight.conditionalProbability).toBeCloseTo(1 / 3, 12);
    expect(after.riskScore).toBe(0);
    expect(after.recommendedPracticeActivities).toBe(0);
  });

  it('returns the documented recheck ladder only for active pairs', () => {
    const pair = createConfusionPair('A', 'B');
    const active = recordMany(createEmptyConfusionStats(pair), 'A', ['B', 'B', 'B', 'B', 'A']);
    expect(evaluateConfusionRisk(active).recheckIntervalsDays).toEqual([1, 3, 7]);
    expect(evaluateConfusionRisk(createEmptyConfusionStats(pair)).recheckIntervalsDays).toEqual([]);
  });

  it('keeps risk finite and bounded across malformed aggregate count inputs', () => {
    const pair = createConfusionPair('A', 'B');
    const values = [-100, 0, 1, 5, 100, Number.NaN, Number.POSITIVE_INFINITY];
    for (const leftShownCount of values) {
      for (const leftAsRightCount of values) {
        const result = evaluateConfusionRisk({
          ...createEmptyConfusionStats(pair),
          leftAsRightCount,
          leftShownCount,
        });
        expect(Number.isFinite(result.riskScore)).toBe(true);
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(1);
      }
    }
  });

  it('validates custom activation parameters', () => {
    const stats = createEmptyConfusionStats(createConfusionPair('A', 'B'));
    expect(() =>
      evaluateConfusionRisk(stats, {
        ...defaultConfusionRiskParameters,
        activationThreshold: 0,
      }),
    ).toThrow(/outside/);
  });
});
