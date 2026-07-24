import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_CONTENT_VERSION,
  DiagnosticMutationSchema,
  DiagnosticResultSummarySchema,
} from './diagnostic.ts';

const axes = Object.fromEntries(
  [
    'spoken_audio_comprehension',
    'pinyin_recognition',
    'tone_discrimination',
    'hanzi_recognition',
    'word_reading',
    'sentence_reading',
  ].map((axis) => [axis, { confidence: 0.75, estimatedLevel: 2, observedEvidenceCount: 4 }]),
);

const result = {
  algorithmVersion: 'diagnostic-v1',
  axes,
  durationMs: 120_000,
  observedEvidenceCount: 24,
  recommendedPinyinSupportMode: 'adaptive',
  recommendedStartingPoint: 'word_reading',
  seed: 'fixed-seed',
  stopReason: 'confidence_reached',
};

describe('diagnostic contracts', () => {
  it('accepts the bounded six-axis result', () => {
    expect(DiagnosticResultSummarySchema.parse(result).observedEvidenceCount).toBe(24);
  });

  it('rejects extra fields and unbounded evidence', () => {
    expect(
      DiagnosticResultSummarySchema.safeParse({ ...result, observedEvidenceCount: 37 }).success,
    ).toBe(false);
    expect(
      DiagnosticResultSummarySchema.safeParse({ ...result, rawAudio: 'forbidden' }).success,
    ).toBe(false);
  });

  it('does not accept a user ID at the mutation boundary', () => {
    expect(
      DiagnosticMutationSchema.safeParse({
        schemaVersion: 'diagnostic-run-v1',
        action: 'start',
        runId: '10000000-0000-4000-8000-000000000001',
        idempotencyKey: 'diagnostic:start:1',
        algorithmVersion: 'diagnostic-v1',
        contentVersion: DIAGNOSTIC_CONTENT_VERSION,
        startedAt: '2026-07-24T10:00:00.000Z',
        userId: '20000000-0000-4000-8000-000000000002',
      }).success,
    ).toBe(false);
  });
});
