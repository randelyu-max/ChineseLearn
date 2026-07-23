import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  AttemptsBatchRequestSchema,
  ERROR_SCHEMA_VERSION,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import { processAttemptsBatch } from '../attempts-batch-service.js';
import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';

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

export function attemptsBatchRoutes(auth: HanziQuestAuth, pool: Pool) {
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
    const parsed = AttemptsBatchRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json(
        errorBody('ATTEMPTS_BATCH_INVALID', 'The attempts batch is invalid.', id),
        400,
      );
    }
    try {
      const processed = await withUserTransaction(pool, context.get('userId'), (client) =>
        processAttemptsBatch(client, context.get('userId'), parsed.data),
      );
      if (!processed) {
        return context.json(
          errorBody('SESSION_NOT_FOUND', 'The learning session was not found.', id),
          404,
        );
      }
      return context.json({
        apiVersion: API_VERSION,
        data: {
          schemaVersion: 'attempts-batch-response-v1',
          sessionId: parsed.data.sessionId,
          results: processed.results,
          syncCursor: processed.syncCursor,
        },
        meta: {
          requestId: id,
          respondedAt: new Date().toISOString(),
        },
      });
    } catch {
      console.error('attempts-batch request failed', {
        code: 'ATTEMPTS_BATCH_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody('ATTEMPTS_BATCH_FAILED', 'The attempts batch could not be processed.', id, true),
        500,
      );
    }
  });
  return routes;
}
