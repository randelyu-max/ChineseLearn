import { describe, expect, it } from 'vitest';

import {
  SignaturePracticeMetricEventSchema,
  SignaturePracticeSummarySchema,
  SignatureProjectInputSchema,
} from './signature';

const projectId = '10000000-0000-4000-8000-000000000001';
const eventId = '10000000-0000-4000-8000-000000000002';

describe('signature metadata-only contracts', () => {
  it('accepts an own-name project and one bounded derived metric event', () => {
    expect(
      SignatureProjectInputSchema.parse({
        schemaVersion: 'signature-project-request-v1',
        projectId,
        chineseName: '王家豪',
        selectedStyle: 'clear',
      }),
    ).toBeTruthy();
    expect(
      SignaturePracticeMetricEventSchema.parse({
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId,
        idempotencyKey: 'signature-practice-0001',
        metrics: { direction: 0.8, proportion: 0.7, rhythm: 0.6, structure: 0.9 },
        occurredAt: '2026-07-23T12:00:00.000Z',
        projectId,
      }),
    ).toBeTruthy();
  });

  it('strictly rejects raw points, strokes, and images at both write boundaries', () => {
    expect(
      SignatureProjectInputSchema.safeParse({
        schemaVersion: 'signature-project-request-v1',
        projectId,
        chineseName: '王家豪',
        selectedStyle: 'clear',
        strokes: [{ points: [{ x: 0.5, y: 0.5 }] }],
      }).success,
    ).toBe(false);
    expect(
      SignaturePracticeMetricEventSchema.safeParse({
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId,
        idempotencyKey: 'signature-practice-0001',
        image: 'data:image/png;base64,raw',
        metrics: { direction: 0.8, proportion: 0.7, rhythm: 0.6, structure: 0.9 },
        occurredAt: '2026-07-23T12:00:00.000Z',
        projectId,
      }).success,
    ).toBe(false);
  });

  it('rejects client-authored practice counts and final summaries', () => {
    expect(
      SignaturePracticeMetricEventSchema.safeParse({
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId,
        idempotencyKey: 'signature-practice-0001',
        metrics: { direction: 0.8, proportion: 0.7, rhythm: 0.6, structure: 0.9 },
        occurredAt: '2026-07-23T12:00:00.000Z',
        practiceCount: 999,
        projectId,
      }).success,
    ).toBe(false);
    expect(
      SignaturePracticeSummarySchema.safeParse({
        schemaVersion: 'signature-practice-summary-v1',
        projectId,
        practiceCount: 1,
        selectedStyle: 'clear',
        scores: { direction: null, proportion: null, rhythm: null, structure: null },
        calculatedAt: null,
      }).success,
    ).toBe(true);
  });

  it('accepts a null metric baseline without accepting raw trace data', () => {
    expect(
      SignaturePracticeMetricEventSchema.safeParse({
        schemaVersion: 'signature-practice-request-v1',
        algorithmVersion: 'signature-consistency-v1',
        eventId,
        idempotencyKey: 'signature-practice-baseline',
        metrics: null,
        occurredAt: '2026-07-23T12:00:00.000Z',
        projectId,
      }).success,
    ).toBe(true);
  });
});
