export type SupabasePublicConfig = Readonly<{
  publishableKey: string;
  url: string;
}>;

export type SupabaseConfigResult =
  | { configured: true; value: SupabasePublicConfig }
  | { configured: false; reason: 'missing' | 'invalid_url' | 'secret_key_rejected' };

function jwtRole(key: string): string | null {
  const payload = key.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded: unknown = JSON.parse(globalThis.atob(`${normalized}${padding}`));
    return typeof decoded === 'object' && decoded !== null && 'role' in decoded
      ? String(decoded.role)
      : null;
  } catch {
    return null;
  }
}

export function loadSupabasePublicConfig(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseConfigResult {
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const publishableKey = environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!url || !publishableKey) return { configured: false, reason: 'missing' };
  if (publishableKey.startsWith('sb_secret_') || jwtRole(publishableKey) === 'service_role') {
    return { configured: false, reason: 'secret_key_rejected' };
  }

  try {
    const parsed = new URL(url);
    const localHttp =
      parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !localHttp) {
      return { configured: false, reason: 'invalid_url' };
    }
  } catch {
    return { configured: false, reason: 'invalid_url' };
  }
  return { configured: true, value: { publishableKey, url } };
}
