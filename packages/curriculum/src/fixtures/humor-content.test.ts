import { describe, expect, it } from 'vitest';

import { HumorContentPackageSchema } from '../humor.ts';
import { approvedHumorContentFixture } from './humor-content.ts';

describe('approved human-editorial humor content', () => {
  it('is a valid, versioned, bundled package', () => {
    expect(HumorContentPackageSchema.safeParse(approvedHumorContentFixture).success).toBe(true);
    expect(approvedHumorContentFixture).toMatchObject({
      contentVersion: '1.0.0',
      schemaVersion: 'humor-content-v1',
    });
  });

  it('contains the six reviewed candidate items with stable unique IDs', () => {
    expect(approvedHumorContentFixture.items).toHaveLength(6);
    expect(new Set(approvedHumorContentFixture.items.map((item) => item.id)).size).toBe(6);
    expect(
      approvedHumorContentFixture.items.every(
        (item) =>
          item.authoring === 'human_editorial' &&
          item.delivery === 'bundled' &&
          item.editorialStatus === 'published' &&
          item.safetyReview.reviewedBy === '于永' &&
          item.safetyReview.reviewedAt === '2026-07-23T20:55:17.680Z',
      ),
    ).toBe(true);
  });

  it('provides simplified and traditional targets, answers, prompts, and neutral fallbacks', () => {
    for (const item of approvedHumorContentFixture.items) {
      expect(item.locale).toBe('zh-CN');
      expect(item.learningTarget.display.simplified.length).toBeGreaterThan(0);
      expect(item.learningTarget.display.traditional.length).toBeGreaterThan(0);
      expect(item.humorousVariant.prompt.simplified.length).toBeGreaterThan(0);
      expect(item.humorousVariant.prompt.traditional.length).toBeGreaterThan(0);
      expect(item.neutralFallback.prompt.simplified.length).toBeGreaterThan(0);
      expect(item.neutralFallback.prompt.traditional.length).toBeGreaterThan(0);
      expect(item.humorousVariant.correctAnswerId).toBe(item.neutralFallback.correctAnswerId);
      expect(item.humorousVariant.correctAnswer).toEqual(item.neutralFallback.correctAnswer);
    }
  });

  it('normalizes the approved candidate type to the supported tone-wordplay code', () => {
    expect(approvedHumorContentFixture.items[0]?.humorType).toBe('tone_wordplay');
  });
});
