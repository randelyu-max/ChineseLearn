import type { Stroke } from './model';

export const SIGNATURE_CONSISTENCY_ALGORITHM_VERSION = 'signature-consistency-v1' as const;

export type SignatureConsistencyMetrics = Readonly<{
  direction: number;
  proportion: number;
  rhythm: number;
  structure: number;
}>;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function metric(value: number): number {
  return Number(clamp(value).toFixed(4));
}

function similarity(left: number, right: number): number {
  return clamp(1 - Math.abs(left - right) / Math.max(0.0001, Math.abs(left), Math.abs(right)));
}

function bounds(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (points.length === 0) return { height: 0, width: 0 };
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return {
    height: Math.max(...ys) - Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
  };
}

function averageDirection(strokes: readonly Stroke[]) {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const stroke of strokes) {
    const start = stroke.points[0];
    const end = stroke.points.at(-1);
    if (!start || !end) continue;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length === 0) continue;
    x += (end.x - start.x) / length;
    y += (end.y - start.y) / length;
    count += 1;
  }
  if (count === 0) return null;
  const averageX = x / count;
  const averageY = y / count;
  const length = Math.hypot(averageX, averageY);
  return length === 0 ? null : { x: averageX / length, y: averageY / length };
}

function averageDuration(strokes: readonly Stroke[]): number {
  const durations = strokes.flatMap((stroke) => {
    const start = stroke.points[0];
    const end = stroke.points.at(-1);
    return start && end && end.timestamp >= start.timestamp
      ? [end.timestamp - start.timestamp]
      : [];
  });
  return durations.length === 0
    ? 0
    : durations.reduce((total, duration) => total + duration, 0) / durations.length;
}

export function compareOwnSignaturePractices(
  baseline: readonly Stroke[],
  current: readonly Stroke[],
): SignatureConsistencyMetrics {
  if (baseline.length === 0 || current.length === 0) {
    return Object.freeze({ direction: 0, proportion: 0, rhythm: 0, structure: 0 });
  }
  const baselineBounds = bounds(baseline);
  const currentBounds = bounds(current);
  const baselineDirection = averageDirection(baseline);
  const currentDirection = averageDirection(current);
  const direction =
    baselineDirection === null && currentDirection === null
      ? 1
      : baselineDirection === null || currentDirection === null
        ? 0
        : clamp(
            (baselineDirection.x * currentDirection.x +
              baselineDirection.y * currentDirection.y +
              1) /
              2,
          );
  return Object.freeze({
    direction: metric(direction),
    proportion: metric(
      (similarity(baselineBounds.width, currentBounds.width) +
        similarity(baselineBounds.height, currentBounds.height)) /
        2,
    ),
    rhythm: metric(similarity(averageDuration(baseline), averageDuration(current))),
    structure: metric(
      (similarity(baseline.length, current.length) +
        similarity(
          baseline.reduce((total, stroke) => total + stroke.points.length, 0),
          current.reduce((total, stroke) => total + stroke.points.length, 0),
        )) /
        2,
    ),
  });
}
