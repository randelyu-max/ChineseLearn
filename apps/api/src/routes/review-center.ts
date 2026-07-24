import { randomUUID } from 'node:crypto';

import { API_VERSION, ERROR_SCHEMA_VERSION, ReviewCenterQuerySchema } from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';
import {
  loadReviewCenter,
  resolveReviewCenterPagination,
  ReviewCenterCapacityError,
  ReviewCenterCursorError,
} from '../review-center-service.js';

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

export function reviewCenterRoutes(auth: HanziQuestAuth, pool: Pool) {
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

  routes.get('/', async (context) => {
    const id = requestId();
    const parsed = ReviewCenterQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      return context.json(
        errorBody('REVIEW_CENTER_INVALID', 'The review-center query is invalid.', id),
        400,
      );
    }
    try {
      const pagination = resolveReviewCenterPagination(parsed.data, new Date());
      const data = await withUserTransaction(pool, context.get('userId'), (client) =>
        loadReviewCenter(client, context.get('userId'), pagination),
      );
      return context.json({
        apiVersion: API_VERSION,
        data,
        meta: {
          requestId: id,
          respondedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ReviewCenterCursorError) {
        return context.json(errorBody('REVIEW_CENTER_CURSOR_INVALID', error.message, id), 400);
      }
      if (error instanceof ReviewCenterCapacityError) {
        return context.json(
          errorBody(
            'REVIEW_CENTER_CAPACITY_EXCEEDED',
            'The review center is temporarily too large to load.',
            id,
            true,
          ),
          503,
        );
      }
      console.error('review-center request failed', {
        code: 'REVIEW_CENTER_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody('REVIEW_CENTER_FAILED', 'The review center could not be loaded.', id, true),
        500,
      );
    }
  });
  return routes;
}
