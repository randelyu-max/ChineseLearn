import { describe, expect, it } from 'vitest';

import { type Stroke } from './model';
import {
  signatureStyles,
  SIGNATURE_TRANSFORM_ALGORITHM_VERSION,
  transformOwnNameSignature,
} from './signature-transform';

const strokes: readonly Stroke[] = [
  {
    points: [
      { pressure: 0.4, timestamp: 1, x: 0, y: 0 },
      { pressure: 0.8, timestamp: 2, x: 0.5, y: 0.5 },
      { timestamp: 3, x: 1, y: 1 },
    ],
  },
];

describe('deterministic own-name signature transforms', () => {
  it('is versioned, reproducible, and does not mutate its input', () => {
    const before = JSON.stringify(strokes);
    const input = {
      chineseName: '王家豪',
      scope: 'own_chinese_name' as const,
      strokes,
      style: 'flowing' as const,
    };
    expect(transformOwnNameSignature(input)).toEqual(transformOwnNameSignature(input));
    expect(transformOwnNameSignature(input).algorithmVersion).toBe(
      SIGNATURE_TRANSFORM_ALGORITHM_VERSION,
    );
    expect(JSON.stringify(strokes)).toBe(before);
  });

  it('keeps every supported style inside normalized canvas bounds', () => {
    for (const style of signatureStyles) {
      const result = transformOwnNameSignature({
        chineseName: '王家豪',
        scope: 'own_chinese_name',
        strokes,
        style,
      });
      for (const point of result.strokes.flatMap((stroke) => stroke.points)) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('preserves stroke order, point count, timing, and pressure', () => {
    for (const style of signatureStyles) {
      const result = transformOwnNameSignature({
        chineseName: '王家豪',
        scope: 'own_chinese_name',
        strokes,
        style,
      });
      expect(result.strokes.map((stroke) => stroke.points.length)).toEqual([3]);
      expect(result.strokes[0]!.points.map(({ timestamp }) => timestamp)).toEqual([1, 2, 3]);
      expect(result.strokes[0]!.points.map(({ pressure }) => pressure)).toEqual([
        0.4,
        0.8,
        undefined,
      ]);
    }
  });

  it('keeps clear geometry unchanged and compact geometry narrower', () => {
    const clear = transformOwnNameSignature({
      chineseName: '王家豪',
      scope: 'own_chinese_name',
      strokes,
      style: 'clear',
    });
    const compact = transformOwnNameSignature({
      chineseName: '王家豪',
      scope: 'own_chinese_name',
      strokes,
      style: 'compact',
    });
    expect(clear.strokes).toEqual(strokes);
    expect(compact.strokes[0]!.points.map(({ x }) => x)).toEqual([0.1, 0.5, 0.9]);
  });

  it('refuses generic or empty-name transformation inputs', () => {
    expect(() =>
      transformOwnNameSignature({
        chineseName: ' ',
        scope: 'own_chinese_name',
        strokes,
        style: 'clear',
      }),
    ).toThrow('Own Chinese name is required.');
  });
});
