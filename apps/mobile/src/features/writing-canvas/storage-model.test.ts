import { describe, expect, it } from 'vitest';

import { normalizeStrokePoint } from './model';
import {
  createWritingDraftRecord,
  WRITING_RAW_DATA_POLICY,
  WritingDraftRecordSchema,
} from './storage-model';

describe('local writing draft contract', () => {
  it('stores only normalized points for the current user own Chinese name', () => {
    const record = createWritingDraftRecord({
      chineseName: '王家豪',
      ownerUserId: 'user-a',
      strokes: [
        {
          points: [
            normalizeStrokePoint({
              height: 200,
              timestamp: 10,
              width: 100,
              x: 50,
              y: 50,
            }),
          ],
        },
      ],
      updatedAt: '2026-07-23T12:00:00.000Z',
    });
    expect(record.strokes[0]!.points[0]).toEqual({ timestamp: 10, x: 0.5, y: 0.25 });
    expect(WRITING_RAW_DATA_POLICY).toEqual({
      networkExport: false,
      persistence: 'local_only',
      purpose: 'own_chinese_name_practice',
    });
  });

  it('rejects unnormalized, unknown, or ownerless data', () => {
    expect(
      WritingDraftRecordSchema.safeParse({
        schemaVersion: 'writing-draft-v1',
        modelVersion: 'writing-canvas-v1',
        ownerUserId: '',
        chineseName: '王',
        strokes: [{ points: [{ timestamp: 0, x: 2, y: 0, rawImage: 'not-allowed' }] }],
        updatedAt: '2026-07-23T12:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});
