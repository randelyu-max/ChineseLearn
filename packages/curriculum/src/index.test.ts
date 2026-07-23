import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/curriculum metadata', () => {
  it('reports the Task 5.1P Pinyin-domain milestone', () => {
    expect(packageMetadata.status).toBe('task-5.1p-pinyin-domain');
  });
});
