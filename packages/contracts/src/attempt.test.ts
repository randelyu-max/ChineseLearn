import { describe, expect, it } from 'vitest';

import { AttemptsBatchRequestSchema, AttemptDraftSchema } from './attempt.ts';

const validAttempt = {
  attemptId: '00000000-0000-4000-8000-000000000001',
  activityId: '00000000-0000-4000-8000-000000000002',
  answer: { optionId: '00000000-0000-4000-8000-000000000003' },
  isCorrectClient: true,
  responseMs: 2850,
  hintLevel: 'audio_repeat',
  replayCount: 1,
  retryCount: 0,
  occurredAt: '2026-07-22T18:00:00Z',
  offlineSequence: 13,
} as const;

describe('AttemptDraftSchema', () => {
  it('accepts the /v1/attempts/batch draft shape', () => {
    expect(AttemptDraftSchema.parse(validAttempt)).toEqual(validAttempt);
  });

  it('rejects invalid IDs, negative timings and unknown fields', () => {
    expect(AttemptDraftSchema.safeParse({ ...validAttempt, attemptId: 'attempt-1' }).success).toBe(
      false,
    );
    expect(AttemptDraftSchema.safeParse({ ...validAttempt, responseMs: -1 }).success).toBe(false);
    expect(
      AttemptDraftSchema.safeParse({ ...validAttempt, childNickname: 'not-allowed' }).success,
    ).toBe(false);
  });

  it('accepts ordered tile answers for construction exercises', () => {
    expect(
      AttemptDraftSchema.safeParse({
        ...validAttempt,
        answer: {
          tileIds: ['00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'],
        },
      }).success,
    ).toBe(true);
  });

  it('accepts a bounded ownership-free batch and rejects duplicate event IDs', () => {
    const batch = {
      schemaVersion: 'attempts-batch-request-v1',
      sessionId: '00000000-0000-4000-8000-000000000010',
      idempotencyKey: 'attempts-batch:00000000-0000-4000-8000-000000000010',
      attempts: [validAttempt],
    };
    expect(AttemptsBatchRequestSchema.safeParse(batch).success).toBe(true);
    expect(
      AttemptsBatchRequestSchema.safeParse({
        ...batch,
        attempts: [validAttempt, validAttempt],
      }).success,
    ).toBe(false);
    expect(
      AttemptsBatchRequestSchema.safeParse({ ...batch, userId: batch.sessionId }).success,
    ).toBe(false);
  });
});
