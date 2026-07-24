import { describe, expect, it } from 'vitest';

import {
  REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
  REVIEW_CENTER_REQUEST_SCHEMA_VERSION,
  REVIEW_CENTER_SCHEMA_VERSION,
  ReviewCenterCursorPayloadSchema,
  ReviewCenterQuerySchema,
  ReviewCenterResponseDataSchema,
} from './review-center.ts';

const groups = [
  { kind: 'hanzi', count: 1, overdueCount: 1 },
  { kind: 'pinyin', count: 0, overdueCount: 0 },
  { kind: 'tone', count: 0, overdueCount: 0 },
  { kind: 'word', count: 0, overdueCount: 0 },
  { kind: 'sentence', count: 0, overdueCount: 0 },
  { kind: 'confusion', count: 0, overdueCount: 0 },
] as const;

const validData = {
  schemaVersion: REVIEW_CENTER_SCHEMA_VERSION,
  generatedAt: '2026-07-24T08:00:00.000Z',
  summary: {
    dueNowCount: 1,
    overdueCount: 1,
    estimatedMinutes: 1,
    nextDueAt: '2026-07-25T08:00:00.000Z',
  },
  groups,
  items: [
    {
      reviewKey: 'review:character:one:audio_to_glyph',
      kind: 'hanzi',
      contentRef: 'character:one',
      displayLabel: '家',
      secondaryLabel: 'jiā',
      dueAt: '2026-07-23T08:00:00.000Z',
      isOverdue: true,
      reasonCode: 'recent_error',
      estimatedSeconds: 60,
      recommendedActivityType: 'audio_to_glyph',
      recommendedPinyinPolicy: 'adaptive',
    },
  ],
  pageInfo: { nextCursor: null, hasMore: false },
} as const;

describe('review-center contracts', () => {
  it('accepts a versioned ownership-free query and applies a bounded default page size', () => {
    expect(
      ReviewCenterQuerySchema.parse({
        schemaVersion: REVIEW_CENTER_REQUEST_SCHEMA_VERSION,
      }),
    ).toEqual({
      schemaVersion: REVIEW_CENTER_REQUEST_SCHEMA_VERSION,
      limit: 20,
    });
    expect(
      ReviewCenterQuerySchema.parse({
        schemaVersion: REVIEW_CENTER_REQUEST_SCHEMA_VERSION,
        limit: '50',
      }).limit,
    ).toBe(50);
  });

  it('rejects ownership fields, oversized pages, malformed cursors, and unknown versions', () => {
    const base = { schemaVersion: REVIEW_CENTER_REQUEST_SCHEMA_VERSION };
    expect(ReviewCenterQuerySchema.safeParse({ ...base, userId: 'forged' }).success).toBe(false);
    expect(ReviewCenterQuerySchema.safeParse({ ...base, limit: 51 }).success).toBe(false);
    expect(ReviewCenterQuerySchema.safeParse({ ...base, cursor: 'not a cursor!' }).success).toBe(
      false,
    );
    expect(
      ReviewCenterQuerySchema.safeParse({
        ...base,
        schemaVersion: 'review-center-request-v2',
      }).success,
    ).toBe(false);
  });

  it('validates the opaque cursor payload version, UTC snapshot, and bounded offset', () => {
    expect(
      ReviewCenterCursorPayloadSchema.parse({
        schemaVersion: REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
        generatedAt: validData.generatedAt,
        offset: 20,
      }),
    ).toEqual({
      schemaVersion: REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
      generatedAt: validData.generatedAt,
      offset: 20,
    });
    expect(
      ReviewCenterCursorPayloadSchema.safeParse({
        schemaVersion: REVIEW_CENTER_CURSOR_SCHEMA_VERSION,
        generatedAt: '2026-07-24T08:00:00',
        offset: -1,
      }).success,
    ).toBe(false);
  });

  it('validates the complete review summary, groups, safe items, and page metadata', () => {
    expect(ReviewCenterResponseDataSchema.parse(validData)).toEqual(validData);
  });

  it('rejects ownership, answer leakage, count drift, duplicate groups, and cursor drift', () => {
    expect(
      ReviewCenterResponseDataSchema.safeParse({
        ...validData,
        items: [{ ...validData.items[0], userId: 'forged' }],
      }).success,
    ).toBe(false);
    expect(
      ReviewCenterResponseDataSchema.safeParse({
        ...validData,
        items: [{ ...validData.items[0], correctAnswer: '家' }],
      }).success,
    ).toBe(false);
    expect(
      ReviewCenterResponseDataSchema.safeParse({
        ...validData,
        summary: { ...validData.summary, dueNowCount: 2 },
      }).success,
    ).toBe(false);
    expect(
      ReviewCenterResponseDataSchema.safeParse({
        ...validData,
        groups: [...groups.slice(0, 5), groups[0]],
      }).success,
    ).toBe(false);
    expect(
      ReviewCenterResponseDataSchema.safeParse({
        ...validData,
        pageInfo: { nextCursor: 'cursor', hasMore: false },
      }).success,
    ).toBe(false);
  });
});
