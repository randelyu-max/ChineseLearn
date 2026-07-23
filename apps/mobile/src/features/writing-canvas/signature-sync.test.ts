import { describe, expect, it, vi } from 'vitest';

import { createWritingDraftRecord } from './storage-model';
import { syncSignaturePracticeMetadata } from './signature-sync';

const projectId = '10000000-0000-4000-8000-000000000001';
const eventId = '10000000-0000-4000-8000-000000000002';

function response(practiceCount: number) {
  return {
    apiVersion: 'v1',
    data: {
      schemaVersion: 'signature-practice-summary-v1',
      calculatedAt: practiceCount === 0 ? null : '2026-07-23T12:00:00.000Z',
      practiceCount,
      projectId,
      scores: {
        direction: practiceCount === 0 ? null : 0.8,
        proportion: practiceCount === 0 ? null : 0.7,
        rhythm: practiceCount === 0 ? null : 0.6,
        structure: practiceCount === 0 ? null : 0.9,
      },
      selectedStyle: 'clear',
    },
    meta: {
      requestId: 'req_signature_sync_test',
      respondedAt: '2026-07-23T12:00:00.000Z',
    },
  };
}

function pendingRecord() {
  return createWritingDraftRecord({
    chineseName: '王家豪',
    ownerUserId: 'user-a',
    pendingEvents: [
      {
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId,
        idempotencyKey: `signature-practice:${eventId}`,
        metrics: { direction: 0.8, proportion: 0.7, rhythm: 0.6, structure: 0.9 },
        occurredAt: '2026-07-23T12:00:00.000Z',
        projectId,
      },
    ],
    projectId,
    strokes: [{ points: [{ timestamp: 1, x: 0.5, y: 0.5 }] }],
    updatedAt: '2026-07-23T12:00:00.000Z',
  });
}

describe('signature metadata sync', () => {
  it('sends project metadata and derived metrics without raw points or images', async () => {
    const requests: string[] = [];
    const sender = vi.fn(async (_path: string, init: RequestInit) => {
      requests.push(String(init.body));
      return { ok: true as const, value: response(requests.length - 1) };
    });
    const result = await syncSignaturePracticeMetadata(pendingRecord(), sender);
    expect(result.status).toBe('synced');
    expect(result.record.pendingEvents).toEqual([]);
    expect(result.record.serverSummary?.practiceCount).toBe(1);
    expect(requests.join(' ')).not.toMatch(/points|strokes|image|data:image/i);
  });

  it('keeps a persistent event pending when the network is unavailable', async () => {
    const sender = vi.fn(async () => ({
      ok: false as const,
      status: 0,
      code: 'network_unavailable',
    }));
    const original = pendingRecord();
    const result = await syncSignaturePracticeMetadata(original, sender);
    expect(result.status).toBe('unavailable');
    expect(result.record.pendingEvents).toEqual(original.pendingEvents);
  });
});
