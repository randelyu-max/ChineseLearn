import { describe, expect, it } from 'vitest';

import {
  appendStroke,
  appendStrokePoint,
  denormalizeStrokePoint,
  MAX_POINTS_PER_STROKE,
  normalizeStrokePoint,
  replayStrokePrefixes,
  strokeToSvgPath,
  undoLastStroke,
  type Stroke,
} from './model';

function point(x: number, y: number, timestamp = 0) {
  return normalizeStrokePoint({ height: 100, timestamp, width: 200, x, y });
}

describe('normalized writing canvas model', () => {
  it('clamps and normalizes coordinates, timestamps, and pressure', () => {
    expect(
      normalizeStrokePoint({
        height: 100,
        pressure: 2,
        timestamp: -1,
        width: 200,
        x: 250,
        y: -10,
      }),
    ).toEqual({ pressure: 1, timestamp: 0, x: 1, y: 0 });
  });

  it('replays the same normalized trace at different canvas sizes', () => {
    const normalized = point(50, 25, 10);
    expect(denormalizeStrokePoint(normalized, 200, 100)).toEqual({ x: 50, y: 25 });
    expect(denormalizeStrokePoint(normalized, 400, 200)).toEqual({ x: 100, y: 50 });
  });

  it('produces scaled vector paths without changing the stored trace', () => {
    const stroke: Stroke = { points: [point(20, 20), point(100, 80)] };
    const before = JSON.stringify(stroke);
    expect(strokeToSvgPath(stroke, 200, 100)).toBe('M 20.00 20.00 L 100.00 80.00');
    expect(strokeToSvgPath(stroke, 400, 200)).toBe('M 40.00 40.00 L 200.00 160.00');
    expect(JSON.stringify(stroke)).toBe(before);
  });

  it('undoes only the most recent completed stroke', () => {
    const first: Stroke = { points: [point(10, 10)] };
    const second: Stroke = { points: [point(20, 20)] };
    const strokes = appendStroke(appendStroke([], first), second);
    expect(undoLastStroke(strokes)).toEqual([first]);
    const empty: readonly Stroke[] = [];
    expect(undoLastStroke(empty)).toBe(empty);
  });

  it('replays strokes in their original order and preserves stroke boundaries', () => {
    const strokes: readonly Stroke[] = [
      { points: [point(10, 10), point(20, 20)] },
      { points: [point(30, 30), point(40, 40)] },
    ];
    expect(replayStrokePrefixes(strokes, 0.5)).toEqual([strokes[0]]);
    expect(replayStrokePrefixes(strokes, 0.75)).toEqual([
      strokes[0],
      { points: [strokes[1]!.points[0]] },
    ]);
    expect(replayStrokePrefixes(strokes, 1)).toBe(strokes);
  });

  it('coalesces dense input and caps pathological point streams', () => {
    let stroke: Stroke = { points: [] };
    const startedAt = performance.now();
    for (let index = 0; index < 20_000; index += 1) {
      stroke = appendStrokePoint(
        stroke,
        normalizeStrokePoint({
          height: 1000,
          timestamp: index,
          width: 1000,
          x: index % 1000,
          y: (index * 3) % 1000,
        }),
      );
    }
    const path = strokeToSvgPath(stroke, 1000, 1000);
    expect(stroke.points.length).toBeLessThanOrEqual(MAX_POINTS_PER_STROKE);
    expect(path.startsWith('M ')).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
