import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  ERROR_SCHEMA_VERSION,
  SessionAbandonRequestSchema,
  SessionLifecycleRequestSchema,
  UuidSchema,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';
import {
  loadActiveSession,
  SessionLifecycleServiceError,
  transitionSession,
} from '../session-lifecycle-service.js';

type RouteEnvironment = {
  Variables: {
    userId: string;
  };
};

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

function successBody<T>(data: T, id: string) {
  return {
    apiVersion: API_VERSION,
    data,
    meta: {
      requestId: id,
      respondedAt: new Date().toISOString(),
    },
  } as const;
}

export function sessionRoutes(auth: HanziQuestAuth, pool: Pool) {
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

  routes.get('/active', async (context) => {
    const id = requestId();
    try {
      const active = await withUserTransaction(pool, context.get('userId'), (client) =>
        loadActiveSession(client, context.get('userId')),
      );
      return context.json(successBody(active, id));
    } catch {
      console.error('active Session request failed', {
        code: 'ACTIVE_SESSION_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody('ACTIVE_SESSION_FAILED', 'The active Session could not be loaded.', id, true),
        500,
      );
    }
  });

  for (const action of ['start', 'complete', 'abandon'] as const) {
    routes.post(`/:id/${action}`, async (context) => {
      const id = requestId();
      const sessionId = UuidSchema.safeParse(context.req.param('id'));
      const payload = await context.req.json().catch(() => null);
      const parsed =
        action === 'abandon'
          ? SessionAbandonRequestSchema.safeParse(payload)
          : SessionLifecycleRequestSchema.safeParse(payload);
      if (!sessionId.success || !parsed.success) {
        return context.json(
          errorBody('SESSION_LIFECYCLE_INVALID', 'The Session lifecycle request is invalid.', id),
          400,
        );
      }
      try {
        const state = await withUserTransaction(pool, context.get('userId'), (client) =>
          transitionSession(client, context.get('userId'), sessionId.data, action, parsed.data),
        );
        return context.json(successBody(state, id));
      } catch (error) {
        if (error instanceof SessionLifecycleServiceError) {
          const status = error.code === 'SESSION_NOT_FOUND' ? 404 : 409;
          return context.json(errorBody(error.code, error.message, id), status);
        }
        console.error('Session lifecycle request failed', {
          code: 'SESSION_LIFECYCLE_FAILED',
          requestId: id,
        });
        return context.json(
          errorBody(
            'SESSION_LIFECYCLE_FAILED',
            'The Session lifecycle action could not be applied.',
            id,
            true,
          ),
          500,
        );
      }
    });
  }
  return routes;
}
