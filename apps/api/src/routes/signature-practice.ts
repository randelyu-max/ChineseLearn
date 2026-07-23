import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  ERROR_SCHEMA_VERSION,
  SignaturePracticeMetricEventSchema,
  SignaturePracticeSummarySchema,
  SignatureProjectInputSchema,
  UuidSchema,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';
import {
  loadSignaturePracticeSummary,
  recordSignaturePractice,
  upsertSignatureProject,
} from '../signature-practice-service.js';

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

function successBody(summary: unknown, id: string) {
  return {
    apiVersion: API_VERSION,
    data: SignaturePracticeSummarySchema.parse(summary),
    meta: { requestId: id, respondedAt: new Date().toISOString() },
  } as const;
}

export function signaturePracticeRoutes(auth: HanziQuestAuth, pool: Pool) {
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

  routes.put('/project', async (context) => {
    const id = requestId();
    const parsed = SignatureProjectInputSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return context.json(
        errorBody('SIGNATURE_PROJECT_INVALID', 'The signature project is invalid.', id),
        400,
      );
    }
    try {
      const summary = await withUserTransaction(pool, context.get('userId'), (client) =>
        upsertSignatureProject(client, context.get('userId'), parsed.data),
      );
      if (!summary) {
        return context.json(
          errorBody(
            'SIGNATURE_NAME_MISMATCH',
            'The project must use the authenticated profile Chinese name.',
            id,
          ),
          409,
        );
      }
      return context.json(successBody(summary, id));
    } catch {
      console.error('signature project request failed', {
        code: 'SIGNATURE_PROJECT_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody(
          'SIGNATURE_PROJECT_FAILED',
          'The signature project could not be saved.',
          id,
          true,
        ),
        500,
      );
    }
  });

  routes.post('/events', async (context) => {
    const id = requestId();
    const parsed = SignaturePracticeMetricEventSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return context.json(
        errorBody('SIGNATURE_PRACTICE_INVALID', 'The practice metadata is invalid.', id),
        400,
      );
    }
    try {
      const result = await withUserTransaction(pool, context.get('userId'), (client) =>
        recordSignaturePractice(client, context.get('userId'), parsed.data),
      );
      if (result.status === 'project_not_found') {
        return context.json(
          errorBody('SIGNATURE_PROJECT_NOT_FOUND', 'The signature project was not found.', id),
          404,
        );
      }
      if (result.status === 'conflict') {
        return context.json(
          errorBody(
            'SIGNATURE_IDEMPOTENCY_CONFLICT',
            'The practice event identity is already used by different metadata.',
            id,
          ),
          409,
        );
      }
      return context.json(
        successBody(result.summary, id),
        result.status === 'accepted' ? 201 : 200,
      );
    } catch {
      console.error('signature practice request failed', {
        code: 'SIGNATURE_PRACTICE_FAILED',
        requestId: id,
      });
      return context.json(
        errorBody(
          'SIGNATURE_PRACTICE_FAILED',
          'The practice metadata could not be saved.',
          id,
          true,
        ),
        500,
      );
    }
  });

  routes.get('/:projectId', async (context) => {
    const id = requestId();
    const projectId = UuidSchema.safeParse(context.req.param('projectId'));
    if (!projectId.success) {
      return context.json(
        errorBody('SIGNATURE_PROJECT_INVALID', 'The signature project ID is invalid.', id),
        400,
      );
    }
    try {
      const summary = await withUserTransaction(pool, context.get('userId'), (client) =>
        loadSignaturePracticeSummary(client, context.get('userId'), projectId.data),
      );
      if (!summary) {
        return context.json(
          errorBody('SIGNATURE_PROJECT_NOT_FOUND', 'The signature project was not found.', id),
          404,
        );
      }
      return context.json(successBody(summary, id));
    } catch {
      return context.json(
        errorBody(
          'SIGNATURE_SUMMARY_FAILED',
          'The signature practice summary could not be read.',
          id,
          true,
        ),
        500,
      );
    }
  });

  return routes;
}
