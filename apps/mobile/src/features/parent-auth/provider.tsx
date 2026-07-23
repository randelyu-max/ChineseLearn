import type { Session } from '@supabase/supabase-js';
import { router, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { useParentGate } from '@/features/parent-gate';
import { getSupabaseClient } from '@/lib/supabase/client';

import {
  initialParentAuthState,
  reduceParentAuthState,
  safeAuthNotice,
  type AuthNoticeCode,
  type ParentAuthState,
} from './model';
import {
  consumeAuthCallback,
  requestParentPasswordReset,
  signInParent,
  signOutParent,
  updateParentPassword,
  type AuthActionResult,
} from './service';

type ParentAuthContextValue = {
  clearNotice(): void;
  requestPasswordReset(email: string): Promise<AuthActionResult>;
  signIn(email: string, password: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
  state: ParentAuthState;
  updatePassword(password: string): Promise<AuthActionResult>;
};

const ParentAuthContext = createContext<ParentAuthContextValue | null>(null);

function emailFromSession(session: Session | null): string | null {
  return session?.user.email ?? null;
}

export function ParentAuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reduceParentAuthState, initialParentAuthState);
  const client = useMemo(() => getSupabaseClient(), []);
  const hadSession = useRef(false);
  const logoutRequested = useRef(false);
  const { grant: grantParentGate } = useParentGate();

  useEffect(() => {
    if (!client) {
      dispatch({ type: 'restored', email: null });
      dispatch({ type: 'failed', notice: 'configuration_missing' });
      return;
    }

    let mounted = true;
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          dispatch({ type: 'restored', email: null });
          dispatch({ type: 'failed', notice: safeAuthNotice(error) });
          return;
        }
        const email = emailFromSession(data.session);
        hadSession.current = Boolean(data.session);
        dispatch({ type: 'restored', email });
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        dispatch({ type: 'restored', email: null });
        dispatch({ type: 'failed', notice: safeAuthNotice(error) });
      });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        hadSession.current = true;
        grantParentGate('parent_area');
        dispatch({ type: 'password_recovery', email: emailFromSession(session) });
        router.replace('/parent-update-password' as Href);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        hadSession.current = Boolean(session);
        dispatch({ type: 'signed_in', email: emailFromSession(session) });
        return;
      }
      if (event === 'SIGNED_OUT') {
        const reason = logoutRequested.current || !hadSession.current ? 'logout' : 'expired';
        logoutRequested.current = false;
        hadSession.current = false;
        dispatch({ type: 'signed_out', reason });
      }
    });

    const updateAutoRefresh = (nextState: string) => {
      if (nextState === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    };
    updateAutoRefresh(AppState.currentState);
    const appStateSubscription = AppState.addEventListener('change', updateAutoRefresh);

    const handleUrl = async (url: string) => {
      const result = await consumeAuthCallback(client, url);
      if (!mounted || !result.ok) {
        if (mounted && !result.ok) dispatch({ type: 'failed', notice: result.notice });
        return;
      }
      if (result.value?.recovery) {
        grantParentGate('parent_area');
        dispatch({ type: 'password_recovery', email: null });
        router.replace('/parent-update-password' as Href);
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      linkingSubscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, [client, grantParentGate]);

  const unavailable = useCallback(
    (notice: AuthNoticeCode = 'configuration_missing'): AuthActionResult => {
      dispatch({ type: 'failed', notice });
      return { ok: false, notice };
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      if (!client) return unavailable();
      const result = await signInParent(client, email, password);
      if (!result.ok) {
        dispatch({ type: 'failed', notice: result.notice });
        return result;
      }
      hadSession.current = true;
      dispatch({ type: 'signed_in', email: result.value.email });
      return { ok: true, value: undefined };
    },
    [client, unavailable],
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!client) return unavailable();
      const result = await requestParentPasswordReset(client, email);
      if (!result.ok) dispatch({ type: 'failed', notice: result.notice });
      return result;
    },
    [client, unavailable],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      if (!client) return unavailable();
      const result = await updateParentPassword(client, password);
      if (!result.ok) dispatch({ type: 'failed', notice: result.notice });
      return result;
    },
    [client, unavailable],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!client) return unavailable();
    logoutRequested.current = true;
    const result = await signOutParent(client);
    if (!result.ok) {
      logoutRequested.current = false;
      dispatch({ type: 'failed', notice: result.notice });
      return result;
    }
    hadSession.current = false;
    dispatch({ type: 'signed_out', reason: 'logout' });
    return result;
  }, [client, unavailable]);

  const clearNotice = useCallback(() => dispatch({ type: 'clear_notice' }), []);
  const value = useMemo(
    () => ({
      clearNotice,
      requestPasswordReset,
      signIn,
      signOut,
      state,
      updatePassword,
    }),
    [clearNotice, requestPasswordReset, signIn, signOut, state, updatePassword],
  );

  return <ParentAuthContext.Provider value={value}>{children}</ParentAuthContext.Provider>;
}

export function useParentAuth(): ParentAuthContextValue {
  const value = useContext(ParentAuthContext);
  if (!value) throw new Error('useParentAuth must be used inside ParentAuthProvider.');
  return value;
}
