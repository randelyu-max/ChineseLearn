import { resolve } from 'node:path';

import { Pool } from 'pg';

import { importApprovedPinyinContent } from './pinyin-content-import.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const repositoryRoot = process.env.REPOSITORY_ROOT
  ? resolve(process.env.REPOSITORY_ROOT)
  : resolve(process.cwd(), '../..');
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  await client.query('begin');
  const result = await importApprovedPinyinContent(client, { repositoryRoot });
  await client.query('commit');
  console.log(
    `Pinyin import passed: ${result.conceptCount} approved concepts, manifest ${result.manifestSha256}.`,
  );
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
