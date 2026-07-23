export const LESSON_PLAYER_SNAPSHOT_VERSION = 1 as const;

export type Clock = { now: () => number };
export type ActiveStatus = 'active' | 'hint' | 'feedback';
export type PlayerStatus =
  'loading' | ActiveStatus | 'paused' | 'exit-confirmation' | 'completed' | 'error';

export type ActivityCompletion = Readonly<{
  activityId: string;
  completedAtMs: number;
  outcome: 'correct' | 'incorrect';
  responseTimeMs: number;
}>;

export type LessonPlayerState = Readonly<{
  snapshotVersion: typeof LESSON_PLAYER_SNAPSHOT_VERSION;
  sessionId: string;
  activityIds: readonly string[];
  currentIndex: number;
  status: PlayerStatus;
  resumeStatus: ActiveStatus | null;
  activeStartedAtMs: number | null;
  accumulatedActiveMs: number;
  completions: readonly ActivityCompletion[];
  pauseReason: 'background' | 'user_exit' | null;
  errorMessage: string | null;
}>;

export type LessonPlayerEvent =
  | { type: 'LOADED' }
  | { type: 'SHOW_HINT' }
  | { type: 'SUBMIT'; outcome: ActivityCompletion['outcome'] }
  | { type: 'CONTINUE' }
  | { type: 'PAUSE_BACKGROUND' }
  | { type: 'RESUME' }
  | { type: 'REQUEST_EXIT' }
  | { type: 'CANCEL_EXIT' }
  | { type: 'CONFIRM_EXIT' }
  | { type: 'FAIL'; message: string };

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function cloneSerializableState(state: LessonPlayerState): LessonPlayerState {
  return JSON.parse(JSON.stringify(state)) as LessonPlayerState;
}

export function createLessonPlayer(
  sessionId: string,
  activityIds: readonly string[],
): LessonPlayerState {
  if (!sessionId || activityIds.length === 0 || new Set(activityIds).size !== activityIds.length) {
    throw new Error('A session ID and non-empty unique activity IDs are required.');
  }
  return frozen({
    snapshotVersion: LESSON_PLAYER_SNAPSHOT_VERSION,
    sessionId,
    activityIds: frozen([...activityIds]),
    currentIndex: 0,
    status: 'loading',
    resumeStatus: null,
    activeStartedAtMs: null,
    accumulatedActiveMs: 0,
    completions: frozen([]),
    pauseReason: null,
    errorMessage: null,
  });
}

function stopTimer(state: LessonPlayerState, now: number): number {
  return state.activeStartedAtMs === null
    ? state.accumulatedActiveMs
    : state.accumulatedActiveMs + Math.max(0, now - state.activeStartedAtMs);
}

export function transitionLessonPlayer(
  state: LessonPlayerState,
  event: LessonPlayerEvent,
  clock: Clock,
): LessonPlayerState {
  const now = clock.now();
  if (event.type === 'FAIL') {
    return frozen({
      ...state,
      status: 'error',
      activeStartedAtMs: null,
      errorMessage: event.message,
    });
  }
  if (event.type === 'LOADED' && state.status === 'loading') {
    return frozen({ ...state, status: 'active', activeStartedAtMs: now });
  }
  if (event.type === 'SHOW_HINT' && state.status === 'active') {
    return frozen({ ...state, status: 'hint' });
  }
  if (event.type === 'SUBMIT' && (state.status === 'active' || state.status === 'hint')) {
    const completion = frozen({
      activityId: state.activityIds[state.currentIndex]!,
      completedAtMs: now,
      outcome: event.outcome,
      responseTimeMs: stopTimer(state, now),
    });
    return frozen({
      ...state,
      status: 'feedback',
      activeStartedAtMs: null,
      accumulatedActiveMs: completion.responseTimeMs,
      completions: frozen([...state.completions, completion]),
    });
  }
  if (event.type === 'CONTINUE' && state.status === 'feedback') {
    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.activityIds.length) {
      return frozen({ ...state, status: 'completed', currentIndex: state.activityIds.length });
    }
    return frozen({
      ...state,
      status: 'active',
      currentIndex: nextIndex,
      activeStartedAtMs: now,
      accumulatedActiveMs: 0,
    });
  }
  if (event.type === 'PAUSE_BACKGROUND' && (state.status === 'active' || state.status === 'hint')) {
    return frozen({
      ...state,
      status: 'paused',
      resumeStatus: state.status,
      activeStartedAtMs: null,
      accumulatedActiveMs: stopTimer(state, now),
      pauseReason: 'background',
    });
  }
  if (event.type === 'RESUME' && state.status === 'paused' && state.pauseReason === 'background') {
    return frozen({
      ...state,
      status: state.resumeStatus ?? 'active',
      resumeStatus: null,
      activeStartedAtMs: now,
      pauseReason: null,
    });
  }
  if (event.type === 'REQUEST_EXIT' && ['active', 'hint', 'feedback'].includes(state.status)) {
    const resumeStatus = state.status as ActiveStatus;
    return frozen({
      ...state,
      status: 'exit-confirmation',
      resumeStatus,
      activeStartedAtMs: null,
      accumulatedActiveMs:
        resumeStatus === 'feedback' ? state.accumulatedActiveMs : stopTimer(state, now),
    });
  }
  if (event.type === 'CANCEL_EXIT' && state.status === 'exit-confirmation') {
    const restored = state.resumeStatus ?? 'active';
    return frozen({
      ...state,
      status: restored,
      resumeStatus: null,
      activeStartedAtMs: restored === 'feedback' ? null : now,
    });
  }
  if (event.type === 'CONFIRM_EXIT' && state.status === 'exit-confirmation') {
    return frozen({ ...state, status: 'paused', pauseReason: 'user_exit' });
  }
  return state;
}

export function createLessonSnapshot(state: LessonPlayerState): LessonPlayerState {
  return cloneSerializableState(state);
}

export function restoreLessonSnapshot(snapshot: LessonPlayerState): LessonPlayerState {
  if (
    snapshot.snapshotVersion !== LESSON_PLAYER_SNAPSHOT_VERSION ||
    snapshot.currentIndex < 0 ||
    snapshot.currentIndex > snapshot.activityIds.length ||
    snapshot.completions.length > snapshot.activityIds.length
  ) {
    throw new Error('Invalid or unsupported lesson-player snapshot.');
  }
  const resumable = snapshot.status === 'active' || snapshot.status === 'hint';
  return frozen({
    ...cloneSerializableState(snapshot),
    status: resumable ? 'paused' : snapshot.status,
    resumeStatus: resumable ? snapshot.status : snapshot.resumeStatus,
    activeStartedAtMs: null,
    pauseReason: resumable ? 'background' : snapshot.pauseReason,
    activityIds: frozen([...snapshot.activityIds]),
    completions: frozen(snapshot.completions.map((completion) => frozen({ ...completion }))),
  });
}
