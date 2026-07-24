import {
  ActiveSessionDataSchema,
  SessionAbandonRequestSchema,
  SessionLifecycleRequestSchema,
  SessionLifecycleStateSchema,
  SessionPlanRequestV2Schema,
  SessionPlanV2SuccessResponseSchema,
  createApiSuccessResponseSchema,
  type ActiveSessionData,
  type SessionAbandonRequest,
  type SessionLifecycleRequest,
  type SessionLifecycleState,
  type SessionPlanRequestV2,
  type SessionPlanResultV2,
} from '@hanziquest/contracts';

import type { ApiResult } from '../../lib/api/client';

const ActiveSessionSuccessResponseSchema = createApiSuccessResponseSchema(ActiveSessionDataSchema);
const SessionLifecycleSuccessResponseSchema = createApiSuccessResponseSchema(
  SessionLifecycleStateSchema,
);

export type FormalSessionApi = {
  abandon(
    sessionId: string,
    request: SessionAbandonRequest,
  ): Promise<ApiResult<SessionLifecycleState>>;
  complete(
    sessionId: string,
    request: SessionLifecycleRequest,
  ): Promise<ApiResult<SessionLifecycleState>>;
  getActive(): Promise<ApiResult<ActiveSessionData>>;
  plan(request: SessionPlanRequestV2): Promise<ApiResult<SessionPlanResultV2>>;
  start(
    sessionId: string,
    request: SessionLifecycleRequest,
  ): Promise<ApiResult<SessionLifecycleState>>;
};

export type FormalSessionRequester = (
  path: string,
  init?: RequestInit,
) => Promise<ApiResult<unknown>>;

function invalidContract<T>(): ApiResult<T> {
  return { ok: false, status: 502, code: 'response_contract_invalid' };
}

export function createFormalSessionApi(request: FormalSessionRequester): FormalSessionApi {
  async function lifecycle(
    sessionId: string,
    action: 'abandon' | 'complete' | 'start',
    payload: SessionAbandonRequest | SessionLifecycleRequest,
  ): Promise<ApiResult<SessionLifecycleState>> {
    const validated =
      action === 'abandon'
        ? SessionAbandonRequestSchema.parse(payload)
        : SessionLifecycleRequestSchema.parse(payload);
    const response = await request(`/api/sessions/${sessionId}/${action}`, {
      method: 'POST',
      body: JSON.stringify(validated),
    });
    if (!response.ok) return response;
    const parsed = SessionLifecycleSuccessResponseSchema.safeParse(response.value);
    return parsed.success ? { ok: true, value: parsed.data.data } : invalidContract();
  }

  return {
    abandon: (sessionId, payload) => lifecycle(sessionId, 'abandon', payload),
    complete: (sessionId, payload) => lifecycle(sessionId, 'complete', payload),
    async getActive() {
      const response = await request('/api/sessions/active');
      if (!response.ok) return response;
      const parsed = ActiveSessionSuccessResponseSchema.safeParse(response.value);
      return parsed.success ? { ok: true, value: parsed.data.data } : invalidContract();
    },
    async plan(payload) {
      const validated = SessionPlanRequestV2Schema.parse(payload);
      const response = await request('/api/session-plan', {
        method: 'POST',
        body: JSON.stringify(validated),
      });
      if (!response.ok) return response;
      const parsed = SessionPlanV2SuccessResponseSchema.safeParse(response.value);
      return parsed.success ? { ok: true, value: parsed.data.data } : invalidContract();
    },
    start: (sessionId, payload) => lifecycle(sessionId, 'start', payload),
  };
}
