export {
  createParentGateState,
  gateLockDurationMs,
  gateSecondsRemaining,
  maximumGateAttempts,
  parentGateChallenges,
  parentGateIntents,
  parseParentGateIntent,
  submitParentGateAnswer,
} from './model';
export type {
  ParentGateChallengeDefinition,
  ParentGateIntent,
  ParentGateState,
  ParentGateSubmission,
} from './model';
export { ParentGateChallenge } from './ParentGateChallenge';
export { ParentGateLoading } from './ParentGateLoading';
export {
  ParentGateProvider,
  parentGateHref,
  useParentGate,
  useRequireParentGate,
} from './provider';
