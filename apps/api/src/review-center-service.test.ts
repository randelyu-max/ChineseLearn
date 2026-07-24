import type { ReviewCenterKind, ReviewCenterReasonCode } from '@hanziquest/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildReviewCenterResponse,
  resolveReviewCenterPagination,
  ReviewCenterCursorError,
  type ReviewCenterSourceRow,
} from './review-center-service.js';

const generatedAt = new Date('2026-07-24T08:00:00.000Z');

function source(
  input: Partial<ReviewCenterSourceRow> &
    Pick<ReviewCenterSourceRow, 'contentRef' | 'dueAt' | 'kind' | 'reviewKey'>,
): ReviewCenterSourceRow {
  return {
    source: 'schedule',
    displayLabel: input.contentRef,
    secondaryLabel: null,
    reasonCode: 'scheduled_review',
    estimatedSeconds: 60,
    recommendedActivityType: null,
    recommendedPinyinPolicy: 'adaptive',
    relatedContentRefs: [],
    ...input,
  };
}

function scheduled(
  kind: ReviewCenterKind,
  contentRef: string,
  dueAt: string,
  reasonCode: ReviewCenterReasonCode = 'scheduled_review',
): ReviewCenterSourceRow {
  return source({
    contentRef,
    dueAt: new Date(dueAt),
    kind,
    reasonCode,
    reviewKey: `review:${contentRef}:${kind}`,
  });
}

