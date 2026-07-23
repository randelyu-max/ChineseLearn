export type AsyncKeyValueDriver = {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

type Manifest = Readonly<{
  chunkCount: number;
  version: string;
}>;

const defaultChunkSize = 1800;
const maximumChunkCount = 128;

function safeKey(key: string): string {
  return `hq_auth_${key.replaceAll(/[^A-Za-z0-9._-]/g, '_')}`;
}

function manifestKey(key: string): string {
  return `${safeKey(key)}.manifest`;
}

function chunkKey(key: string, version: string, index: number): string {
  return `${safeKey(key)}.${version}.${index}`;
}

function parseManifest(value: string | null): Manifest | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string' &&
      /^[A-Za-z0-9-]+$/.test(parsed.version) &&
      'chunkCount' in parsed &&
      typeof parsed.chunkCount === 'number' &&
      Number.isInteger(parsed.chunkCount) &&
      Number(parsed.chunkCount) > 0 &&
      Number(parsed.chunkCount) <= maximumChunkCount
    ) {
      return { version: parsed.version, chunkCount: Number(parsed.chunkCount) };
    }
  } catch {
    return null;
  }
  return null;
}

function splitValue(value: string, chunkSize: number): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  if (chunks.length > maximumChunkCount) {
    throw new Error('Secure session is larger than the supported encrypted storage limit.');
  }
  return chunks;
}

export class ChunkedSecureSessionStorage {
  constructor(
    private readonly driver: AsyncKeyValueDriver,
    private readonly createVersion: () => string,
    private readonly chunkSize = defaultChunkSize,
  ) {
    if (!Number.isInteger(chunkSize) || chunkSize < 256) {
      throw new Error('Secure storage chunk size must be an integer of at least 256 characters.');
    }
  }

  async getItem(key: string): Promise<string | null> {
    const manifest = parseManifest(await this.driver.getItem(manifestKey(key)));
    if (!manifest) return null;

    const chunks = await Promise.all(
      Array.from({ length: manifest.chunkCount }, (_, index) =>
        this.driver.getItem(chunkKey(key, manifest.version, index)),
      ),
    );
    return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
  }

  async removeItem(key: string): Promise<void> {
    const manifest = parseManifest(await this.driver.getItem(manifestKey(key)));
    if (manifest) {
      await Promise.all(
        Array.from({ length: manifest.chunkCount }, (_, index) =>
          this.driver.deleteItem(chunkKey(key, manifest.version, index)),
        ),
      );
    }
    await this.driver.deleteItem(manifestKey(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    const previous = parseManifest(await this.driver.getItem(manifestKey(key)));
    const version = this.createVersion().replaceAll(/[^A-Za-z0-9-]/g, '');
    if (!version) throw new Error('Secure storage version must not be empty.');
    const chunks = splitValue(value, this.chunkSize);

    await Promise.all(
      chunks.map((chunk, index) => this.driver.setItem(chunkKey(key, version, index), chunk)),
    );
    await this.driver.setItem(
      manifestKey(key),
      JSON.stringify({ chunkCount: chunks.length, version } satisfies Manifest),
    );

    if (previous && previous.version !== version) {
      await Promise.allSettled(
        Array.from({ length: previous.chunkCount }, (_, index) =>
          this.driver.deleteItem(chunkKey(key, previous.version, index)),
        ),
      );
    }
  }
}

export class MemorySessionStorage {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}
