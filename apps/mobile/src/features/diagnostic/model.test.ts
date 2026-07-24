import { describe, expect, it, vi } from 'vitest';

import { createWebOfflineStore } from '../offline-storage/web-store';
import {
  answerDiagnostic,
  createLocalDiagnostic,
  diagnosticClock,
  loadLocalDiagnostic,
  nextDiagnosticStep,
  pauseDiagnostic,
  resumeDiagnostic,
  saveLocalDiagnostic,
  skipDiagnostic,
  syncDiagnostic,
} from './model';
import { diagnosticContentItems } from './content';

const userA = '10000000-0000-4000-8000-000000000001';
const userB = '20000000-0000-4000-8000-000000000002';
const runId = '30000000-0000-4000-8000-000000000003';
const nowIso = '2026-07-24T10:00:00.000Z';

function store() {
  const values = new Map<string, string>();
  return createWebOfflineStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  });
}

describe('diagnostic local lifecycle', () => {
  it('uses a fixed 36-item pack with audio for audio-first axes', () => {
    expect(diagnosticContentItems).toHaveLength(36);
    expect(new Set(diagnosticContentItems.map((item) => item.item.id)).size).toBe(36);
    expect(
      diagnosticContentItems
        .filter((item) =>
          ['spoken_audio_comprehension', 'tone_discrimination'].includes(item.item.axis),
        )
        .every((item) => item.speechText !== null),
    ).toBe(true);
  });

  it('pauses and restores a deterministic per-user step', async () => {
    const offline = store();
    await offline.initialize();
    const initial = createLocalDiagnostic({ nowIso, runId, seed: 'fixed', userId: userA });
    const first = nextDiagnosticStep(initial, Date.parse(nowIso));
    expect(first.kind).toBe('present_item');
    if (first.kind !== 'present_item') throw new Error('Expected a diagnostic item.');
    const answered = answerDiagnostic(initial, first.item, true, Date.parse(nowIso) + 1_000);
    const paused = pauseDiagnostic(answered, Date.parse(nowIso) + 2_000);
    await saveLocalDiagnostic(offline, paused);
    const restored = await loadLocalDiagnostic(offline, userA);
    expect(restored?.state.observations).toHaveLength(1);
    const resumed = resumeDiagnostic(restored!, Date.parse(nowIso) + 62_000);
    expect(diagnosticClock(resumed, Date.parse(nowIso) + 62_000)).toBe(Date.parse(nowIso) + 2_000);
    expect(nextDiagnosticStep(resumed, Date.parse(nowIso) + 62_000)).toEqual(
      nextDiagnosticStep(paused, Date.parse(nowIso) + 2_000),
    );
  });

  it('does not expose one user local run to another user', async () => {
    const offline = store();
    await offline.initialize();
    await saveLocalDiagnostic(
      offline,
      createLocalDiagnostic({ nowIso, runId, seed: 'user-a', userId: userA }),
    );
    expect(await loadLocalDiagnostic(offline, userB)).toBeNull();
  });

  it('keeps skipped work offline and removes it after ordered start/terminal sync', async () => {
    const offline = store();
    await offline.initialize();
    const skipped = skipDiagnostic(
      createLocalDiagnostic({ nowIso, runId, seed: 'skip', userId: userA }),
    );
    await saveLocalDiagnostic(offline, skipped);
    const unavailable = vi.fn().mockResolvedValue({
      ok: false,
      status: 0,
      code: 'network_unavailable',
    });
    await expect(syncDiagnostic(offline, skipped, unavailable)).resolves.toBe('pending');
    expect(await loadLocalDiagnostic(offline, userA)).not.toBeNull();

    const request = vi.fn().mockResolvedValue({ ok: true, value: { data: {} } });
    await expect(syncDiagnostic(offline, skipped, request)).resolves.toBe('synced');
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0]![1].body as string).action).toBe('start');
    expect(JSON.parse(request.mock.calls[1]![1].body as string).action).toBe('skip');
    expect(await loadLocalDiagnostic(offline, userA)).toBeNull();
  });

  it('syncs a bounded completed result after the start receipt', async () => {
    const offline = store();
    await offline.initialize();
    let completed = createLocalDiagnostic({ nowIso, runId, seed: 'complete', userId: userA });
    for (let index = 0; completed.status === 'in_progress' && index < 6; index += 1) {
      const step = nextDiagnosticStep(completed, Date.parse(nowIso) + index * 1_000);
      if (step.kind !== 'present_item') break;
      completed = answerDiagnostic(
        completed,
        step.item,
        false,
        Date.parse(nowIso) + (index + 1) * 1_000,
      );
    }
    expect(completed.status).toBe('pending_completed');
    expect(completed.result?.stopReason).toBe('consecutive_errors');
    await saveLocalDiagnostic(offline, completed);
    const request = vi.fn().mockResolvedValue({ ok: true, value: { data: {} } });
    await expect(syncDiagnostic(offline, completed, request)).resolves.toBe('synced');
    expect(JSON.parse(request.mock.calls[1]![1].body as string).action).toBe('complete');
  });
});
