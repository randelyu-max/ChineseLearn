import { describe, expect, it } from 'vitest';

import { ChunkedSecureSessionStorage, type AsyncKeyValueDriver } from './secure-session-storage';

class FakeDriver implements AsyncKeyValueDriver {
  readonly values = new Map<string, string>();
  failOnWriteNumber: number | null = null;
  writes = 0;

  async deleteItem(key: string): Promise<void> {
    this.values.delete(key);
  }

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.writes += 1;
    if (this.writes === this.failOnWriteNumber) throw new Error('simulated secure-store failure');
    this.values.set(key, value);
  }
}

describe('ChunkedSecureSessionStorage', () => {
  it('round-trips a session larger than a single secure-store item', async () => {
    const driver = new FakeDriver();
    const storage = new ChunkedSecureSessionStorage(driver, () => 'version-one', 256);
    const session = JSON.stringify({
      access_token: 'a'.repeat(900),
      refresh_token: 'b'.repeat(600),
    });

    await storage.setItem('sb-project-auth-token', session);

    expect(await storage.getItem('sb-project-auth-token')).toBe(session);
    expect(driver.values.size).toBeGreaterThan(2);
  });

  it('commits the new manifest before cleaning the previous chunks', async () => {
    const driver = new FakeDriver();
    const versions = ['version-one', 'version-two'];
    const storage = new ChunkedSecureSessionStorage(driver, () => versions.shift()!, 256);
    await storage.setItem('auth', 'old'.repeat(200));
    const oldKeys = [...driver.values.keys()].filter((key) => key.includes('version-one'));

    await storage.setItem('auth', 'new'.repeat(300));

    expect(await storage.getItem('auth')).toBe('new'.repeat(300));
    expect(oldKeys.every((key) => !driver.values.has(key))).toBe(true);
  });

  it('keeps the prior committed session readable when a replacement write crashes', async () => {
    const driver = new FakeDriver();
    const versions = ['version-one', 'version-two'];
    const storage = new ChunkedSecureSessionStorage(driver, () => versions.shift()!, 256);
    await storage.setItem('auth', 'stable'.repeat(100));
    driver.failOnWriteNumber = driver.writes + 2;

    await expect(storage.setItem('auth', 'replacement'.repeat(100))).rejects.toThrow(
      'simulated secure-store failure',
    );

    expect(await storage.getItem('auth')).toBe('stable'.repeat(100));
  });

  it('removes the manifest and every active encrypted chunk', async () => {
    const driver = new FakeDriver();
    const storage = new ChunkedSecureSessionStorage(driver, () => 'version-one', 256);
    await storage.setItem('auth', 'secret'.repeat(300));

    await storage.removeItem('auth');

    expect(await storage.getItem('auth')).toBeNull();
    expect(driver.values.size).toBe(0);
  });
});
