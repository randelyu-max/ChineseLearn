import { describe, expect, it } from 'vitest';

import { compareSemanticVersions, isCurriculumCompatible } from './compatibility.ts';

describe('curriculum version compatibility', () => {
  it('accepts equal and newer application versions', () => {
    expect(isCurriculumCompatible('1.0.0', '1.0.0')).toBe(true);
    expect(isCurriculumCompatible('1.4.0', '1.3.9')).toBe(true);
    expect(isCurriculumCompatible('2.0.0', '1.9.9')).toBe(true);
  });

  it('rejects an older application version', () => {
    expect(isCurriculumCompatible('1.2.9', '1.3.0')).toBe(false);
  });

  it('treats prereleases as older than their final release', () => {
    expect(compareSemanticVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareSemanticVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareSemanticVersions('1.0.0-beta.10', '1.0.0-beta.2')).toBe(1);
    expect(compareSemanticVersions('1.0.0-1', '1.0.0-beta')).toBe(-1);
  });

  it('rejects malformed versions instead of guessing', () => {
    expect(() => isCurriculumCompatible('current', '1.0.0')).toThrow();
  });
});
