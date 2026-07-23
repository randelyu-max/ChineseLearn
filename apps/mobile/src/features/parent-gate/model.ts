export const parentGateIntents = [
  'parent_area',
  'purchase',
  'settings',
  'privacy',
  'external_link',
] as const;

export type ParentGateIntent = (typeof parentGateIntents)[number];

export type ParentGateChallengeDefinition = Readonly<{
  answer: string;
  prompt: string;
}>;

export const parentGateChallenges: readonly ParentGateChallengeDefinition[] = [
  {
    answer: '隐私设置',
    prompt: '请阅读：孩子正在学习，不应看到购买和隐私设置。请输入这句话最后四个字。',
  },
  {
    answer: '32',
    prompt: '家长计算题：每天学习 8 分钟，每周 4 天，一共多少分钟？请输入数字。',
  },
  {
    answer: '监护人',
    prompt: '请阅读两个词：课程 / 监护人。请输入斜线后面的词。',
  },
] as const;

export type ParentGateState = Readonly<{
  challengeIndex: number;
  failedAttempts: number;
  lockedUntilMs: number | null;
}>;

export type ParentGateSubmission = Readonly<{
  state: ParentGateState;
  unlocked: boolean;
}>;

export const maximumGateAttempts = 3;
export const gateLockDurationMs = 30_000;

export function createParentGateState(challengeIndex = 0): ParentGateState {
  return {
    challengeIndex: Math.abs(Math.trunc(challengeIndex)) % parentGateChallenges.length,
    failedAttempts: 0,
    lockedUntilMs: null,
  };
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLocaleLowerCase().replaceAll(/\s+/g, '');
}

export function submitParentGateAnswer(
  state: ParentGateState,
  answer: string,
  nowMs: number,
): ParentGateSubmission {
  if (state.lockedUntilMs !== null && nowMs < state.lockedUntilMs) {
    return { state, unlocked: false };
  }

  const activeState =
    state.lockedUntilMs !== null ? { ...state, failedAttempts: 0, lockedUntilMs: null } : state;
  const challenge = parentGateChallenges[activeState.challengeIndex];
  if (normalizeAnswer(answer) === normalizeAnswer(challenge.answer)) {
    return {
      state: createParentGateState(activeState.challengeIndex + 1),
      unlocked: true,
    };
  }

  const failedAttempts = activeState.failedAttempts + 1;
  return {
    state:
      failedAttempts >= maximumGateAttempts
        ? {
            challengeIndex: (activeState.challengeIndex + 1) % parentGateChallenges.length,
            failedAttempts: 0,
            lockedUntilMs: nowMs + gateLockDurationMs,
          }
        : { ...activeState, failedAttempts },
    unlocked: false,
  };
}

export function gateSecondsRemaining(state: ParentGateState, nowMs: number): number {
  if (state.lockedUntilMs === null) return 0;
  return Math.max(0, Math.ceil((state.lockedUntilMs - nowMs) / 1000));
}

export function parseParentGateIntent(value: unknown): ParentGateIntent | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && parentGateIntents.includes(candidate as ParentGateIntent)
    ? (candidate as ParentGateIntent)
    : null;
}
