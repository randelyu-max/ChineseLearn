import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import type { ServerConfig } from '../config.js';

export function createDatabasePool(config: Pick<ServerConfig, 'databaseUrl'>): Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    statement_timeout: 10_000,
  });
}

export async function withUserTransaction<T>(
  pool: Pool,
  userId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role hanziquest_app');
    await client.query(`select set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await operation(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function oneOrNull<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[],
): Promise<T | null> {
  const result = await client.query<T>(text, [...values]);
  return result.rows[0] ?? null;
}
