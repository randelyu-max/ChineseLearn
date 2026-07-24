import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from './auth/auth.js';
import type { ServerConfig } from './config.js';
import { attemptsBatchRoutes } from './routes/attempts-batch.js';
import { diagnosticRoutes } from './routes/diagnostic.js';
import { profileRoutes } from './routes/profile.js';
import { reviewCenterRoutes } from './routes/review-center.js';
import { sessionPlanRoutes } from './routes/session-plan.js';
import { sessionRoutes } from './routes/sessions.js';
import { signaturePracticeRoutes } from './routes/signature-practice.js';

export function createApp(config: ServerConfig, auth: HanziQuestAuth, pool: Pool) {
  const app = new Hono();
  app.use(
    '*',
    cors({
      allowHeaders: ['Content-Type', 'Cookie'],
      credentials: true,
      origin: (origin) =>
        config.appOrigins.includes(origin) ? origin : (config.appOrigins[0] ?? ''),
    }),
  );
  app.get('/health', (context) => context.json({ service: 'hanziquest-api', status: 'ok' }));
  app.on(['GET', 'POST'], '/api/auth/*', (context) => auth.handler(context.req.raw));
  app.route('/api/profile', profileRoutes(auth, pool));
  app.route('/api/diagnostic', diagnosticRoutes(auth, pool));
  app.route('/api/review-center', reviewCenterRoutes(auth, pool, config.authSecret));
  app.route('/api/attempts-batch', attemptsBatchRoutes(auth, pool));
  app.route('/api/session-plan', sessionPlanRoutes(auth, pool));
  app.route('/api/sessions', sessionRoutes(auth, pool));
  app.route('/api/signature-practice', signaturePracticeRoutes(auth, pool));
  app.notFound((context) => context.json({ code: 'not_found' }, 404));
  return app;
}
