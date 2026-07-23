import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './config';

describe('loadApiConfig', () => {
  it('accepts HTTPS and explicit local development origins', () => {
    expect(loadApiConfig({ EXPO_PUBLIC_API_URL: 'https://api.example.com/' })).toEqual({
      configured: true,
      value: { baseUrl: 'https://api.example.com' },
    });
    expect(loadApiConfig({ EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3001' }).configured).toBe(true);
  });

  it('rejects missing, malformed, and insecure remote origins', () => {
    expect(loadApiConfig({})).toEqual({ configured: false, reason: 'missing' });
    expect(loadApiConfig({ EXPO_PUBLIC_API_URL: 'not-a-url' })).toEqual({
      configured: false,
      reason: 'invalid',
    });
    expect(loadApiConfig({ EXPO_PUBLIC_API_URL: 'http://example.com' })).toEqual({
      configured: false,
      reason: 'invalid',
    });
  });
});
