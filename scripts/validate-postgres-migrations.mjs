import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const directory = join(root, 'database', 'migrations');
const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();

function fail(message) {
  throw new Error(`PostgreSQL migration validation failed: ${message}`);
}

if (names.length === 0) fail('no migrations found');
if (names.some((name) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(name))) {
  fail('migration names must use NNNN_snake_case.sql');
}
if (new Set(names.map((name) => name.slice(0, 4))).size !== names.length) {
  fail('migration sequence numbers must be unique');
}

const sql = (await Promise.all(names.map((name) => readFile(join(directory, name), 'utf8')))).join(
  '\n',
);
const requiredFragments = [
  'create table public."user"',
  'create table public.profiles',
  'references public."user"(id) on delete cascade',
  'create role hanziquest_app nologin',
  "current_setting('app.current_user_id', true)",
  'alter table public.profiles force row level security',
  'create policy profiles_own',
  'create table public.learning_sessions',
  'create table public.attempts',
  'create table public.skill_states',
  'create table public.review_schedule',
];
for (const fragment of requiredFragments) {
  if (!sql.toLowerCase().includes(fragment.toLowerCase())) fail(`missing: ${fragment}`);
}

const privateTables = [
  'profiles',
  'learning_sessions',
  'attempts',
  'skill_states',
  'review_schedule',
  'confusion_stats',
  'signature_projects',
  'signature_practice_summaries',
  'signature_practice_events',
  'reward_balances',
];
for (const table of privateTables) {
  if (!sql.toLowerCase().includes(`alter table public.${table} enable row level security`)) {
    fail(`RLS is not enabled for public.${table}`);
  }
  if (!sql.toLowerCase().includes(`alter table public.${table} force row level security`)) {
    fail(`RLS is not forced for public.${table}`);
  }
}

const forbidden = [
  /\bauth\.users\b/i,
  /\bauth\.uid\s*\(/i,
  /\bservice_role\b/i,
  /\bhouseholds?\b/i,
  /\bchild_id\b/i,
  /\bparent_id\b/i,
  /\blearner_id\b/i,
];
for (const pattern of forbidden) {
  if (pattern.test(sql)) fail(`forbidden legacy database surface: ${pattern}`);
}

console.log(`PostgreSQL static validation passed: ${names.length} immutable migration(s).`);
