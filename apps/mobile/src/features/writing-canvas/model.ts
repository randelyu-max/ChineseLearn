export const WRITING_CANVAS_MODEL_VERSION = 'writing-canvas-v1' as const;
export const MAX_STROKES_PER_DRAFT = 256;
export const MAX_POINTS_PER_STROKE = 2048;
export const MIN_POINT_DISTANCE = 0.0015;

export type StrokePoint = Readonly<{
  pressure?: number;
  timestamp: number;
  x: number;
  y: number;
}>;

export type Stroke = Readonly<{
  points: readonly StrokePoint[];
}>;

export type CanvasPointInput = Readonly<{
  height: number;
  pressure?: number;
  timestamp: number;
  width: number;
  x: number;
  y: number;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeStrokePoint(input: CanvasPointInput): StrokePoint {
  const width = Number.isFinite(input.width) && input.width > 0 ? input.width : 1;
  const height = Number.isFinite(input.height) && input.height > 0 ? input.height : 1;
  const pressure =
    typeof input.pressure === 'number' && Number.isFinite(input.pressure)
      ? clamp(input.pressure, 0, 1)
      : undefined;
  return Object.freeze({
    ...(pressure === undefined ? {} : { pressure }),
    timestamp: Number.isFinite(input.timestamp) && input.timestamp >= 0 ? input.timestamp : 0,
    x: clamp(input.x / width, 0, 1),
    y: clamp(input.y / height, 0, 1),
  });
}

export function denormalizeStrokePoint(
  point: StrokePoint,
  width: number,
  height: number,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({
    x: point.x * Math.max(0, width),
    y: point.y * Math.max(0, height),
  });
}

export function appendStrokePoint(stroke: Stroke, point: StrokePoint): Stroke {
  if (stroke.points.length >= MAX_POINTS_PER_STROKE) return stroke;
  const previous = stroke.points.at(-1);
  if (previous) {
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance < MIN_POINT_DISTANCE) return stroke;
  }
  return Object.freeze({ points: Object.freeze([...stroke.points, point]) });
}

export function appendStroke(strokes: readonly Stroke[], stroke: Stroke): readonly Stroke[] {
  if (stroke.points.length === 0 || strokes.length >= MAX_STROKES_PER_DRAFT) {
    return strokes;
  }
  return Object.freeze([...strokes, Object.freeze({ points: Object.freeze([...stroke.points]) })]);
}

export function undoLastStroke(strokes: readonly Stroke[]): readonly Stroke[] {
  if (strokes.length === 0) return strokes;
  return Object.freeze(strokes.slice(0, -1));
}

export function strokeToSvgPath(stroke: Stroke, width: number, height: number): string {
  return stroke.points
    .map((point, index) => {
      const canvasPoint = denormalizeStrokePoint(point, width, height);
      return `${index === 0 ? 'M' : 'L'} ${canvasPoint.x.toFixed(2)} ${canvasPoint.y.toFixed(2)}`;
    })
    .join(' ');
}

export function replayStrokePrefixes(
  strokes: readonly Stroke[],
  progress: number,
): readonly Stroke[] {
  const totalPointCount = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  if (totalPointCount === 0 || progress <= 0) return Object.freeze([]);
  if (progress >= 1) return strokes;
  let remaining = Math.max(1, Math.ceil(totalPointCount * progress));
  const replay: Stroke[] = [];
  for (const stroke of strokes) {
    if (remaining <= 0) break;
    const points = stroke.points.slice(0, remaining);
    if (points.length > 0) replay.push(Object.freeze({ points: Object.freeze(points) }));
    remaining -= points.length;
  }
  return Object.freeze(replay);
}
