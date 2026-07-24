import { productionCurriculumReleaseV1 } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import {
  PRODUCTION_RELEASE_IMPORT_VERSION,
  productionReleaseManifestSha256,
} from './production-curriculum-import.ts';

describe('production Curriculum import manifest', () => {
  it('is deterministic and versioned', () => {
    expect(PRODUCTION_RELEASE_IMPORT_VERSION).toBe('production-release-import-v1');
    const first = productionReleaseManifestSha256(productionCurriculumReleaseV1);
    const second = productionReleaseManifestSha256(productionCurriculumReleaseV1);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it('changes when immutable package content changes', () => {
    const changed = {
      ...productionCurriculumReleaseV1,
      minimumAppVersion: '1.0.1',
    } as unknown as typeof productionCurriculumReleaseV1;
    expect(productionReleaseManifestSha256(changed)).not.toBe(
      productionReleaseManifestSha256(productionCurriculumReleaseV1),
    );
  });
});
