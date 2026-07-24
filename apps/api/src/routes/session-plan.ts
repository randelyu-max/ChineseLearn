import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  ERROR_SCHEMA_VERSION,
  SessionPlanRequestSchema,
  SessionPlanRequestV2Schema,
  SessionPlanResponseDataSchema,
  type SessionPlanResponseData,
  type SessionPlanSnapshot,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool, PoolClient } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';
import {
  buildAuthoritativeSessionPlan,
  loadAuthoritativePlanningState,
} from '../session-plan-service.js';
import {
  createOrReplaySessionPlanV2,
  SessionPlanV2ServiceError,
} from '../session-plan-v2-service.js';

type SessionPlanRow = {
  client_session_id: string;
  created_at: Date;
  id: string;
  plan: unknown;
};

type RouteEnvironment = {
  Variables: {
    userId: string;
  };
};

class SessionPlanRouteError extends Error {
  constructor(
    readonly code:
      'SESSION_CONTENT_UNAVAILABLE' | 'SESSION_IDEMPOTENCY_CONFLICT' | 'SESSION_PLAN_INVALID',
    readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
  }
}

function requestId(): string {
  return `req_${randomUUID()}`;
}

function errorBody(code: string, message: string, id: string, retryable = false) {
  return {
    apiVersion: API_VERSION,
    error: {
      schemaVersion: ERROR_SCHEMA_VERSION,
      code,
      message,
      requestId: id,
      retryable,
    },
  } as const;
}

function responseData(row: SessionPlanRow): SessionPlanResponseData {
  return SessionPlanResponseDataSchema.parse({
    schemaVersion: 'session-plan-snapshot-v1',
    clientSessionId: row.client_session_id,
    createdAt: row.created_at.toISOString(),
    sessionId: row.id,
    snapshot: row.plan,
  });
}

async function findExisting(
  client: PoolClient,
  userId: string,
  idempotencyKey: string,
  clientSessionId: string,
): Promise<SessionPlanRow | null> {
  const existing = await client.query<SessionPlanRow>(
    `select id, client_session_id, plan, created_at
     from public.learning_sessions
     where user_id = $1
       and (idempotency_key = $2 or client_session_id = $3)
     order by created_at, id
     limit 2`,
    [userId, idempotencyKey, clientSessionId],
  );
  if (existing.rows.length > 1) {
    throw new SessionPlanRouteError(
      'SESSION_IDEMPOTENCY_CONFLICT',
      409,
      'The idempotency key and client session ID identify different sessions.',
    );
  }
  return existing.rows[0] ?? null;
}

async function findActive(client: PoolClient, userId: string): Promise<SessionPlanRow | null> {
  const active = await client.query<SessionPlanRow>(
    `select id, client_session_id, plan, created_at
     from public.learning_sessions
     where user_id = $1 and status in ('planned', 'in_progress')
     order by created_at desc, id desc
     limit 1`,
    [userId],
  );
  return active.rows[0] ?? null;
}

async function createOrReplaySessionPlan(
  client: PoolClient,
  userId: string,
  request: ReturnType<typeof SessionPlanRequestSchema.parse>,
): Promise<{ created: boolean; row: SessionPlanRow }> {
  await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
  const existing = await findExisting(
    client,
    userId,
    request.idempotencyKey,
    request.clientSessionId,
  );
  if (existing) return { created: false, row: existing };
  const active = await findActive(client, userId);
  if (active) return { created: false, row: active };

  const state = await loadAuthoritativePlanningState(client, userId, new Date());
  if (!state) {
    throw new SessionPlanRouteError(
      'SESSION_CONTENT_UNAVAILABLE',
      409,
      'A profile and published curriculum are required before planning a session.',
    );
  }
  const snapshot: SessionPlanSnapshot = buildAuthoritativeSessionPlan(request, state);
  const inserted = await client.query<SessionPlanRow>(
    `insert into public.learning_sessions (
       user_id, client_session_id, idempotency_key, curriculum_version_id, lesson_id,
       status, target_minutes, plan_version, plan
     ) values ($1, $2, $3, $4, $5, 'planned', $6, $7, $8)
     on conflict do nothing
     returning id, client_session_id, plan, created_at`,
    [
      userId,
      request.clientSessionId,
      request.idempotencyKey,
      state.curriculumVersionId,
      state.lessonId,
      request.targetMinutes,
      snapshot.integrationAlgorithmVersion,
      snapshot,
    ],
  );
  const row =
    inserted.rows[0] ??
    (await findExisting(client, userId, request.idempotencyKey, request.clientSessionId)) ??
    (await findActive(client, userId));
  if (!row) {
    throw new SessionPlanRouteError(
      'SESSION_IDEMPOTENCY_CONFLICT',
      409,
      'The session could not be created because its identity is already in use.',
    );
  }
  return { created: inserted.rows.length === 1, row };
}

export function sessionPlanRoutes(auth: HanziQuestAuth, pool: Pool) {
  const routes = new Hono<RouteEnvironment>();
  routes.use('*', async (context, next) => {
    const session = await auth.api.getSession({ headers: context.req.raw.headers });
    if (!session) {
      const id = requestId();
      return context.json(errorBody('UNAUTHENTICATED', 'Authentication is required.', id), 401);
    }
    context.set('userId', session.user.id);
    await next();
  });

  routes.post('/', async (context) => {
    const id = requestId();
    const payload = await context.req.json().catch(() => null);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      (payload as Record<string, unknown>).schemaVersion === 'session-plan-request-v2'
    ) {
      const parsedV2 = SessionPlanRequestV2Schema.safeParse(payload);
      if (!parsedV2.success) {
        return context.json(
          errorBody('SESSION_PLAN_INVALID', 'The Session Plan V2 request is invalid.', id),
          400,
        );
      }
      try {
        const planned = await withUserTransaction(pool, context.get('userId'), (client) =>
          createOrReplaySessionPlanV2(client, context.get('userId'), parsedV2.data),
        );
        const body = {
          apiVersion: API_VERSION,
          data: planned.result,
          meta: {
            requestId: id,
            respondedAt: new Date().toISOString(),
          },
        } as const;
        return planned.created ? context.json(body, 201) : context.json(body, 200);
      } catch (error) {
        if (error instanceof SessionPlanV2ServiceError) {
          return context.json(errorBody(error.code, error.message, id), 409);
        }
        console.error('Session Plan V2 request failed', {
          code: 'SESSION_PLAN_FAILED',
          requestId: id,
        });
        return context.json(
          errorBody('SESSION_PLAN_FAILED', 'The Session Plan V2 could not be created.', id, true),
          500,
        );
      }
    }

    const parsed = SessionPlanRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        errorBody('SESSION_PLAN_INVALID', 'The session-plan request is invalid.', id),
        400,
      );
    }
    try {
      const result = await withUserTransaction(pool, context.get('userId'), (client) =>
        createOrReplaySessionPlan(client, context.get('userId'), parsed.data),
      );
      const data = responseData(result.row);
      const body = {
        apiVersion: API_VERSION,
        data,
        meta: {
          requestId: id,
          respondedAt: new Date().toISOString(),
        },
      } as const;
      return result.created ? context.json(body, 201) : context.json(body, 200);
    } catch (error) {
      if (error instanceof SessionPlanRouteError) {
        return context.json(errorBody(error.code, error.message, id), error.status);
      }
      console.error('session-plan request failed', {
        code: 'SESSION_PLAN_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody('SESSION_PLAN_FAILED', 'The session plan could not be created.', id, true),
        500,
      );
    }
  });
  return routes;
}
