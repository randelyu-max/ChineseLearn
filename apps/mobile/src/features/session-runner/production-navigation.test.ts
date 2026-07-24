import { describe, expect, it } from 'vitest';

import {
  DEVELOPMENT_ONLY_ROUTES,
  PRODUCTION_LEARN_ROUTE,
  PRODUCTION_PINYIN_ROUTE,
  PRODUCTION_REVIEW_ROUTE,
} from './navigation';

describe('production learning navigation', () => {
  it('uses only the formal Session route for the Learn CTA', () => {
    expect(PRODUCTION_LEARN_ROUTE).toBe('/session');
    expect(PRODUCTION_LEARN_ROUTE).not.toContain('demo');
    expect(PRODUCTION_LEARN_ROUTE).not.toContain('showcase');
  });

  it('uses the same universal formal Runner for the Pinyin CTA', () => {
    expect(PRODUCTION_PINYIN_ROUTE).toBe('/session');
    expect(PRODUCTION_PINYIN_ROUTE).not.toContain('demo');
    expect(PRODUCTION_PINYIN_ROUTE).not.toContain('showcase');
  });

  it('uses the universal formal Runner for the Review CTA', () => {
    expect(PRODUCTION_REVIEW_ROUTE).toBe('/session');
  });

  it('classifies every Demo and Showcase route as development-only', () => {
    expect(DEVELOPMENT_ONLY_ROUTES).toEqual([
      'demo-course',
      'component-showcase',
      'audio-to-glyph-showcase',
      'glyph-to-image-showcase',
      'sentence-order-showcase',
      'word-build-showcase',
    ]);
  });
});
