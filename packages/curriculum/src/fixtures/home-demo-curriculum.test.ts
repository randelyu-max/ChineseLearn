import { describe, expect, it } from 'vitest';

import { CurriculumPackageSchema } from '../schemas.ts';
import { homeDemoCurriculumPackage } from './home-demo-curriculum.ts';

describe('My Home 20-character demo curriculum', () => {
  it('contains exactly 20 stable character concepts and parses', () => {
    expect(homeDemoCurriculumPackage.characters).toHaveLength(20);
    expect(new Set(homeDemoCurriculumPackage.characters.map((item) => item.conceptId)).size).toBe(
      20,
    );
    expect(CurriculumPackageSchema.safeParse(homeDemoCurriculumPackage).success).toBe(true);
  });

  it('contains one 5-8 minute lesson and one short story', () => {
    expect(homeDemoCurriculumPackage.lessons).toHaveLength(1);
    expect(homeDemoCurriculumPackage.lessons[0]?.expectedMinutes).toBeGreaterThanOrEqual(5);
    expect(homeDemoCurriculumPackage.lessons[0]?.expectedMinutes).toBeLessThanOrEqual(8);
    expect(homeDemoCurriculumPackage.stories).toHaveLength(1);
    expect(homeDemoCurriculumPackage.stories[0]?.sentenceIds).toHaveLength(3);
  });

  it('covers all four P0 exercise types and story comprehension', () => {
    expect(homeDemoCurriculumPackage.activities.map((item) => item.type)).toEqual([
      'audio_to_glyph',
      'glyph_to_image',
      'word_build',
      'sentence_order',
      'story_comprehension',
    ]);
    expect(
      homeDemoCurriculumPackage.activities.reduce(
        (total, item) => total + item.estimatedSeconds,
        0,
      ),
    ).toBe(480);
  });

  it('gives every demo audio and image asset license/source metadata', () => {
    expect(homeDemoCurriculumPackage.assets.some((asset) => asset.kind === 'audio')).toBe(true);
    expect(homeDemoCurriculumPackage.assets.some((asset) => asset.kind === 'image')).toBe(true);
    for (const asset of homeDemoCurriculumPackage.assets) {
      expect(asset.licenseIdentifier).not.toBe('');
      expect(asset.sourceName).not.toBe('');
      expect(asset.sourceReference).not.toBe('');
      expect(asset.attribution).not.toBe('');
    }
  });
});
