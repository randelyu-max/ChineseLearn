import {
  parseWritingDraftRecord,
  WritingDraftRecordSchema,
  type WritingDraftRecord,
  type WritingDraftStore,
} from './storage-model';

export const WRITING_WEB_STORAGE_KEY = 'hanziquest.writing-drafts.v1';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
type WritingDraftDocument = Readonly<{
  drafts: Record<string, WritingDraftRecord>;
  schemaVersion: 1;
}>;

function emptyDocument(): WritingDraftDocument {
  return { drafts: {}, schemaVersion: 1 };
}

export function createWebWritingDraftStore(storage: StorageLike): WritingDraftStore {
  function read(): WritingDraftDocument {
    const raw = storage.getItem(WRITING_WEB_STORAGE_KEY);
    if (!raw) return emptyDocument();
    try {
      const input: unknown = JSON.parse(raw);
      if (
        typeof input !== 'object' ||
        input === null ||
        !('schemaVersion' in input) ||
        input.schemaVersion !== 1 ||
        !('drafts' in input) ||
        typeof input.drafts !== 'object' ||
        input.drafts === null
      ) {
        return emptyDocument();
      }
      const drafts: Record<string, WritingDraftRecord> = {};
      for (const [ownerUserId, candidate] of Object.entries(input.drafts)) {
        try {
          const parsed = parseWritingDraftRecord(candidate);
          if (parsed.ownerUserId === ownerUserId) {
            drafts[ownerUserId] = parsed;
          }
        } catch {
          // Ignore only this corrupt entry so another user's local draft remains available.
        }
      }
      return { drafts, schemaVersion: 1 };
    } catch {
      return emptyDocument();
    }
  }

  function write(document: WritingDraftDocument): void {
    storage.setItem(WRITING_WEB_STORAGE_KEY, JSON.stringify(document));
  }

  return {
    async clear(ownerUserId) {
      const document = read();
      if (!document.drafts[ownerUserId]) return;
      const drafts = { ...document.drafts };
      delete drafts[ownerUserId];
      if (Object.keys(drafts).length === 0) {
        storage.removeItem(WRITING_WEB_STORAGE_KEY);
      } else {
        write({ ...document, drafts });
      }
    },
    async load(ownerUserId) {
      return read().drafts[ownerUserId] ?? null;
    },
    async save(record) {
      const parsed = WritingDraftRecordSchema.parse(record);
      const document = read();
      write({
        ...document,
        drafts: { ...document.drafts, [parsed.ownerUserId]: parsed },
      });
    },
  };
}
