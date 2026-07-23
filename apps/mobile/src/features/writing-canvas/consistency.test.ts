import { describe, expect, it } from 'vitest';

import { compareOwnSignaturePractices } from './consistency';
import type { Stroke } from './model';

const baseline: readonly Stroke[] = [
  {
    points: [
      { timestamp: 0, x: 0.1, y: 0.2 },
      { timestamp: 100, x: 0.8, y: 0.2 },
    ],
  },
  {
    points: [
      { timestamp: 120, x: 0.5, y: 0.1 },
      { timestamp: 220, x: 0.5, y: 0.9 },
    ],
  },
];

describe('own-practice consistency feedback', () => {
  it('gives identical local practices full consistency', () => {
    expect(compareOwnSignaturePractices(baseline, baseline)).toEqual({
      direction: 1,
      proportion: 1,
      rhythm: 1,
      structure: 1,
    });
  });

  it('is deterministic, bounded, and does not mutate raw traces', () => {
    const current: readonly Stroke[] = [
      {
        points: [
          { timestamp: 0, x: 0.2, y: 0.3 },
          { timestamp: 150, x: 0.7, y: 0.4 },
        ],
      },
    ];
    const before = JSON.stringify([baseline, current]);
    const result = compareOwnSignaturePractices(baseline, current);
    expect(result).toEqual(compareOwnSignaturePractices(baseline, current));
    expect(Object.values(result).every((score) => score >= 0 && score <= 1)).toBe(true);
    expect(JSON.stringify([baseline, current])).toBe(before);
  });

  it('returns neutral zero evidence until two non-empty practices exist', () => {
    expect(compareOwnSignaturePractices([], baseline)).toEqual({
      direction: 0,
      proportion: 0,
      rhythm: 0,
      structure: 0,
    });
  });

  it('treats two matching dot-only practices as consistent without inventing direction', () => {
    const dot: readonly Stroke[] = [{ points: [{ timestamp: 0, x: 0.5, y: 0.5 }] }];
    expect(compareOwnSignaturePractices(dot, dot)).toEqual({
      direction: 1,
      proportion: 1,
      rhythm: 1,
      structure: 1,
    });
  });
});
