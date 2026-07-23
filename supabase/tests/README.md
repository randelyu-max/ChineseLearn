# Supabase tests

Database security tests live under `database/` and run with pgTAP through:

```sh
pnpm supabase test db
```

`database/rls_family_isolation.test.sql` verifies cross-household isolation for children,
sessions, attempts, rewards, parent reports, and consent records. It also covers the
owner/parent/viewer matrix, anonymous/default denial, and the server-only service role.

The test uses only synthetic fixed IDs and rolls back all test-specific rows.
