import { describe, expect, it } from 'vitest';

import { legacyRoleNavigationEnabled, mainDestinations } from './navigation';

describe('single-user navigation', () => {
  it('contains only the five age-neutral primary destinations', () => {
    expect(mainDestinations.map(({ title }) => title)).toEqual([
      '学习',
      '拼音',
      '书写',
      '复习',
      '我的',
    ]);
  });

  it('does not expose role switching', () => {
    expect(legacyRoleNavigationEnabled).toBe(false);
  });
});
