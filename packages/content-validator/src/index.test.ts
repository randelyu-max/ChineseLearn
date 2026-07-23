import { approvedHumorContentFixture, demoCurriculumPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { packageMetadata, validateCurriculumContent, validateHumorContent } from './index.ts';

describe('@hanziquest/content-validator', () => {
  it('reports the Task 7.3H approved-humor-validation milestone', () => {
    expect(packageMetadata.status).toBe('task-7.3h-approved-humor-validation');
  });

  it('accepts the synthetic example curriculum', () => {
    expect(validateCurriculumContent(demoCurriculumPackage, { source: 'demo' })).toEqual(
      expect.objectContaining({ valid: true }),
    );
  });

  it('accepts the published human-editorial humor package', () => {
    expect(validateHumorContent(approvedHumorContentFixture)).toEqual(
      expect.objectContaining({ valid: true }),
    );
  });
});
