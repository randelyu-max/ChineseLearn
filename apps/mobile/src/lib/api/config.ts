export type ApiConfigResult =
  | { configured: true; value: { baseUrl: string } }
  | { configured: false; reason: 'invalid' | 'missing' };

export function loadApiConfig(environment: Record<string, string | undefined>): ApiConfigResult {
  const raw = environment.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return { configured: false, reason: 'missing' };
  try {
    const url = new URL(raw);
    const isLocal =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '10.0.2.2';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
      return { configured: false, reason: 'invalid' };
    }
    return { configured: true, value: { baseUrl: url.toString().replace(/\/$/, '') } };
  } catch {
    return { configured: false, reason: 'invalid' };
  }
}

export const apiConfiguration = loadApiConfig(process.env);
