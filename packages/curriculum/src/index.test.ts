import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 8.3E production-release milestone', () => {
    expect(packageMetadata.status).toBe('task-8.3e-production-release');
  });
});
