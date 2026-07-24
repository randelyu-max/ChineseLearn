import {
  DIAGNOSTIC_CONTENT_VERSION,
  DiagnosticResultSummarySchema,
  type DiagnosticMutation,
  type DiagnosticResultSummary,
  type DiagnosticRun,
} from '@hanziquest/contracts';
import {
  createDiagnosticState,
  createSeededRandom,
  planNextDiagnosticStep,
  recordDiagnosticObservation,
  type DiagnosticItem,
  type DiagnosticState,
  type DiagnosticStep,
} from '@hanziquest/learning-engine';
import { z } from 'zod';

import type { OfflineStore } from '../offline-storage';
import { diagnosticContentItems } from './content';

const DiagnosticStateSchema = z
  .object({
    consecutiveErrors: z.number().int().nonnegative().max(36),
    observations: z.array(
      z
        .object({
          axis: z.enum([
            'spoken_audio_comprehension',
            'pinyin_recognition',
            'tone_discrimination',
            'hanzi_recognition',
            'word_reading',
            'sentence_reading',
          ]),
          correct: z.boolean(),
          itemId: z.string().min(1),
          level: z.number().int().min(0).max(4),
          observedAtMs: z.number().nonnegative(),
        })
        .strict(),
    ),
    presentedItemIds: z.array(z.string().min(1)).max(36),
    seed: z.string().trim().min(1).max(128),
    startedAtMs: z.number().nonnegative(),
  })
  .strict();

const LocalDiagnosticSchema = z
  .object({
    schemaVersion: z.literal('local-diagnostic-v1'),
    userId: z.uuid(),
    runId: z.uuid(),
    status: z.enum(['in_progress', 'pending_completed', 'pending_skipped']),
    state: DiagnosticStateSchema,
    result: DiagnosticResultSummarySchema.nullable(),
    startedAt: z.iso.datetime({ offset: true }),
    activeElapsedMs: z
      .number()
      .int()
      .nonnegative()
      .max(7 * 60 * 1_000),
    resumedAtMs: z.number().nonnegative().nullable(),
  })
  .strict();

export type LocalDiagnostic = z.infer<typeof LocalDiagnosticSchema>;

const scope = (userId: string) => `${userId}:diagnostic:v1`;

export async function loadLocalDiagnostic(
  store: OfflineStore,
  userId: string,
): Promise<LocalDiagnostic | null> {
  const raw = await store.getSyncCursor(scope(userId));
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = null;
  }
  const parsed = LocalDiagnosticSchema.safeParse(value);
  if (parsed.success && parsed.data.userId === userId) return parsed.data;
  await store.removeSyncCursor(scope(userId));
  return null;
}

export function createLocalDiagnostic(input: {
  nowIso: string;
  runId: string;
  seed: string;
  userId: string;
}): LocalDiagnostic {
  const nowMs = Date.parse(input.nowIso);
  return LocalDiagnosticSchema.parse({
    schemaVersion: 'local-diagnostic-v1',
    userId: input.userId,
    runId: input.runId,
    status: 'in_progress',
    state: createDiagnosticState(input.seed, { nowMs: () => nowMs, random: () => 0.5 }),
    result: null,
    startedAt: input.nowIso,
    activeElapsedMs: 0,
    resumedAtMs: nowMs,
  });
}

export function diagnosticClock(record: LocalDiagnostic, wallNowMs: number): number {
  const currentSegment =
    record.resumedAtMs === null ? 0 : Math.max(0, wallNowMs - record.resumedAtMs);
  return record.state.startedAtMs + record.activeElapsedMs + currentSegment;
}

export function pauseDiagnostic(record: LocalDiagnostic, wallNowMs: number): LocalDiagnostic {
  if (record.resumedAtMs === null) return record;
  return LocalDiagnosticSchema.parse({
    ...record,
    activeElapsedMs: record.activeElapsedMs + Math.max(0, wallNowMs - record.resumedAtMs),
    resumedAtMs: null,
  });
}

export function resumeDiagnostic(record: LocalDiagnostic, wallNowMs: number): LocalDiagnostic {
  return LocalDiagnosticSchema.parse({ ...record, resumedAtMs: wallNowMs });
}

