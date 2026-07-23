import { describe, expect, it } from 'vitest';

import { packageMetadata } from './index.ts';

describe('@hanziquest/learning-engine metadata', () => {
  it('reports the Task 5.8P adaptive-Pinyin-support milestone', () => {
    expect(packageMetadata.status).toBe('task-5.8p-adaptive-pinyin-support');
  });
});
