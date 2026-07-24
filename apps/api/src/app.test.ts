import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import type { HanziQuestAuth } from './auth/auth.js';
import type { ServerConfig } from './config.js';

const config = {
  appOrigins: ['http://localhost:3000'],
  authSecret: 'test-secret-with-at-least-thirty-two-characters',
  authUrl: 'http://localhost:3001',
  databaseUrl: 'postgresql://localhost/test',
  emailVerificationRequired: true,
  host: '127.0.0.1',
  port: 3001,
  smtp: null,
} satisfies ServerConfig;
const auth = {
  api: { getSession: async () => null },
  handler: async () => new Response(null, { status: 204 }),
} satisfies HanziQuestAuth;
const pool = {} as Pool;

describe('API app', () => {
  it('exposes a Railway-compatible health endpoint without touching the database', async () => {
    const response = await createApp(config, auth, pool).request('/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'hanziquest-api',
      status: 'ok',
    });
  });

  it('denies private profile access without a session', async () => {
    const response = await createApp(config, auth, pool).request('/api/profile');
    expect(response.status).toBe(401);
  });

  it('denies attempts-batch access without a session', async () => {
    const response = await createApp(config, auth, pool).request('/api/attempts-batch', {
      body: '{}',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('denies review-center access without a session', async () => {
    const response = await createApp(config, auth, pool).request(
      '/api/review-center?schemaVersion=review-center-request-v1',
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('denies signature practice metadata access without a session', async () => {
    const response = await createApp(config, auth, pool).request(
      '/api/signature-practice/project',
      {
        body: '{}',
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
      },
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      apiVersion: 'v1',
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});
