import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const migrationsDirectory = process.env.MIGRATIONS_DIR
  ? resolve(process.env.MIGRATIONS_DIR)
  : resolve(process.cwd(), '../../database/migrations');
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query('select pg_advisory_lock(721_260_723)');
  await client.query(`
    create table if not exists public.app_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  for (const name of names) {
    const sql = await readFile(resolve(migrationsDirectory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query<{ checksum: string }>(
      'select checksum from public.app_migrations where name = $1',
      [name],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(`Migration checksum changed: ${name}`);
      continue;
    }
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into public.app_migrations (name, checksum) values ($1, $2)', [
        name,
        checksum,
      ]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }
} finally {
  await client.query('select pg_advisory_unlock(721_260_723)');
  client.release();
  await pool.end();
}
