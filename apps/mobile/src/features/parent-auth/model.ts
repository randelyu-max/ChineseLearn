export type AuthNoticeCode =
  | 'configuration_missing'
  | 'invalid_credentials'
  | 'email_unconfirmed'
  | 'rate_limited'
  | 'network_unavailable'
  | 'session_expired'
  | 'storage_unavailable'
  | 'generic';

export type ParentAuthState = {
  status: 'restoring' | 'signed_out' | 'authenticated' | 'recovery';
  userEmail: string | null;
  notice: AuthNoticeCode | null;
};

export type ParentAuthEvent =
  | { type: 'restored'; email: string | null }
  | { type: 'signed_in'; email: string | null }
  | { type: 'password_recovery'; email: string | null }
  | { type: 'signed_out'; reason?: 'logout' | 'expired' }
  | { type: 'failed'; notice: AuthNoticeCode }
  | { type: 'clear_notice' };

export const initialParentAuthState: ParentAuthState = {
  status: 'restoring',
  userEmail: null,
  notice: null,
};

export function reduceParentAuthState(
  state: ParentAuthState,
  event: ParentAuthEvent,
): ParentAuthState {
  switch (event.type) {
    case 'restored':
      return {
        status: event.email ? 'authenticated' : 'signed_out',
        userEmail: event.email,
        notice: null,
      };
    case 'signed_in':
      return {
        status: 'authenticated',
        userEmail: event.email,
        notice: null,
      };
    case 'password_recovery':
      return {
        status: 'recovery',
        userEmail: event.email,
        notice: null,
      };
    case 'signed_out':
      return {
        status: 'signed_out',
        userEmail: null,
        notice: event.reason === 'expired' ? 'session_expired' : null,
      };
    case 'failed':
      return { ...state, notice: event.notice };
    case 'clear_notice':
      return { ...state, notice: null };
  }
}

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

export function safeAuthNotice(error: unknown): AuthNoticeCode {
  const candidate = typeof error === 'object' && error !== null ? (error as AuthErrorLike) : {};
  const code = typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) {
    return 'invalid_credentials';
  }
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) {
    return 'email_unconfirmed';
  }
  if (
    candidate.status === 429 ||
    code.includes('over_request_rate_limit') ||
    message.includes('rate limit')
  ) {
    return 'rate_limited';
  }
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror')
  ) {
    return 'network_unavailable';
  }
  if (message.includes('secure') || message.includes('storage')) {
    return 'storage_unavailable';
  }
  return 'generic';
}

export const AUTH_NOTICE_MESSAGES: Record<AuthNoticeCode, string> = {
  configuration_missing: '家长账户服务尚未配置，请稍后再试。',
  invalid_credentials: '邮箱或密码不正确。',
  email_unconfirmed: '请先完成邮箱验证后再登录。',
  rate_limited: '尝试次数较多，请稍后再试。',
  network_unavailable: '当前无法连接网络，请检查网络后重试。',
  session_expired: '家长登录已过期，请重新登录。孩子当前的离线学习进度不受影响。',
  storage_unavailable: '无法安全保存登录信息，请检查设备设置后重试。',
  generic: '暂时无法完成操作，请稍后再试。',
};
