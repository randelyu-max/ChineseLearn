import { describe, expect, it } from 'vitest';

import { appMetadata } from './app';

describe('mobile workspace metadata', () => {
  it('identifies the mobile application', () => {
    expect(appMetadata).toEqual({ name: 'HanziQuest', platform: 'mobile' });
  });
});
