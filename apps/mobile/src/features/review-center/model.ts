import {
  ReviewCenterSuccessResponseSchema,
  type ReviewCenterReasonCode,
  type ReviewCenterResponseData,
} from '@hanziquest/contracts';
import { z } from 'zod';

import type { ApiResult } from '../../lib/api/client';
import type { OfflineStore } from '../offline-storage';

const ReviewCenterCacheSchema = z
  .object({
    cachedAt: z.iso.datetime({ offset: true }),
    data: ReviewCenterSuccessResponseSchema.shape.data,
  })
  .strict();

export type ReviewCenterLoadResult =
  | { status: 'fresh' | 'cached_offline'; data: ReviewCenterResponseData; cachedAt: string }
  | { status: 'auth_expired' | 'offline_no_cache' | 'request_failed' };

export type ReviewCenterRequester = (
  path: string,
  init?: RequestInit,
) => Promise<ApiResult<unknown>>;

export const reviewReasonLabels: Readonly<Record<ReviewCenterReasonCode, string>> = {
  scheduled_review: '按计划巩固',
  recent_error: '再练一次会更稳',
  confusion_pair: '分清容易混淆的内容',
  stability_check: '确认记忆仍然牢固',
  pinyin_dependency: '逐步减少拼音辅助',
};

function cacheScope(userId: string): string {
  return `${userId}:review-center:cache`;
}

async function readCache(store: OfflineStore, userId: string) {
  const raw = await store.getSyncCursor(cacheScope(userId));
  if (!raw) return null;
  try {
    return ReviewCenterCacheSchema.parse(JSON.parse(raw));
  } catch {
    await store.removeSyncCursor(cacheScope(userId));
    return null;
  }
}

export async function loadReviewCenter(input: {
  isOnline: boolean;
  nowIso: string;
  request: ReviewCenterRequester;
  store: OfflineStore;
  userId: string;
}): Promise<ReviewCenterLoadResult> {
  if (input.isOnline) {
    const response = await input.request(
      '/api/review-center?schemaVersion=review-center-request-v1&limit=50',
    );
    if (response.ok) {
      const parsed = ReviewCenterSuccessResponseSchema.safeParse(response.value);
      if (!parsed.success) return { status: 'request_failed' };
      const cached = { cachedAt: input.nowIso, data: parsed.data.data };
      await input.store.setSyncCursor(cacheScope(input.userId), JSON.stringify(cached));
      return { status: 'fresh', ...cached };
    }
    if (response.status === 401) return { status: 'auth_expired' };
  }
  const cached = await readCache(input.store, input.userId);
  if (cached) return { status: 'cached_offline', ...cached };
  return { status: input.isOnline ? 'request_failed' : 'offline_no_cache' };
}

export async function invalidateReviewCenter(store: OfflineStore, userId: string): Promise<void> {
  await Promise.all([
    store.removeSyncCursor(cacheScope(userId)),
    store.removeSyncCursor(`${userId}:review-center`),
  ]);
}
