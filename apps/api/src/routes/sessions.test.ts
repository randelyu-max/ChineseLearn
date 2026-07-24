import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type { HanziQuestAuth } from '../auth/auth.js';
import type { ServerConfig } from '../config.js';

const userId = '61000000-0000-4000-8000-000000000001';
const sessionId = '61000000-0000-4000-8000-000000000002';
const clientSessionId = '61000000-0000-4000-8000-000000000003';
const curriculumVersionId = '61000000-0000-4000-8000-000000000004';
const createdAt = new Date('2026-07-24T10:00:00.000Z');
const startedAt = new Date('2026-07-24T10:01:00.000Z');

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

const lifecycleRequest = {
  schemaVersion: 'session-lifecycle-request-v1',
  idempotencyKey: `session-start:${sessionId}`,
};

function authenticatedAuth(): HanziQuestAuth {
  return {
    api: { getSession: async () => ({ user: { id: userId } }) },
    handler: async () => new Response(null, { status: 204 }),
  };
}

function mockPool(query: ReturnType<typeof vi.fn>) {
  const client = { query, release: vi.fn() };
  return { client, pool: { connect: vi.fn(async () => client) } as unknown as Pool };
}

describe('Session lifecycle routes', () => {
  it('denies unauthenticated requests before opening PostgreSQL', async () => {
    const auth = {
      api: { getSession: async () => null },
      handler: async () => new Response(null, { status: 204 }),
    } satisfies HanziQuestAuth;
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request('/api/sessions/active');
    expect(response.status).toBe(401);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('returns an explicit none payload when there is no active Session', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from public.learning_sessions')) return { rows: [] };
      return { rows: [] };
    });
    const { pool } = mockPool(query);
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/sessions/active',
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        schemaVersion: 'active-session-v1',
        availability: 'none',
        session: null,
      },
    });
  });

  it('rejects forged ownership and malformed Session IDs before opening a transaction', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, authenticatedAuth(), pool).request(
      '/api/sessions/not-a-uuid/start',
      {
        body: JSON.stringify({ ...lifecycleRequest, userId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(response.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('starts a planned Session using the database server timestamp', async () => {
    const planned = {
      id: sessionId,
      client_session_id: clientSessionId,
      curriculum_version_id: curriculumVersionId,
      intent: 'learn',
      status: 'planned',
      target_minutes: 10,
      snapshot_schema_version: null,
      plan: {},
      started_at: null,
      completed_at: null,
      abandoned_at: null,
      abandoned_reason: null,
      created_at: createdAt,
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from public.learning_session_lifecycle_events')) return { rows: [] };
      if (sql.includes('for update')) return { rows: [planned] };
      if (sql.includes('update public.learning_sessions')) {
        return {
          rows: [{ ...planned, status: 'in_progress', started_at: startedAt }],
        };
      }
      return { rows: [] };
    });
    const { pool } = mockPool(query);
    const response = await createApp(config, authenticatedAuth(), pool).request(
      `/api/sessions/${sessionId}/start`,
      {
        body: JSON.stringify(lifecycleRequest),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        schemaVersion: 'session-lifecycle-v1',
        sessionId,
        status: 'in_progress',
        startedAt: startedAt.toISOString(),
      },
    });
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes('insert into public.learning_session')),
    ).toBe(true);
  });
});
