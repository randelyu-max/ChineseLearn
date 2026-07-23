import { describe, expect, it } from 'vitest';

import { contractsCompatibility } from './contracts';

describe('mobile contracts consumer', () => {
  it('resolves and executes the shared contracts package', () => {
    expect(contractsCompatibility).toEqual({ apiVersion: 'v1', acceptsRequestIds: true });
  });
});
