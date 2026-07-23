import { describe, expect, it } from 'vitest';

import {
  getWritingStrokeAsset,
  HANZI_WRITER_DATA_LICENSE,
  resolveOwnNameWritingAssets,
  writingStrokeAssets,
  WritingStrokeAssetSchema,
} from './writing';

describe('reviewed offline writing stroke assets', () => {
  it('keeps each path aligned with one ordered start/direction median', () => {
    for (const asset of Object.values(writingStrokeAssets)) {
      expect(WritingStrokeAssetSchema.parse(asset)).toStrictEqual(asset);
      expect(asset.strokes).toHaveLength(asset.medians.length);
      expect(asset.medians.every((median) => median.length >= 2)).toBe(true);
    }
  });

  it('contains the reviewed own-name fixture 王家豪', () => {
    expect(resolveOwnNameWritingAssets('王家豪')).toMatchObject({
      supported: [
        { character: '王', strokes: expect.any(Array) },
        { character: '家', strokes: expect.any(Array) },
        { character: '豪', strokes: expect.any(Array) },
      ],
      unsupported: [],
    });
  });

  it('falls back without inventing stroke data for unsupported characters', () => {
    expect(getWritingStrokeAsset('🙂')).toBeNull();
    expect(resolveOwnNameWritingAssets('王🙂')).toMatchObject({
      supported: [{ character: '王' }],
      unsupported: ['🙂'],
    });
  });

  it('records the redistributable data source and local license copy', () => {
    expect(HANZI_WRITER_DATA_LICENSE).toMatchObject({
      identifier: 'Arphic-Public-License',
      localLicensePath: 'docs/licenses/ARPHICPL.TXT',
    });
  });
});
