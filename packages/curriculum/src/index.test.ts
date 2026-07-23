import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 7.3H approved-humor-content milestone', () => {
    expect(packageMetadata.status).toBe('task-7.3h-approved-humor-content');
  });
});
