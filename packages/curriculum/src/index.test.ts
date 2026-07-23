import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 7.1H static-humor-schema milestone', () => {
    expect(packageMetadata.status).toBe('task-7.1h-static-humor-schema');
  });
});
