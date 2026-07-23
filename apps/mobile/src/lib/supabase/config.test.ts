import { describe, expect, it } from 'vitest';

import { loadSupabasePublicConfig } from './config';

describe('loadSupabasePublicConfig', () => {
  it('accepts HTTPS and local Supabase endpoints with a publishable key', () => {
    expect(
      loadSupabasePublicConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }).configured,
    ).toBe(true);
    expect(
      loadSupabasePublicConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-anon-key',
      }).configured,
    ).toBe(true);
  });

  it('rejects missing, insecure remote, and explicit secret keys', () => {
    expect(loadSupabasePublicConfig({})).toEqual({ configured: false, reason: 'missing' });
    expect(
      loadSupabasePublicConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'http://example.com',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({ configured: false, reason: 'invalid_url' });
    expect(
      loadSupabasePublicConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-in-a-client',
      }),
    ).toEqual({ configured: false, reason: 'secret_key_rejected' });
  });
});