export function nextDiagnosticStep(record: LocalDiagnostic, wallNowMs: number): DiagnosticStep {
  return planNextDiagnosticStep(
    record.state as DiagnosticState,
    diagnosticContentItems.map((content) => content.item),
    {
      nowMs: () => diagnosticClock(record, wallNowMs),
      random: createSeededRandom(`${record.state.seed}:${record.state.observations.length}`),
    },
  );
}

export function answerDiagnostic(
  record: LocalDiagnostic,
  item: DiagnosticItem,
  correct: boolean,
  nowMs: number,
): LocalDiagnostic {
  const state = recordDiagnosticObservation(record.state as DiagnosticState, item, correct, {
    nowMs: () => diagnosticClock(record, nowMs),
    random: () => 0.5,
  });
  const updated = {
    ...record,
    state,
    activeElapsedMs:
      record.activeElapsedMs +
      (record.resumedAtMs === null ? 0 : Math.max(0, nowMs - record.resumedAtMs)),
    resumedAtMs: nowMs,
  };
  const step = nextDiagnosticStep(LocalDiagnosticSchema.parse(updated), nowMs);
  return LocalDiagnosticSchema.parse(
    step.kind === 'complete'
      ? { ...updated, status: 'pending_completed', result: step.result }
      : updated,
  );
}

export function skipDiagnostic(record: LocalDiagnostic): LocalDiagnostic {
  return LocalDiagnosticSchema.parse({ ...record, status: 'pending_skipped', result: null });
}

export async function saveLocalDiagnostic(
  store: OfflineStore,
  record: LocalDiagnostic,
): Promise<void> {
  await store.setSyncCursor(scope(record.userId), JSON.stringify(record));
}

export type DiagnosticRequester = (
  path: string,
  init?: RequestInit,
) => Promise<{ ok: true; value: unknown } | { ok: false; status: number; code: string }>;

export async function syncDiagnostic(
  store: OfflineStore,
  record: LocalDiagnostic,
  request: DiagnosticRequester,
): Promise<'auth_expired' | 'pending' | 'synced'> {
  const start: DiagnosticMutation = {
    schemaVersion: 'diagnostic-run-v1',
    action: 'start',
    runId: record.runId,
    idempotencyKey: `diagnostic:start:${record.runId}`,
    algorithmVersion: 'diagnostic-v1',
    contentVersion: DIAGNOSTIC_CONTENT_VERSION,
    startedAt: record.startedAt,
  };
  const started = await request('/api/diagnostic', {
    method: 'POST',
    body: JSON.stringify(start),
  });
  if (!started.ok) return started.status === 401 ? 'auth_expired' : 'pending';
  if (record.status === 'in_progress') return 'synced';
  const terminal: DiagnosticMutation =
    record.status === 'pending_completed'
      ? {
          schemaVersion: 'diagnostic-run-v1',
          action: 'complete',
          runId: record.runId,
          idempotencyKey: `diagnostic:complete:${record.runId}`,
          result: record.result!,
        }
      : {
          schemaVersion: 'diagnostic-run-v1',
          action: 'skip',
          runId: record.runId,
          idempotencyKey: `diagnostic:skip:${record.runId}`,
          startedAt: record.startedAt,
        };
  const saved = await request('/api/diagnostic', {
    method: 'POST',
    body: JSON.stringify(terminal),
  });
  if (!saved.ok) return saved.status === 401 ? 'auth_expired' : 'pending';
  await store.removeSyncCursor(scope(record.userId));
  return 'synced';
}

export function resultMessage(result: DiagnosticResultSummary): string {
  switch (result.recommendedStartingPoint) {
    case 'spoken_audio_foundations':
      return '建议从基础听音和常用表达开始。';
    case 'pinyin_foundations':
      return '我们先建立拼音基础，再逐步连接汉字。';
    case 'hanzi_recognition_foundations':
      return '拼音基础不错，我们先加强汉字识别。';
    case 'word_reading':
      return '建议从常用词语阅读开始。';
    case 'sentence_reading':
      return '可以开始练习完整句子。';
    case 'short_sentence_reading':
      return '可以直接进入短句阅读。';
  }
}

export function responseRun(value: unknown): DiagnosticRun | null {
  if (!value || typeof value !== 'object') return null;
  return (value as { data?: DiagnosticRun }).data ?? null;
}
