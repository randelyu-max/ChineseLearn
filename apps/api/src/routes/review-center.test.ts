import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type { HanziQuestAuth } from '../auth/auth.js';
import type { ServerConfig } from '../config.js';

const userId = '20000000-0000-4000-8000-000000000001';
const config = {
  appOrigins: ['http://localhost:3000'],
  authSecret: 'test-secret-with-at-least-thirty-two-characters',
  authUrl: 'http://localhost:3001',
  databaseUrl: 'postgresql://localhost/test',
  emailVerificationRequired: false,
  host: '127.0.0.1',
  port: 3001,
  smtp: null,
} satisfies ServerConfig;

function authenticatedAuth(): HanziQuestAuth {
  return {
    api: { getSession: async () => ({ user: { id: userId } }) },
    handler: async () => new Response(null, { status: 204 }),
  };
}

function readPool(rows: readonly Record<string, unknown>[] = []) {
  const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
    if (text.includes('with profile_settings')) return { rows };
    return { rows: [], values };
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { client, pool, query };
}

describe('review-center route', () => {
  it('denies unauthenticated requests before touching PostgreSQL', async () => {
    const auth = {
      api: { getSession: async () => null },
      handler: async () => new Response(null, { status: 204 }),
    } satisfies HanziQuestAuth;
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request(
      '/api/review-center?schemaVersion=review-center-request-v1',
    );
    expect(response.status).toBe(401);
    expect(pool.connect).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'UNAUTHENTICATED', schemaVersion: 'error-v1' },
    });
  });

  it('rejects forged ownership and invalid cursors before opening a transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const app = createApp(config, authenticatedAuth(), pool);
    const forged = await app.request(
      `/api/review-center?schemaVersion=review-center-request-v1&userId=${userId}`,
    );
    const invalidCursor = await app.request(
      '/api/review-center?schemaVersion=review-center-request-v1&cursor=bm90LXZhbGlk',
    );
    expect(forged.status).toBe(400);
    expect(invalidCursor.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('returns a valid empty state using only session ownership and read queries', async () => {
    const { client, pool, query } = readPool();
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/review-center?schemaVersion=review-center-request-v1&limit=10',
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      data: {
        schemaVersion: 'review-center-v1',
        summary: {
          dueNowCount: 0,
          overdueCount: 0,
          estimatedMinutes: 0,
          nextDueAt: null,
        },
        items: [],
        pageInfo: { nextCursor: null, hasMore: false },
      },
    });
    const sourceCall = query.mock.calls.find(([sql]) =>
      String(sql).includes('with profile_settings'),
    );
    expect(sourceCall?.[1]).toEqual([userId, 5001]);
    const sql = query.mock.calls.map(([text]) => String(text).toLowerCase()).join('\n');
    expect(sql).not.toMatch(/\b(insert|update|delete|merge|truncate)\b/);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('filters response fields through the strict shared contract', async () => {
    const { pool } = readPool([
      {
        source: 'schedule',
        review_key: 'review:character:one:audio_to_glyph',
        kind: 'hanzi',
        content_ref: 'character:one',
        display_label: '家',
        secondary_label: 'jiā',
        due_at: new Date('2020-01-01T00:00:00.000Z'),
        reason_code: 'recent_error',
        estimated_seconds: 60,
        recommended_activity_type: 'audio_to_glyph',
        recommended_pinyin_policy: 'adaptive',
        related_content_refs: [],
      },
    ]);
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/review-center?schemaVersion=review-center-request-v1',
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items[0]).toEqual({
      reviewKey: 'review:character:one:audio_to_glyph',
      kind: 'hanzi',
      contentRef: 'character:one',
      displayLabel: '家',
      secondaryLabel: 'jiā',
      dueAt: '2020-01-01T00:00:00.000Z',
      isOverdue: true,
      reasonCode: 'recent_error',
      estimatedSeconds: 60,
      recommendedActivityType: 'audio_to_glyph',
      recommendedPinyinPolicy: 'adaptive',
    });
    expect(JSON.stringify(body)).not.toContain(userId);
    expect(JSON.stringify(body)).not.toMatch(/correctAnswer|expectedValue|mastery_probability/);
  });
});
