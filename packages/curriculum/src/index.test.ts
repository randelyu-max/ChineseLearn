import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 6.2W standard-stroke-lessons milestone', () => {
    expect(packageMetadata.status).toBe('task-6.2w-standard-stroke-lessons');
  });
});
