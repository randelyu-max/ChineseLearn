import type { SessionPlanSnapshot } from '@hanziquest/contracts';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type { HanziQuestAuth } from '../auth/auth.js';
import type { ServerConfig } from '../config.js';

const userId = '20000000-0000-4000-8000-000000000001';
const clientSessionId = '20000000-0000-4000-8000-000000000002';
const sessionId = '20000000-0000-4000-8000-000000000003';
const createdAt = new Date('2026-07-23T10:00:00.000Z');
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

const supportDecision = {
  allowReveal: false,
  fadeStage: 0 as const,
  initialEvidenceSupport: 'pinyin_visible' as const,
  presentation: 'visible' as const,
  reason: 'support_not_yet_faded' as const,
};
const snapshot = {
  schemaVersion: 'session-plan-snapshot-v1',
  activities: [],
  algorithmVersion: 'session-planner-v2',
  domainMix: { hanziActivities: 0, pinyinActivities: 0, targetPinyinRatio: 0.3 },
  estimatedSeconds: 0,
  integrationAlgorithmVersion: 'pinyin-session-planner-v1',
  newConceptIds: [],
  newConceptLimit: 3,
  seed: clientSessionId,
  status: 'insufficient_safe_content',
  supportDecision,
  targetSeconds: 600,
} satisfies SessionPlanSnapshot;
const validRequest = {
  schemaVersion: 'session-plan-request-v1',
  clientSessionId,
  idempotencyKey: `session-plan:${clientSessionId}`,
  targetMinutes: 10,
};

function authenticatedAuth(): HanziQuestAuth {
  return {
    api: { getSession: async () => ({ user: { id: userId } }) },
    handler: async () => new Response(null, { status: 204 }),
  };
}

function replayPool() {
  const query = vi.fn(async (text: string) => {
    if (text.includes('from public.learning_sessions')) {
      return {
        rows: [
          {
            client_session_id: clientSessionId,
            created_at: createdAt,
            id: sessionId,
            plan: snapshot,
          },
        ],
      };
    }
    return { rows: [] };
  });
  const client = { query, release: vi.fn() };
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { client, pool, query };
}

describe('session-plan route', () => {
  it('denies unauthenticated requests before touching PostgreSQL', async () => {
    const auth = {
      api: { getSession: async () => null },
      handler: async () => new Response(null, { status: 204 }),
    } satisfies HanziQuestAuth;
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request('/api/session-plan', {
      body: JSON.stringify(validRequest),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(401);
    expect(pool.connect).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'UNAUTHENTICATED', schemaVersion: 'error-v1' },
    });
  });

  it('rejects invalid and forged ownership fields before opening a transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/session-plan',
      {
        body: JSON.stringify({ ...validRequest, userId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(response.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('replays the same immutable snapshot for an idempotency-key retry', async () => {
    const { client, pool, query } = replayPool();
    const app = createApp(config, authenticatedAuth(), pool);
    const first = await app.request('/api/session-plan', {
      body: JSON.stringify(validRequest),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const retry = await app.request('/api/session-plan', {
      body: JSON.stringify({ ...validRequest, targetMinutes: 20 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    const firstBody = await first.json();
    const retryBody = await retry.json();
    expect(retryBody.data).toEqual(firstBody.data);
    expect(retryBody.data.snapshot).toEqual(snapshot);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into'))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('replays by duplicate client session ID even with a new idempotency key', async () => {
    const { pool } = replayPool();
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/session-plan',
      {
        body: JSON.stringify({
          ...validRequest,
          idempotencyKey: `session-plan-retry:${clientSessionId}`,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { clientSessionId, sessionId, snapshot },
    });
  });
});
