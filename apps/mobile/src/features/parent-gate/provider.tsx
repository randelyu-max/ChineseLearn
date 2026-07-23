import { router, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { createParentGateState, type ParentGateIntent, type ParentGateState } from './model';

const parentAreaGrantMs = 5 * 60_000;
const sensitiveGrantMs = 60_000;

const destinations: Record<ParentGateIntent, Href> = {
  external_link: '/parent-protected-action?intent=external_link' as Href,
  parent_area: '/parent-sign-in' as Href,
  privacy: '/parent-protected-action?intent=privacy' as Href,
  purchase: '/parent-protected-action?intent=purchase' as Href,
  settings: '/parent-protected-action?intent=settings' as Href,
};

type ParentGateContextValue = {
  clear(): void;
  challengeState: ParentGateState;
  destination(intent: ParentGateIntent): Href;
  grant(intent: ParentGateIntent): void;
  hasGrant(intent: ParentGateIntent): boolean;
  revision: number;
  setChallengeState(state: ParentGateState): void;
};

const ParentGateContext = createContext<ParentGateContextValue | null>(null);

export function parentGateHref(intent: ParentGateIntent): Href {
  return `/parent-gate?intent=${intent}` as Href;
}

export function ParentGateProvider({ children }: PropsWithChildren) {
  const [grants] = useState(() => new Map<ParentGateIntent, number>());
  const [revision, setRevision] = useState(0);
  const [challengeState, setChallengeState] = useState(() =>
    createParentGateState(Math.floor(Date.now() / 60_000)),
  );

  const clear = useCallback(() => {
    grants.clear();
    setRevision((value) => value + 1);
  }, [grants]);
  const grant = useCallback(
    (intent: ParentGateIntent) => {
      const duration = intent === 'parent_area' ? parentAreaGrantMs : sensitiveGrantMs;
      grants.set(intent, Date.now() + duration);
      setRevision((value) => value + 1);
    },
    [grants],
  );
  const hasGrant = useCallback(
    (intent: ParentGateIntent) => (grants.get(intent) ?? 0) > Date.now(),
    [grants],
  );
  const destination = useCallback((intent: ParentGateIntent) => destinations[intent], []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') clear();
    });
    return () => subscription.remove();
  }, [clear]);

  const value = useMemo(
    () => ({
      challengeState,
      clear,
      destination,
      grant,
      hasGrant,
      revision,
      setChallengeState,
    }),
    [challengeState, clear, destination, grant, hasGrant, revision],
  );
  return <ParentGateContext.Provider value={value}>{children}</ParentGateContext.Provider>;
}

export function useParentGate(): ParentGateContextValue {
  const value = useContext(ParentGateContext);
  if (!value) throw new Error('useParentGate must be used inside ParentGateProvider.');
  return value;
}

export function useRequireParentGate(intent: ParentGateIntent): boolean {
  const { hasGrant, revision } = useParentGate();
  const [, setClock] = useState(() => Date.now());
  const allowed = hasGrant(intent);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!allowed) router.replace(parentGateHref(intent));
  }, [allowed, intent, revision]);
  return allowed;
}