describe('review-center service', () => {
  it('returns the complete deterministic empty state and next scheduled time', () => {
    const result = buildReviewCenterResponse(
      [scheduled('hanzi', 'character:future', '2026-07-25T08:00:00.000Z')],
      { generatedAt, limit: 20, lastPriority: null, lastDueAt: null, lastReviewKey: null },
    );
    expect(result.summary).toEqual({
      dueNowCount: 0,
      overdueCount: 0,
      estimatedMinutes: 0,
      nextDueAt: '2026-07-25T08:00:00.000Z',
    });
    expect(result.items).toEqual([]);
    expect(result.groups.map((group) => group.kind)).toEqual([
      'hanzi',
      'pinyin',
      'tone',
      'word',
      'sentence',
      'confusion',
    ]);
    expect(result.groups.every((group) => group.count === 0)).toBe(true);
  });

  it('deduplicates concepts, lets a due confusion pair replace its characters, and groups safely', () => {
    const rows: ReviewCenterSourceRow[] = [
      scheduled('hanzi', 'character:one', '2026-07-23T04:00:00.000Z'),
      scheduled('pinyin', 'character:one', '2026-07-23T03:00:00.000Z', 'pinyin_dependency'),
      scheduled('hanzi', 'character:two', '2026-07-22T02:00:00.000Z'),
      scheduled('tone', 'tone:three', '2026-07-23T02:00:00.000Z'),
      scheduled('word', 'word:one', '2026-07-23T01:00:00.000Z'),
      scheduled('sentence', 'sentence:one', '2026-07-24T08:00:00.000Z'),
      source({
        source: 'confusion',
        reviewKey: 'confusion:one-two',
        kind: 'confusion',
        contentRef: 'confusion:one-two',
        displayLabel: '一 / 二',
        dueAt: new Date('2026-07-21T01:00:00.000Z'),
        reasonCode: 'confusion_pair',
        estimatedSeconds: 80,
        relatedContentRefs: ['character:one', 'character:two'],
      }),
      source({
        source: 'confusion',
        reviewKey: 'confusion:one-three',
        kind: 'confusion',
        contentRef: 'confusion:one-three',
        displayLabel: '一 / 三',
        dueAt: new Date('2026-07-22T01:00:00.000Z'),
        reasonCode: 'confusion_pair',
        estimatedSeconds: 80,
        relatedContentRefs: ['character:one', 'character:three'],
      }),
    ];

    const result = buildReviewCenterResponse(rows, {
      generatedAt,
      limit: 20,
      lastPriority: null,
      lastDueAt: null,
      lastReviewKey: null,
    });
    expect(result.items.map((item) => item.contentRef)).toEqual([
      'confusion:one-two',
      'word:one',
      'tone:three',
      'sentence:one',
    ]);
    expect(result.summary).toEqual({
      dueNowCount: 4,
      overdueCount: 3,
      estimatedMinutes: 5,
      nextDueAt: null,
    });
    expect(Object.fromEntries(result.groups.map((group) => [group.kind, group.count]))).toEqual({
      hanzi: 0,
      pinyin: 0,
      tone: 1,
      word: 1,
      sentence: 1,
      confusion: 1,
    });
    expect(result.items.find((item) => item.kind === 'confusion')).not.toHaveProperty(
      'recommendedActivityType',
    );
  });

  it('paginates a fixed snapshot without duplicates and keeps its generatedAt stable', () => {
    const rows = [
      scheduled('hanzi', 'character:a', '2026-07-21T08:00:00.000Z'),
      scheduled('word', 'word:b', '2026-07-22T08:00:00.000Z'),
      scheduled('sentence', 'sentence:c', '2026-07-23T08:00:00.000Z'),
    ];
    const first = buildReviewCenterResponse(rows, {
      generatedAt,
      limit: 2,
      lastPriority: null,
      lastDueAt: null,
      lastReviewKey: null,
    });
    expect(first.pageInfo.hasMore).toBe(true);
    expect(first.items).toHaveLength(2);
    const pagination = resolveReviewCenterPagination(
      {
        schemaVersion: 'review-center-request-v1',
        cursor: first.pageInfo.nextCursor ?? undefined,
        limit: 2,
      },
      new Date('2030-01-01T00:00:00.000Z'),
    );
    const second = buildReviewCenterResponse(rows, pagination);
    expect(second.generatedAt).toBe(first.generatedAt);
    expect(second.items.map((item) => item.contentRef)).toEqual(['sentence:c']);
    expect(new Set([...first.items, ...second.items].map((item) => item.reviewKey)).size).toBe(3);
    expect(second.pageInfo).toEqual({ nextCursor: null, hasMore: false });
  });

  it('rejects malformed and incompatible cursor payloads deterministically', () => {
    expect(() =>
      resolveReviewCenterPagination(
        {
          schemaVersion: 'review-center-request-v1',
          cursor: Buffer.from('{}').toString('base64url'),
          limit: 20,
        },
        generatedAt,
      ),
    ).toThrow(ReviewCenterCursorError);
  });

  it('rejects a structurally valid cursor after its keyset tuple is tampered', () => {
    const rows = [
      scheduled('hanzi', 'character:a', '2026-07-21T08:00:00.000Z'),
      scheduled('word', 'word:b', '2026-07-22T08:00:00.000Z'),
    ];
    const first = buildReviewCenterResponse(rows, {
      generatedAt,
      limit: 1,
      lastPriority: null,
      lastDueAt: null,
      lastReviewKey: null,
    });
    const decoded = JSON.parse(
      Buffer.from(first.pageInfo.nextCursor!, 'base64url').toString('utf8'),
    );
    const tampered = Buffer.from(
      JSON.stringify({ ...decoded, lastReviewKey: 'review:forged' }),
    ).toString('base64url');
    expect(() =>
      resolveReviewCenterPagination(
        { schemaVersion: 'review-center-request-v1', cursor: tampered, limit: 1 },
        generatedAt,
      ),
    ).toThrow(ReviewCenterCursorError);
  });

  it('keeps keyset pages stable when an earlier due row appears between requests', () => {
    const original = [
      scheduled('hanzi', 'character:a', '2026-07-21T08:00:00.000Z'),
      scheduled('word', 'word:b', '2026-07-22T08:00:00.000Z'),
      scheduled('sentence', 'sentence:c', '2026-07-23T08:00:00.000Z'),
    ];
    const first = buildReviewCenterResponse(original, {
      generatedAt,
      limit: 2,
      lastPriority: null,
      lastDueAt: null,
      lastReviewKey: null,
    });
    const second = buildReviewCenterResponse(
      [scheduled('tone', 'tone:new', '2026-07-20T08:00:00.000Z'), ...original],
      resolveReviewCenterPagination(
        {
          schemaVersion: 'review-center-request-v1',
          cursor: first.pageInfo.nextCursor!,
          limit: 2,
        },
        new Date('2030-01-01T00:00:00.000Z'),
      ),
    );
    expect(second.items.map((item) => item.contentRef)).toEqual(['sentence:c']);
  });
});
