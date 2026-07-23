# HanziQuest validation report

Validation date: 2026-07-23

## Current backend

The V1 backend uses standard PostgreSQL, Better Auth, and the Hono Node API in `apps/api`.
The Expo client stores its Better Auth session with SecureStore and accesses private data only
through authenticated API routes. It has no database credential or direct database SDK.

Private business tables use `user_id`; `profiles.id` references the Better Auth `user` table.
The API runs private queries as the non-login `hanziquest_app` role and sets
`app.current_user_id` for each transaction. Forced PostgreSQL RLS provides cross-user isolation.
Mastery, review scheduling, reward balances, server summaries, and publication state have no
client write route.

The repository contains provider-neutral SQL migrations, a local PostgreSQL Compose service,
Railway API/admin configurations, and a secret-free `.env.example`.

## Completed checks

| Check | Result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | Passed |
| `pnpm format:check` | Passed |
| `pnpm lint` | Passed: 8 of 8 workspaces |
| `pnpm typecheck` | Passed: 8 of 8 workspaces |
| `pnpm test` | Passed: 41 files and 191 tests |
| `pnpm db:validate:static` | Passed: one immutable PostgreSQL migration |
| `pnpm build` | Passed: API TypeScript build, Next.js standalone build, Expo Web static export, and all shared packages |
| Runtime vendor scan | Passed: no removed backend SDK, environment variable, CLI, or runtime import remains |

## Dynamic database check

The current machine has neither Docker nor `psql`, so the PostgreSQL migration and cross-user RLS
integration test could not be executed locally. Static validation is not a substitute for that
test. CI provisions PostgreSQL 17, applies `pnpm db:migrate`, and runs `pnpm db:test`.

Before production cutover:

1. Export and verify any data from the previous host.
2. Apply migrations to an empty staging PostgreSQL 17 database.
3. Run the cross-user RLS test and Better Auth registration/session/password-recovery smoke tests.
4. Rehearse the data transform and restore.
5. Deploy the API with Railway's pre-deploy migration command.

No remote database was linked, reset, migrated, or modified during this work.

## Rollback

Before deployment, revert the application changes. After deployment, roll back the application
and restore the pre-deployment PostgreSQL snapshot, or apply a separately reviewed forward
migration. Never edit an applied migration and never reset a remote database.
