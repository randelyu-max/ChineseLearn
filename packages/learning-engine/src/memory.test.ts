import { describe, expect, it } from 'vitest';

import {
  calculateEffectiveMastery,
  calculateRetention,
  initialStabilityDays,
  safeReviewIntervalsDays,
  scheduleNextReview,
  stabilityAfterLapse,
  stabilityAfterRetrievalSuccess,
} from './memory';

const day = 86_400_000;

describe('memory stability and review scheduling', () => {
  it('matches the exponential retention hand calculation', () => {
    expect(calculateRetention(0, 7 * day, 7)).toBeCloseTo(Math.exp(-1), 12);
    expect(calculateEffectiveMastery(0.9, 0, 7 * day, 7)).toBeCloseTo(0.9 * Math.exp(-1), 12);
  });

  it('matches the documented retrieval-success formula', () => {
    expect(stabilityAfterRetrievalSuccess(10, 0.5, 0.8)).toBeCloseTo(15.3, 12);
    expect(stabilityAfterRetrievalSuccess(100, 1, 1)).toBe(120);
  });

  it('uses the lapse floor and always returns positive stability', () => {
    expect(stabilityAfterLapse(10)).toBe(3.5);
    expect(stabilityAfterLapse(0)).toBe(0.5);
    for (const value of [-100, 0, 0.7, 120, 1_000, Number.NaN]) {
      expect(stabilityAfterLapse(value)).toBeGreaterThan(0);
      expect(stabilityAfterRetrievalSuccess(value, 0.5, 0.5)).toBeGreaterThan(0);
    }
  });

  it('maps computed intervals to the safe review ladder', () => {
    const schedule = scheduleNextReview({
      nowMs: 1_000,
      reason: 'retrieval_success',
      stabilityDays: 120,
      targetRetention: 0.8,
    });
    expect(safeReviewIntervalsDays).toContain(schedule.intervalDays);
    expect(schedule.intervalDays).toBe(14);
    expect(schedule.nextReviewAtMs).toBe(1_000 + 14 * day);
    expect(schedule.reason).toBe('retrieval_success');
  });

  it('uses the documented initial stability for invalid input', () => {
    const schedule = scheduleNextReview({
      nowMs: 0,
      reason: 'new_item',
      stabilityDays: Number.NaN,
    });
    expect(schedule.rawIntervalDays).toBeCloseTo(-initialStabilityDays * Math.log(0.85), 12);
    expect(schedule.intervalDays).toBe(1);
  });

  it('is invariant for timestamps representing the same instant across time zones', () => {
    const utc = Date.parse('2026-01-15T12:00:00Z');
    const offset = Date.parse('2026-01-15T07:00:00-05:00');
    const lastSuccess = Date.parse('2026-01-12T12:00:00Z');
    expect(utc).toBe(offset);
    expect(calculateRetention(lastSuccess, utc, 3)).toBeCloseTo(
      calculateRetention(lastSuccess, offset, 3),
      15,
    );
  });

  it('does not access a wall clock and produces repeatable schedules', () => {
    const input = {
      nowMs: 123_456,
      reason: 'low_effective_mastery' as const,
      stabilityDays: 14,
    };
    expect(scheduleNextReview(input)).toEqual(scheduleNextReview(input));
  });
});
