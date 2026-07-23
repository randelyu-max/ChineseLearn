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

describe('signature-practice route boundary', () => {
  it('rejects raw trace and image fields before PostgreSQL is opened', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request('/api/signature-practice/events', {
      body: JSON.stringify({
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId: '90000000-0000-4000-8000-000000000002',
        idempotencyKey: 'signature-practice:90000000-0000-4000-8000-000000000002',
        metrics: { direction: 1, proportion: 1, rhythm: 1, structure: 1 },
        occurredAt: '2026-07-23T12:00:00.000Z',
        projectId: '90000000-0000-4000-8000-000000000003',
        strokes: [{ points: [{ x: 0.5, y: 0.5 }] }],
        image: 'data:image/png;base64,raw',
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'SIGNATURE_PRACTICE_INVALID' },
    });
  });

  it('rejects ownership and summary fields on project writes', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    const response = await createApp(config, auth, pool).request(
      '/api/signature-practice/project',
      {
        body: JSON.stringify({
          schemaVersion: 'signature-project-request-v1',
          projectId: '90000000-0000-4000-8000-000000000003',
          chineseName: '王家豪',
          selectedStyle: 'clear',
          userId: '90000000-0000-4000-8000-000000000099',
          practiceCount: 999,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
      },
    );
    expect(response.status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});
