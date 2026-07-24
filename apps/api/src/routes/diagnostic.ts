import { randomUUID } from 'node:crypto';

import {
  API_VERSION,
  DiagnosticMutationSchema,
  DiagnosticRunSchema,
  ERROR_SCHEMA_VERSION,
} from '@hanziquest/contracts';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from '../auth/auth.js';
import { withUserTransaction } from '../db/pool.js';
import { loadDiagnosticRun, mutateDiagnosticRun } from '../diagnostic-service.js';

type RouteEnvironment = { Variables: { userId: string } };
const requestId = () => `req_${randomUUID()}`;
const errorBody = (code: string, message: string, id: string, retryable = false) => ({
  apiVersion: API_VERSION,
  error: { schemaVersion: ERROR_SCHEMA_VERSION, code, message, requestId: id, retryable },
});
const successBody = (data: unknown, id: string) => ({
  apiVersion: API_VERSION,
  data: data === null ? null : DiagnosticRunSchema.parse(data),
  meta: { requestId: id, respondedAt: new Date().toISOString() },
});

export function diagnosticRoutes(auth: HanziQuestAuth, pool: Pool) {
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
    try {
      const run = await withUserTransaction(pool, context.get('userId'), (client) =>
        loadDiagnosticRun(client, context.get('userId')),
      );
      return context.json(successBody(run, id));
    } catch {
      return context.json(
        errorBody('DIAGNOSTIC_READ_FAILED', 'The diagnostic could not be loaded.', id, true),
        500,
      );
    }
  });

  routes.post('/', async (context) => {
    const id = requestId();
    const parsed = DiagnosticMutationSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) {
      return context.json(
        errorBody('DIAGNOSTIC_MUTATION_INVALID', 'The diagnostic update is invalid.', id),
        400,
      );
    }
    try {
      const run = await withUserTransaction(pool, context.get('userId'), (client) =>
        mutateDiagnosticRun(client, context.get('userId'), parsed.data),
      );
      if (!run) {
        return context.json(
          errorBody('DIAGNOSTIC_RUN_NOT_FOUND', 'Start the diagnostic before completing it.', id),
          409,
        );
      }
      return context.json(successBody(run, id), parsed.data.action === 'start' ? 201 : 200);
    } catch {
      return context.json(
        errorBody('DIAGNOSTIC_SAVE_FAILED', 'The diagnostic could not be saved.', id, true),
        500,
      );
    }
  });
  return routes;
}
