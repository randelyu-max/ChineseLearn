import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  AttemptsBatchRequestSchema,
  AttemptsBatchRequestV2Schema,
  ERROR_SCHEMA_VERSION,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import { processAttemptsBatch } from '../attempts-batch-service.js';
import {
  AttemptsBatchV2ServiceError,
  processAttemptsBatchV2,
} from '../attempts-batch-v2-service.js';
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
    const payload = await context.req.json().catch(() => null);
    if (
      typeof payload === 'object' &&
      payload !== null &&
      (payload as Record<string, unknown>).schemaVersion === 'attempts-batch-request-v2'
    ) {
      const parsedV2 = AttemptsBatchRequestV2Schema.safeParse(payload);
      if (!parsedV2.success) {
        return context.json(
          errorBody('ATTEMPTS_BATCH_INVALID', 'The Attempts Batch V2 is invalid.', id),
          400,
        );
      }
      try {
        const processed = await withUserTransaction(pool, context.get('userId'), (client) =>
          processAttemptsBatchV2(client, context.get('userId'), parsedV2.data),
        );
        if (!processed) {
          return context.json(
            errorBody('SESSION_NOT_FOUND', 'The learning Session was not found.', id),
            404,
          );
        }
        return context.json({
          apiVersion: API_VERSION,
          data: processed,
          meta: {
            requestId: id,
            respondedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof AttemptsBatchV2ServiceError) {
          return context.json(errorBody(error.code, error.message, id), 409);
        }
        console.error('Attempts Batch V2 request failed', {
          code: 'ATTEMPTS_BATCH_FAILED',
          requestId: id,
        });
        return context.json(
          errorBody(
            'ATTEMPTS_BATCH_FAILED',
            'The Attempts Batch V2 could not be processed.',
            id,
            true,
          ),
          500,
        );
      }
    }

    const parsed = AttemptsBatchRequestSchema.safeParse(payload);
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
