import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 1.1 domain-model milestone', () => {
    expect(packageMetadata.status).toBe('task-1.1-domain-model');
  });
});
