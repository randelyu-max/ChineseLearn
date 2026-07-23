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

For Railway, attach a PostgreSQL service and expose its `DATABASE_URL` to the API service. Use the
root `railway.toml` for the API and `railway.admin.toml` for the optional admin service.

Rollback for Task 4.1R is to undeploy the `/api/session-plan` route first. If the migration has not
been deployed, remove `0002_session_plan_idempotency.sql`. After deployment, do not edit or delete
the migration; restore the database backup or ship a separately reviewed forward migration that
preserves any created session snapshots.
