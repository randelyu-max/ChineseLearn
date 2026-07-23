import { demoCurriculumPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { packageMetadata, validateCurriculumContent } from './index.ts';

describe('@hanziquest/content-validator', () => {
  it('reports the Task 7.1H static-humor-validation milestone', () => {
    expect(packageMetadata.status).toBe('task-7.1h-static-humor-validation');
  });

  it('accepts the synthetic example curriculum', () => {
    expect(validateCurriculumContent(demoCurriculumPackage, { source: 'demo' })).toEqual(
      expect.objectContaining({ valid: true }),
    );
  });
});
