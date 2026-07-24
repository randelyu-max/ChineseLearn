import { describe, expect, it, vi } from 'vitest';

import { createWebOfflineStore } from '../offline-storage/web-store';
import { invalidateReviewCenter, loadReviewCenter, reviewReasonLabels } from './model';

const USER_A = '20000000-0000-4000-8000-000000000001';
const USER_B = '20000000-0000-4000-8000-000000000002';
const NOW = '2026-07-24T12:00:00.000Z';

function store() {
  const values = new Map<string, string>();
  return createWebOfflineStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  });
}

function response() {
  return {
    apiVersion: 'v1',
    data: {
      schemaVersion: 'review-center-v1',
      generatedAt: NOW,
      summary: { dueNowCount: 0, overdueCount: 0, estimatedMinutes: 0, nextDueAt: null },
      groups: ['hanzi', 'pinyin', 'tone', 'word', 'sentence', 'confusion'].map((kind) => ({
        kind,
        count: 0,
        overdueCount: 0,
      })),
      items: [],
      pageInfo: { nextCursor: null, hasMore: false },
    },
    meta: { requestId: 'req_review_test', respondedAt: NOW },
  };
}

describe('mobile Review Center read model', () => {
  it('validates, caches, and restores a read offline for the same user', async () => {
    const offlineStore = store();
    await offlineStore.initialize();
    await expect(
      loadReviewCenter({
        isOnline: true,
        nowIso: NOW,
        request: vi.fn(async () => ({ ok: true as const, value: response() })),
        store: offlineStore,
        userId: USER_A,
      }),
    ).resolves.toMatchObject({ status: 'fresh' });
    await expect(
      loadReviewCenter({
        isOnline: false,
        nowIso: NOW,
        request: vi.fn(),
        store: offlineStore,
        userId: USER_A,
      }),
    ).resolves.toMatchObject({ status: 'cached_offline' });
  });

  it('isolates cached responses by user and invalidates after completion', async () => {
    const offlineStore = store();
    await offlineStore.initialize();
    await loadReviewCenter({
      isOnline: true,
      nowIso: NOW,
      request: async () => ({ ok: true as const, value: response() }),
      store: offlineStore,
      userId: USER_A,
    });
    await expect(
      loadReviewCenter({
        isOnline: false,
        nowIso: NOW,
        request: vi.fn(),
        store: offlineStore,
        userId: USER_B,
      }),
    ).resolves.toEqual({ status: 'offline_no_cache' });
    await invalidateReviewCenter(offlineStore, USER_A);
    await expect(
      loadReviewCenter({
        isOnline: false,
        nowIso: NOW,
        request: vi.fn(),
        store: offlineStore,
        userId: USER_A,
      }),
    ).resolves.toEqual({ status: 'offline_no_cache' });
  });

  it('maps every reason to supportive copy', () => {
    expect(Object.values(reviewReasonLabels).join(' ')).not.toMatch(/失败|很差|不及格/);
    expect(Object.keys(reviewReasonLabels)).toHaveLength(5);
  });

  it('distinguishes expired authentication and invalid server contracts', async () => {
    const offlineStore = store();
    await offlineStore.initialize();
    await expect(
      loadReviewCenter({
        isOnline: true,
        nowIso: NOW,
        request: async () => ({ ok: false as const, status: 401, code: 'UNAUTHENTICATED' }),
        store: offlineStore,
        userId: USER_A,
      }),
    ).resolves.toEqual({ status: 'auth_expired' });
    await expect(
      loadReviewCenter({
        isOnline: true,
        nowIso: NOW,
        request: async () => ({ ok: true as const, value: { data: 'invalid' } }),
        store: offlineStore,
        userId: USER_A,
      }),
    ).resolves.toEqual({ status: 'request_failed' });
  });
});
