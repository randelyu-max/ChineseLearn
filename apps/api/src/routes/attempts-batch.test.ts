import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import type { HanziQuestAuth } from '../auth/auth.js';
import type { ServerConfig } from '../config.js';

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

const auth = {
  api: {
    getSession: async () => ({
      user: { id: '90000000-0000-4000-8000-000000000001' },
    }),
  },
  handler: async () => new Response(null, { status: 204 }),
} satisfies HanziQuestAuth;

describe('attempts-batch route boundary', () => {
  it('rejects malformed and ownership-bearing batches before PostgreSQL', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request('/api/attempts-batch', {
      body: JSON.stringify({
        schemaVersion: 'attempts-batch-request-v1',
        sessionId: '90000000-0000-4000-8000-000000000002',
        idempotencyKey: 'attempts-batch:90000000-0000-4000-8000-000000000002',
        attempts: [],
        userId: '90000000-0000-4000-8000-000000000001',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'ATTEMPTS_BATCH_INVALID' },
    });
  });
});
