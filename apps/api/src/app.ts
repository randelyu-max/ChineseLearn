import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Pool } from 'pg';

import type { HanziQuestAuth } from './auth/auth.js';
import type { ServerConfig } from './config.js';
import { profileRoutes } from './routes/profile.js';
import { sessionPlanRoutes } from './routes/session-plan.js';

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
  app.route('/api/session-plan', sessionPlanRoutes(auth, pool));
  app.notFound((context) => context.json({ code: 'not_found' }, 404));
  return app;
}
