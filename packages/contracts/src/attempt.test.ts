import { describe, expect, it } from 'vitest';

import {
  AttemptDraftSchema,
  AttemptEvidenceResultV1Schema,
  AttemptsBatchRequestSchema,
  AttemptsBatchRequestV2Schema,
} from './attempt.ts';

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

describe('AttemptsBatchRequestV2Schema', () => {
  const validV2Attempt = {
    attemptId: '10000000-0000-4000-8000-000000000001',
    sessionActivityId: '10000000-0000-4000-8000-000000000002',
    answer: { optionId: 'option.hanzi.ni' },
    isCorrectClient: false,
    responseMs: 1_900,
    hintLevel: 'none',
    pinyinSupport: 'none',
    replayCount: 0,
    retryCount: 0,
    occurredAt: '2026-07-24T12:00:00Z',
    offlineSequence: 7,
  } as const;

  it('accepts stable content answer IDs and no ownership fields', () => {
    expect(
      AttemptsBatchRequestV2Schema.safeParse({
        schemaVersion: 'attempts-batch-request-v2',
        sessionId: '10000000-0000-4000-8000-000000000003',
        idempotencyKey: 'attempts-v2:10000000-0000-4000-8000-000000000003',
        attempts: [validV2Attempt],
      }).success,
    ).toBe(true);
  });

  it('rejects client candidates, duplicate attempts and unbounded offline sequence values', () => {
    const batch = {
      schemaVersion: 'attempts-batch-request-v2',
      sessionId: '10000000-0000-4000-8000-000000000003',
      idempotencyKey: 'attempts-v2:10000000-0000-4000-8000-000000000003',
      attempts: [validV2Attempt],
    } as const;
    expect(
      AttemptsBatchRequestV2Schema.safeParse({ ...batch, userId: batch.sessionId }).success,
    ).toBe(false);
    expect(
      AttemptsBatchRequestV2Schema.safeParse({
        ...batch,
        attempts: [validV2Attempt, validV2Attempt],
      }).success,
    ).toBe(false);
    expect(
      AttemptsBatchRequestV2Schema.safeParse({
        ...batch,
        attempts: [{ ...validV2Attempt, offlineSequence: Number.MAX_SAFE_INTEGER + 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('AttemptEvidenceResultV1Schema', () => {
  it('requires effective quality to equal the normalized quality product', () => {
    const evidence = {
      conceptType: 'character',
      conceptId: 'concept.hanzi.ni',
      skill: 'audio_to_glyph',
      abilityAxis: 'hanzi_recognition',
      correct: true,
      baseQuality: 0.8,
      supportMultiplier: 0.5,
      effectiveQuality: 0.4,
      algorithmVersion: 'exercise-quality-v1+pinyin-evidence-v1',
    } as const;
    expect(AttemptEvidenceResultV1Schema.safeParse(evidence).success).toBe(true);
    expect(
      AttemptEvidenceResultV1Schema.safeParse({ ...evidence, effectiveQuality: 0.8 }).success,
    ).toBe(false);
  });
});
