import { describe, expect, it } from 'vitest';

import { appMetadata } from './app';

describe('admin workspace metadata', () => {
  it('identifies the admin application', () => {
    expect(appMetadata).toEqual({ name: 'HanziQuest Admin', platform: 'web' });
  });
});
