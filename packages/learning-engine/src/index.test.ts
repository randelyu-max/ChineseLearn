import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/learning-engine metadata', () => {
  it('reports the Task 3.2 memory scheduling milestone', () => {
    expect(packageMetadata.status).toBe('task-3.2-memory-scheduling');
  });
});
