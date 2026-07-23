import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const migrationDirectory = join(root, 'supabase', 'migrations');
const migrationPattern = /^\d{12}_[a-z0-9_]+\.sql$/;
const ignoredFiles = new Set(['README.md']);

function fail(message) {
  throw new Error(`Supabase migration validation failed: ${message}`);
}

const entries = await readdir(migrationDirectory, { withFileTypes: true });
const unexpected = entries
  .filter(
    (entry) =>
      entry.isFile() && !ignoredFiles.has(entry.name) && !migrationPattern.test(entry.name),
  )
  .map((entry) => entry.name);
if (unexpected.length > 0) fail(`unexpected migration filenames: ${unexpected.join(', ')}`);

const migrationFiles = entries
  .filter((entry) => entry.isFile() && migrationPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();
if (migrationFiles.length === 0) fail('no ordered SQL migrations were found');

const migrationSql = [];
for (const filename of migrationFiles) {
  const sql = await readFile(join(migrationDirectory, filename), 'utf8');
  if (!/\bbegin;[\s\S]*\bcommit;\s*$/i.test(sql)) fail(`${filename} is not transaction-wrapped`);
  migrationSql.push(sql);
}

const schemaSql = migrationSql.join('\n');
const tableBlocks = [
  ...schemaSql.matchAll(/create table(?: if not exists)? public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/gi),
];
if (tableBlocks.length === 0) fail('no public tables were found');

const tableNames = tableBlocks.map((match) => match[1]);
if (new Set(tableNames).size !== tableNames.length)
  fail('a public table is created more than once');
for (const [, tableName, body] of tableBlocks) {
  if (!/\bprimary key\b/i.test(body)) fail(`public.${tableName} has no primary key`);
}

const rlsTables = new Set(
  [...schemaSql.matchAll(/alter table public\.([a-z_]+) enable row level security;/gi)].map(
    (match) => match[1],
  ),
);
const missingRls = tableNames.filter((tableName) => !rlsTables.has(tableName));
if (missingRls.length > 0) fail(`tables missing RLS: ${missingRls.join(', ')}`);

if (!/revoke all on all tables in schema public from anon, authenticated;/i.test(schemaSql)) {
  fail('client table privileges are not revoked before the allow-list grants');
}

const seedSql = await readFile(join(root, 'supabase', 'seed.sql'), 'utf8');
for (const fixtureId of [
  '90000000-0000-4000-8000-000000000101',
  '90000000-0000-4000-8000-000000000102',
  '90000000-0000-4000-8000-000000000201',
  '90000000-0000-4000-8000-000000000202',
]) {
  if (!seedSql.includes(fixtureId)) fail(`seed is missing fixture ${fixtureId}`);
}
if (/\b(create|alter|drop|grant|revoke)\b/i.test(seedSql.replaceAll('-- Local-only', ''))) {
  fail('seed.sql must contain data statements only');
}

const config = await readFile(join(root, 'supabase', 'config.toml'), 'utf8');
if (
  !/\[db\.seed\][\s\S]*enabled\s*=\s*true[\s\S]*sql_paths\s*=\s*\["\.\/seed\.sql"\]/i.test(config)
) {
  fail('config.toml does not enable supabase/seed.sql');
}

const rlsTest = await readFile(
  join(root, 'supabase', 'tests', 'database', 'rls_family_isolation.test.sql'),
  'utf8',
);
for (const protectedTable of [
  'child_profiles',
  'learning_sessions',
  'attempts',
  'reward_transactions',
  'parent_reports',
  'consent_records',
]) {
  if (!rlsTest.includes(`public.${protectedTable}`)) {
    fail(`RLS test does not cover public.${protectedTable}`);
  }
}
if (!rlsTest.includes('set local role service_role;')) {
  fail('RLS test does not exercise the server-only service role');
}

const consentTest = await readFile(
  join(root, 'supabase', 'tests', 'database', 'consent_child_profile.test.sql'),
  'utf8',
);
for (const requiredCoverage of [
  'CURRENT_REQUIRED_CONSENT_MISSING',
  'create_child_profile_with_consents',
  'ai_personalization',
  'cloud_speech',
  'targeted-advertising',
]) {
  if (!consentTest.includes(requiredCoverage)) {
    fail(`consent/profile test is missing coverage for ${requiredCoverage}`);
  }
}
for (const databaseGuard of [
  'create trigger enforce_child_profile_consents',
  'create trigger apply_consent_withdrawal',
  'child_profiles_interests_approved_check',
  'create_child_profile_with_consents',
  'event_sequence desc',
]) {
  if (!schemaSql.toLowerCase().includes(databaseGuard)) {
    fail(`database is missing Task 2.4 guard: ${databaseGuard}`);
  }
}

console.log(
  `Supabase static validation passed: ${migrationFiles.length} migrations, ${tableNames.length} RLS tables, 2 household fixtures, family isolation and consent tests present.`,
);
