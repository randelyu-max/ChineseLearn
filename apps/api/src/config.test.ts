import { describe, expect, it } from 'vitest';

import { loadServerConfig } from './config.js';

const base = {
  APP_ORIGINS: 'hanziquest://,http://localhost:8081',
  BETTER_AUTH_SECRET: 'test-secret-with-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hanziquest',
};

describe('server config', () => {
  it('loads portable PostgreSQL and auth settings', () => {
    expect(loadServerConfig(base)).toMatchObject({
      appOrigins: ['hanziquest://', 'http://localhost:8081'],
      emailVerificationRequired: true,
      host: '0.0.0.0',
      port: 3001,
      smtp: null,
    });
  });

  it('allows an explicit local-only email verification bypass', () => {
    expect(loadServerConfig({ ...base, AUTH_REQUIRE_EMAIL_VERIFICATION: 'false' })).toMatchObject({
      emailVerificationRequired: false,
      smtp: null,
    });
    expect(() =>
      loadServerConfig({
        ...base,
        AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
        NODE_ENV: 'production',
      }),
    ).toThrow(/cannot be disabled in production/);
  });

  it('requires SMTP for production email verification', () => {
    expect(() => loadServerConfig({ ...base, NODE_ENV: 'production' })).toThrow(
      /SMTP must be configured/,
    );
  });

  it('rejects missing secrets and partial SMTP credentials', () => {
    expect(() => loadServerConfig({ ...base, BETTER_AUTH_SECRET: '' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => loadServerConfig({ ...base, SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP/);
    expect(() =>
      loadServerConfig({ ...base, AUTH_REQUIRE_EMAIL_VERIFICATION: 'sometimes' }),
    ).toThrow(/true or false/);
    expect(() => loadServerConfig({ ...base, BETTER_AUTH_SECRET: 'too-short' })).toThrow(
      /32 characters/,
    );
  });
});
