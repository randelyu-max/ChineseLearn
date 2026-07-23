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

For Railway, attach a PostgreSQL service and expose its `DATABASE_URL` to the API service. Use the
root `railway.toml` for the API and `railway.admin.toml` for the optional admin service.
