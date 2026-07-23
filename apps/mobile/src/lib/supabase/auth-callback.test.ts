import { describe, expect, it } from 'vitest';

import { parseAuthCallback } from './auth-callback';

describe('parseAuthCallback', () => {
  it('parses PKCE authorization codes', () => {
    expect(parseAuthCallback('hanziquest://auth/callback?code=one-time-code')).toEqual({
      kind: 'code',
      code: 'one-time-code',
      recovery: false,
    });
  });

  it('parses legacy recovery token fragments', () => {
    expect(
      parseAuthCallback(
        'hanziquest://auth/callback#access_token=access&refresh_token=refresh&type=recovery',
      ),
    ).toEqual({
      kind: 'tokens',
      accessToken: 'access',
      refreshToken: 'refresh',
      recovery: true,
    });
  });

  it('ignores malformed and unrelated links', () => {
    expect(parseAuthCallback('not a URL')).toEqual({ kind: 'ignored' });
    expect(parseAuthCallback('hanziquest://lesson/1')).toEqual({ kind: 'ignored' });
  });
});
