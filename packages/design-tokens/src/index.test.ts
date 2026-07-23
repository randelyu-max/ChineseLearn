import { describe, expect, it } from 'vitest';

import { colors, lineHeights, motion, spacing, touchTargets } from './index.js';

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('design tokens', () => {
  it('keeps every interactive target at least 48 dp', () => {
    expect(touchTargets.minimum).toBeGreaterThanOrEqual(48);
    expect(touchTargets.comfortable).toBeGreaterThanOrEqual(touchTargets.minimum);
  });

  it('provides a zero-duration reduced-motion alternative', () => {
    expect(Object.values(motion.reducedDurations).every((duration) => duration === 0)).toBe(true);
  });

  it('uses readable primary text and button contrast', () => {
    expect(contrastRatio(colors.textPrimary, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.textOnPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses monotonic spacing and sufficient text line heights', () => {
    const positiveSpacing = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl];
    expect(positiveSpacing).toEqual([...positiveSpacing].sort((left, right) => left - right));
    expect(lineHeights.body).toBeGreaterThan(16);
    expect(lineHeights.hanzi).toBeGreaterThan(48);
  });
});
