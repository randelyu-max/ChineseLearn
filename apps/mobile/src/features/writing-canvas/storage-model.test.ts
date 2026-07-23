import { describe, expect, it } from 'vitest';

import { normalizeStrokePoint } from './model';
import {
  createLocalSignatureProjectId,
  createWritingDraftRecord,
  parseWritingDraftRecord,
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
    expect(record.projectId).toBe(createLocalSignatureProjectId('user-a'));
    expect(record.selectedStyle).toBe('clear');
    expect(record.pendingEvents).toEqual([]);
    expect(WRITING_RAW_DATA_POLICY).toEqual({
      networkExport: false,
      persistence: 'local_only',
      purpose: 'own_chinese_name_practice',
    });
  });

  it('rejects unnormalized, unknown, or ownerless data', () => {
    expect(
      WritingDraftRecordSchema.safeParse({
        ...createWritingDraftRecord({
          chineseName: '王',
          ownerUserId: 'user-a',
          strokes: [],
          updatedAt: '2026-07-23T12:00:00.000Z',
        }),
        modelVersion: 'writing-canvas-v1',
        strokes: [{ points: [{ timestamp: 0, x: 2, y: 0, rawImage: 'not-allowed' }] }],
      }).success,
    ).toBe(false);
  });

  it('migrates a V1 trace locally without changing its owner or points', () => {
    const migrated = parseWritingDraftRecord({
      schemaVersion: 'writing-draft-v1',
      modelVersion: 'writing-canvas-v1',
      ownerUserId: 'user-a',
      chineseName: '王',
      strokes: [{ points: [{ timestamp: 0, x: 0.25, y: 0.75 }] }],
      updatedAt: '2026-07-23T12:00:00.000Z',
    });
    expect(migrated).toMatchObject({
      schemaVersion: 'writing-draft-v2',
      ownerUserId: 'user-a',
      selectedStyle: 'clear',
      practiceSequence: 0,
    });
    expect(migrated.strokes[0]?.points[0]).toEqual({
      timestamp: 0,
      x: 0.25,
      y: 0.75,
    });
  });
});
