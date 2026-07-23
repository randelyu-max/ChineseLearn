import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { createAuth } from './auth/auth.js';
import { loadServerConfig } from './config.js';
import { createDatabasePool } from './db/pool.js';

const config = loadServerConfig(process.env);
const pool = createDatabasePool(config);
const auth = createAuth(config);
const app = createApp(config, auth, pool);

serve({ fetch: app.fetch, hostname: config.host, port: config.port });
