import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { signInParent, signOutParent } from './service';

vi.mock('expo-linking', () => ({
  createURL: vi.fn(() => 'hanziquest://parent-update-password'),
}));

describe('parent auth service', () => {
  it('returns a safe code instead of a provider error message', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error('sensitive database detail'),
    });
    const client = { auth: { signInWithPassword } } as unknown as SupabaseClient;

    await expect(signInParent(client, ' parent@example.test ', 'password')).resolves.toEqual({
      ok: false,
      notice: 'generic',
    });
  });

  it('clears local credentials when global logout cannot reach the server', async () => {
    const signOut = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error('Network request failed') })
      .mockResolvedValueOnce({ error: null });
    const client = { auth: { signOut } } as unknown as SupabaseClient;

    await expect(signOutParent(client)).resolves.toEqual({ ok: true, value: undefined });
    expect(signOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
  });
});
