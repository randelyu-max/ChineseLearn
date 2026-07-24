# PostgreSQL database

`migrations/` is the only schema source of truth. Migrations are immutable after deployment and are
applied by `pnpm db:migrate`, which records checksums in `public.app_migrations`.

For local development:

```powershell
docker compose up -d postgres
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/hanziquest'
corepack pnpm db:migrate
corepack pnpm db:test
```

The API authenticates users with Better Auth, then runs private business queries as
`hanziquest_app` with a transaction-local `app.current_user_id`. Forced PostgreSQL RLS prevents
cross-user access. The mobile app never receives database credentials.

Migration `0002_session_plan_idempotency.sql` adds per-user client-session and idempotency
uniqueness, grants the application role only the columns required to create a plan, and protects
the persisted plan snapshot with an immutability trigger. It backfills any pre-existing local
session with its server ID before making both keys required.

Migration `0003_attempt_processing.sql` grants only the columns required for authoritative attempt
processing, keeps user-owned skill and review rows behind forced RLS, and makes attempts immutable.
Migration `0004_attempt_cascade_delete.sql` narrows the immutability trigger to updates: the
application role still has no delete privilege, while deleting an authentication user can execute
the required foreign-key cascade.

For Railway, attach a PostgreSQL service and expose its `DATABASE_URL` to the API service. Use the
root `railway.toml` for the API and `railway.admin.toml` for the optional admin service.

Rollback for Task 4.1R is to undeploy the `/api/session-plan` route first. If the migration has not
been deployed, remove `0002_session_plan_idempotency.sql`. After deployment, do not edit or delete
the migration; restore the database backup or ship a separately reviewed forward migration that
preserves any created session snapshots.

Rollback for Task 4.3R is to stop serving `/api/attempts-batch` and disable mobile outbox sync.
Before deployment, migrations `0003` and `0004` can be omitted. After deployment, never edit or
delete them: immutable attempts remain replayable facts, and any schema rollback must be a reviewed
forward migration or a database restore.

## V1 release rehearsal

Task 8.0 applied all six migrations to an isolated, no-volume PostgreSQL 17 container, ran the
dynamic database suite, produced a custom-format backup, restored it into a second database, and
reran the same suite. Both runs passed. The local rehearsal artifact is
`release-backups/hanziquest-v1-release-2026-07-23.dump` with SHA-256
`6B47DF3531EB4C3C32DAE1EE23911A94B4DD22618E77A3EE2413E0F2EDB03E19`.

This artifact contains disposable local test data and is not a production backup. Production
promotion still requires a fresh provider snapshot, recorded deployment IDs, and an isolated
restore check. Never reset a remote database for rehearsal.
