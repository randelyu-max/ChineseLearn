import { describe, expect, it } from 'vitest';

import {
  clampProgress,
  interactiveSize,
  progressAnimationDuration,
  progressPercentage,
} from './component-rules';

describe('component accessibility rules', () => {
  it('clamps progress into the accessible range', () => {
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(0.45)).toBe(0.45);
    expect(clampProgress(2)).toBe(1);
    expect(clampProgress(Number.NaN)).toBe(0);
  });

  it('creates a readable integer progress value', () => {
    expect(progressPercentage(0.456)).toBe(46);
  });

  it('removes transition time when reduced motion is active', () => {
    expect(progressAnimationDuration(true)).toBe(0);
    expect(progressAnimationDuration(false)).toBeGreaterThan(0);
  });

  it('never creates a touch target below 48 dp', () => {
    expect(interactiveSize(24)).toBe(48);
    expect(interactiveSize(56)).toBe(56);
  });
});
