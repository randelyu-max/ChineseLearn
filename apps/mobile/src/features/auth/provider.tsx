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

import { loadProfile, type Profile } from '@/features/profile';
import { accountServiceConfigured, authClient } from '@/lib/api/auth-client';
import { authReducer, initialAuthState, type AuthState } from './model';
import {
  passwordResetToken,
  requestPasswordReset as requestReset,
  signIn as authenticate,
  signOut as endSession,
  signUp as register,
  updatePassword as changePassword,
  type AuthResult,
} from './service';

type SessionUser = { email?: string | null; id: string };
type SessionResult = { user: SessionUser } | null;

type AuthContextValue = {
  state: AuthState;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(
    email: string,
    password: string,
  ): Promise<AuthResult<{ emailConfirmationRequired: boolean }>>;
  signOut(): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  refreshProfile(): Promise<void>;
  acceptProfile(profile: Profile): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const unavailable = <T,>(): AuthResult<T> => ({ ok: false, notice: '应用尚未配置账户服务。' });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const loadSequence = useRef(0);
  const recoveryToken = useRef<string | null>(null);
  const configured = accountServiceConfigured();

  const resolveSession = useCallback(async (session: SessionResult) => {
    const sequence = ++loadSequence.current;
    if (!session) {
      dispatch({ type: 'NO_SESSION' });
      return;
    }
    dispatch({
      type: 'SESSION_FOUND',
      userId: session.user.id,
      email: session.user.email ?? null,
    });
    const result = await loadProfile();
    if (sequence !== loadSequence.current) return;
    if (!result.ok) {
      dispatch({ type: 'PROFILE_FAILED', notice: '暂时无法读取个人设置，请检查网络后重试。' });
    } else if (result.value === null) {
      dispatch({ type: 'PROFILE_MISSING' });
    } else {
      dispatch({ type: 'PROFILE_LOADED', profile: result.value });
    }
  }, []);

  const restoreSession = useCallback(async () => {
    if (!configured) {
      dispatch({ type: 'NO_SESSION', notice: '应用尚未配置账户服务。' });
      return;
    }
    const result = await authClient.getSession();
    await resolveSession(result.data ? { user: result.data.user } : null);
  }, [configured, resolveSession]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void restoreSession();
    });
    return () => subscription.remove();
  }, [restoreSession]);

  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const token = passwordResetToken(url);
      if (!token) return;
      recoveryToken.current = token;
      dispatch({ type: 'PASSWORD_RECOVERY', userId: null, email: null });
    };
    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async signIn(email, password) {
        if (!configured) return unavailable();
        const result = await authenticate(email, password);
        if (result.ok) await restoreSession();
        return result;
      },
      async signUp(email, password) {
        if (!configured) return unavailable();
        const result = await register(email, password);
        if (result.ok && !result.value.emailConfirmationRequired) await restoreSession();
        return result;
      },
      async signOut() {
        if (!configured) {
          dispatch({ type: 'NO_SESSION' });
          return { ok: true, value: undefined };
        }
        const result = await endSession();
        if (result.ok) dispatch({ type: 'NO_SESSION' });
        return result;
      },
      requestPasswordReset: (email) =>
        configured ? requestReset(email) : Promise.resolve(unavailable()),
      async updatePassword(password) {
        const token = recoveryToken.current;
        if (!configured) return unavailable();
        if (!token) return { ok: false, notice: '重设链接无效或已过期，请重新申请。' };
        const result = await changePassword(password, token);
        if (result.ok) recoveryToken.current = null;
        return result;
      },
      refreshProfile: restoreSession,
      acceptProfile(profile) {
        dispatch({ type: 'PROFILE_LOADED', profile });
      },
    }),
    [configured, restoreSession, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
