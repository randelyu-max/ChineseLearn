export type AuthCallback =
  | { kind: 'code'; code: string; recovery: boolean }
  | {
      kind: 'tokens';
      accessToken: string;
      refreshToken: string;
      recovery: boolean;
    }
  | { kind: 'ignored' };

function parseParameters(raw: string): URLSearchParams {
  const normalized = raw.startsWith('?') || raw.startsWith('#') ? raw.slice(1) : raw;
  return new URLSearchParams(normalized);
}

export function parseAuthCallback(url: string): AuthCallback {
  try {
    const parsed = new URL(url);
    const query = parseParameters(parsed.search);
    const fragment = parseParameters(parsed.hash);
    const code = query.get('code');

    if (code) {
      return { kind: 'code', code, recovery: query.get('type') === 'recovery' };
    }

    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');

    if (accessToken && refreshToken) {
      return {
        kind: 'tokens',
        accessToken,
        refreshToken,
        recovery: fragment.get('type') === 'recovery',
      };
    }
  } catch {
    // Unknown links are deliberately ignored. Never echo callback contents.
  }

  return { kind: 'ignored' };
}
