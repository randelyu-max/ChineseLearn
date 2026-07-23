import { describe, expect, it } from 'vitest';

import { initialParentAuthState, reduceParentAuthState, safeAuthNotice } from './model';

describe('parent auth model', () => {
  it('restores and expires a parent session without exposing technical details', () => {
    const authenticated = reduceParentAuthState(initialParentAuthState, {
      type: 'restored',
      email: 'parent@example.test',
    });
    const expired = reduceParentAuthState(authenticated, {
      type: 'signed_out',
      reason: 'expired',
    });

    expect(expired).toEqual({
      status: 'signed_out',
      userEmail: null,
      notice: 'session_expired',
    });
  });

  it('maps provider failures to a finite safe message set', () => {
    expect(safeAuthNotice({ message: 'Invalid login credentials' })).toBe('invalid_credentials');
    expect(safeAuthNotice({ status: 429 })).toBe('rate_limited');
    expect(safeAuthNotice(new Error('sensitive database detail'))).toBe('generic');
  });

  it('does not mutate or discard an offline child lesson when auth changes', () => {
    const snapshot = Object.freeze({
      answers: Object.freeze(['我']),
      lessonId: 'lesson-1',
      step: 4,
    });
    const before = JSON.stringify(snapshot);

    reduceParentAuthState(
      { status: 'authenticated', userEmail: 'parent@example.test', notice: null },
      { type: 'signed_out', reason: 'expired' },
    );

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.step).toBe(4);
  });
});
