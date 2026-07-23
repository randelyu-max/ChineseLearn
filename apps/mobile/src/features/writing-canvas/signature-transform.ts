import type { Stroke, StrokePoint } from './model';

export const SIGNATURE_TRANSFORM_ALGORITHM_VERSION = 'signature-transform-v1' as const;
export const signatureStyles = ['clear', 'compact', 'forward_leaning', 'flowing'] as const;
export type SignatureStyle = (typeof signatureStyles)[number];

export type OwnNameSignatureInput = Readonly<{
  chineseName: string;
  scope: 'own_chinese_name';
  strokes: readonly Stroke[];
  style: SignatureStyle;
}>;

export type OwnNameSignatureResult = Readonly<{
  algorithmVersion: typeof SIGNATURE_TRANSFORM_ALGORITHM_VERSION;
  chineseName: string;
  scope: 'own_chinese_name';
  selectedStyle: SignatureStyle;
  strokes: readonly Stroke[];
}>;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function transformPoint(point: StrokePoint, style: SignatureStyle): StrokePoint {
  if (style === 'clear') return Object.freeze({ ...point });
  if (style === 'compact') {
    return Object.freeze({ ...point, x: 0.1 + point.x * 0.8 });
  }
  if (style === 'forward_leaning') {
    return Object.freeze({
      ...point,
      x: clamp(0.04 + point.x * 0.84 + (1 - point.y) * 0.08),
    });
  }
  return Object.freeze({
    ...point,
    x: clamp(0.04 + point.x * 0.92),
    y: clamp(0.06 + point.y * 0.88 + Math.sin((point.x + point.y) * Math.PI) * 0.015),
  });
}

export function transformOwnNameSignature(input: OwnNameSignatureInput): OwnNameSignatureResult {
  const chineseName = input.chineseName.trim();
  if (!chineseName) throw new Error('Own Chinese name is required.');
  if (!signatureStyles.includes(input.style)) throw new Error('Unsupported signature style.');
  return Object.freeze({
    algorithmVersion: SIGNATURE_TRANSFORM_ALGORITHM_VERSION,
    chineseName,
    scope: 'own_chinese_name',
    selectedStyle: input.style,
    strokes: Object.freeze(
      input.strokes.map((stroke) =>
        Object.freeze({
          points: Object.freeze(stroke.points.map((point) => transformPoint(point, input.style))),
        }),
      ),
    ),
  });
}
