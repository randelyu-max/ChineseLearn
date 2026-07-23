import jiaData from 'hanzi-writer-data/家.json' with { type: 'json' };
import haoData from 'hanzi-writer-data/豪.json' with { type: 'json' };
import wangData from 'hanzi-writer-data/王.json' with { type: 'json' };
import { z } from 'zod';

export const WRITING_LESSON_CONTENT_VERSION = 'writing-lessons-v1' as const;
export const HANZI_WRITER_DATA_LICENSE = Object.freeze({
  identifier: 'Arphic-Public-License',
  localLicensePath: 'docs/licenses/ARPHICPL.TXT',
  sourceName: 'Hanzi Writer Data / Make Me a Hanzi',
  sourceReference: 'https://github.com/chanind/hanzi-writer-data/tree/v2.0.1',
} as const);

const MedianPointSchema = z.tuple([
  z.number().int().min(-128).max(1152),
  z.number().int().min(-128).max(1152),
]);

export const WritingStrokeAssetSchema = z
  .object({
    character: z.string().regex(/^\p{Script=Han}$/u),
    contentVersion: z.literal(WRITING_LESSON_CONTENT_VERSION),
    medians: z.array(z.array(MedianPointSchema).min(2)).min(1).max(64),
    source: z.literal('hanzi-writer-data@2.0.1'),
    strokes: z.array(z.string().trim().startsWith('M ').max(12_000)).min(1).max(64),
  })
  .strict()
  .superRefine((asset, context) => {
    if (asset.strokes.length !== asset.medians.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each stroke must have one direction median.',
        path: ['medians'],
      });
    }
  });

export type WritingStrokeAsset = z.infer<typeof WritingStrokeAssetSchema>;

function createAsset(
  character: string,
  data: Readonly<{ medians: number[][][]; strokes: string[] }>,
): WritingStrokeAsset {
  return WritingStrokeAssetSchema.parse({
    character,
    contentVersion: WRITING_LESSON_CONTENT_VERSION,
    medians: data.medians,
    source: 'hanzi-writer-data@2.0.1',
    strokes: data.strokes,
  });
}

export const writingStrokeAssets: Readonly<Record<string, WritingStrokeAsset>> = Object.freeze({
  家: createAsset('家', jiaData),
  王: createAsset('王', wangData),
  豪: createAsset('豪', haoData),
});

export function getWritingStrokeAsset(character: string): WritingStrokeAsset | null {
  return writingStrokeAssets[character] ?? null;
}

export function resolveOwnNameWritingAssets(chineseName: string): Readonly<{
  supported: readonly WritingStrokeAsset[];
  unsupported: readonly string[];
}> {
  const supported: WritingStrokeAsset[] = [];
  const unsupported: string[] = [];
  for (const character of [...chineseName]) {
    const asset = getWritingStrokeAsset(character);
    if (asset) supported.push(asset);
    else unsupported.push(character);
  }
  return Object.freeze({
    supported: Object.freeze(supported),
    unsupported: Object.freeze(unsupported),
  });
}
