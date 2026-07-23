import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/learning-engine metadata', () => {
  it('reports the Task 3.6R Pinyin-evidence-weighting milestone', () => {
    expect(packageMetadata.status).toBe('task-3.6r-pinyin-evidence-weighting');
  });
});
