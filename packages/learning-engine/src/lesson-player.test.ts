import { describe, expect, it } from 'vitest';

import {
  createLessonPlayer,
  createLessonSnapshot,
  restoreLessonSnapshot,
  transitionLessonPlayer,
  type Clock,
} from './lesson-player.ts';

function clockAt(initial = 0): Clock & { advance: (ms: number) => void } {
  let time = initial;
  return { now: () => time, advance: (ms) => (time += ms) };
}

describe('lesson player state machine', () => {
  it('completes a lesson without duplicating completion events', () => {
    const clock = clockAt();
    let state = createLessonPlayer('session-1', ['a', 'b']);
    state = transitionLessonPlayer(state, { type: 'LOADED' }, clock);
    clock.advance(500);
    state = transitionLessonPlayer(state, { type: 'SUBMIT', outcome: 'correct' }, clock);
    const duplicate = transitionLessonPlayer(state, { type: 'SUBMIT', outcome: 'correct' }, clock);
    expect(duplicate).toBe(state);
    expect(state.completions).toHaveLength(1);
    state = transitionLessonPlayer(state, { type: 'CONTINUE' }, clock);
    state = transitionLessonPlayer(state, { type: 'SUBMIT', outcome: 'incorrect' }, clock);
    state = transitionLessonPlayer(state, { type: 'CONTINUE' }, clock);
    expect(state.status).toBe('completed');
    expect(state.completions.map((item) => item.activityId)).toEqual(['a', 'b']);
  });

  it('excludes background time from response time', () => {
    const clock = clockAt();
    let state = transitionLessonPlayer(
      createLessonPlayer('session-2', ['a']),
      { type: 'LOADED' },
      clock,
    );
    clock.advance(400);
    state = transitionLessonPlayer(state, { type: 'PAUSE_BACKGROUND' }, clock);
    clock.advance(10_000);
    state = transitionLessonPlayer(state, { type: 'RESUME' }, clock);
    clock.advance(600);
    state = transitionLessonPlayer(state, { type: 'SUBMIT', outcome: 'correct' }, clock);
    expect(state.completions[0]?.responseTimeMs).toBe(1_000);
  });

  it('supports hint, exit confirmation, cancel and confirmed exit', () => {
    const clock = clockAt();
    let state = transitionLessonPlayer(
      createLessonPlayer('session-3', ['a']),
      { type: 'LOADED' },
      clock,
    );
    state = transitionLessonPlayer(state, { type: 'SHOW_HINT' }, clock);
    expect(state.status).toBe('hint');
    state = transitionLessonPlayer(state, { type: 'REQUEST_EXIT' }, clock);
    state = transitionLessonPlayer(state, { type: 'CANCEL_EXIT' }, clock);
    expect(state.status).toBe('hint');
    state = transitionLessonPlayer(state, { type: 'REQUEST_EXIT' }, clock);
    state = transitionLessonPlayer(state, { type: 'CONFIRM_EXIT' }, clock);
    expect(state).toMatchObject({ status: 'paused', pauseReason: 'user_exit' });
  });

  it('restores an active crash snapshot as safely paused', () => {
    const clock = clockAt();
    const active = transitionLessonPlayer(
      createLessonPlayer('session-4', ['a']),
      { type: 'LOADED' },
      clock,
    );
    const restored = restoreLessonSnapshot(createLessonSnapshot(active));
    expect(restored).toMatchObject({
      status: 'paused',
      resumeStatus: 'active',
      pauseReason: 'background',
    });
    expect(restored).not.toBe(active);
  });

  it('keeps completion records immutable and rejects invalid snapshots', () => {
    const clock = clockAt();
    let state = transitionLessonPlayer(
      createLessonPlayer('session-5', ['a']),
      { type: 'LOADED' },
      clock,
    );
    state = transitionLessonPlayer(state, { type: 'SUBMIT', outcome: 'correct' }, clock);
    expect(Object.isFrozen(state.completions[0])).toBe(true);
    expect(() => restoreLessonSnapshot({ ...state, snapshotVersion: 2 as 1 })).toThrow();
  });
});
