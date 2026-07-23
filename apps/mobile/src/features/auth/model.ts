import type { Profile } from '@/features/profile';

export type AuthStatus =
  | 'restoring'
  | 'unauthenticated'
  | 'authenticated_profile_loading'
  | 'onboarding_required'
  | 'ready'
  | 'profile_error'
  | 'recovery';

export type AuthState = Readonly<{
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  notice: string | null;
}>;

export const initialAuthState: AuthState = {
  status: 'restoring',
  userId: null,
  email: null,
  profile: null,
  notice: null,
};

export type AuthEvent =
  | { type: 'NO_SESSION'; notice?: string }
  | { type: 'SESSION_FOUND'; userId: string; email: string | null }
  | { type: 'PROFILE_LOADED'; profile: Profile }
  | { type: 'PROFILE_MISSING' }
  | { type: 'PROFILE_FAILED'; notice: string }
  | { type: 'PASSWORD_RECOVERY'; userId: string | null; email: string | null };

export function authReducer(state: AuthState, event: AuthEvent): AuthState {
  switch (event.type) {
    case 'NO_SESSION':
      return { ...initialAuthState, status: 'unauthenticated', notice: event.notice ?? null };
    case 'SESSION_FOUND':
      return {
        status: 'authenticated_profile_loading',
        userId: event.userId,
        email: event.email,
        profile: null,
        notice: null,
      };
    case 'PROFILE_LOADED':
      return { ...state, status: 'ready', profile: event.profile, notice: null };
    case 'PROFILE_MISSING':
      return { ...state, status: 'onboarding_required', profile: null, notice: null };
    case 'PROFILE_FAILED':
      return { ...state, status: 'profile_error', profile: null, notice: event.notice };
    case 'PASSWORD_RECOVERY':
      return {
        status: 'recovery',
        userId: event.userId,
        email: event.email,
        profile: null,
        notice: null,
      };
  }
}
