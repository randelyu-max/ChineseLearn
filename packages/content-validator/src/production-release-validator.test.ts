import { productionCurriculumReleaseV1 } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { validateProductionCurriculumRelease } from './production-release-validator.ts';

function changedRelease(changes: Record<string, unknown>) {
  return {
    ...productionCurriculumReleaseV1,
    ...changes,
  } as unknown as typeof productionCurriculumReleaseV1;
}

describe('production Curriculum release validation', () => {
  it('accepts the reviewed starter release and its explicit coverage shortfall', () => {
    const result = validateProductionCurriculumRelease(productionCurriculumReleaseV1);
    expect(result.valid).toBe(true);
    expect(productionCurriculumReleaseV1.coverage.characters.actual).toBeLessThan(
      productionCurriculumReleaseV1.coverage.characters.target,
    );
  });

  it('rejects content without editorial approval', () => {
    const result = validateProductionCurriculumRelease(
      changedRelease({
        editorialReview: {
          ...productionCurriculumReleaseV1.editorialReview,
          status: 'pending',
        },
      }),
    );
    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'EDITORIAL_REVIEW_REQUIRED' }],
    });
  });

  it('rejects unauthorized media', () => {
    const result = validateProductionCurriculumRelease(
      changedRelease({
        media: [{ ...productionCurriculumReleaseV1.media[0], authorized: false }],
      }),
    );
    expect(result).toMatchObject({
      valid: false,
      errors: [{ code: 'MEDIA_AUTHORIZATION_REQUIRED' }],
    });
  });
});
