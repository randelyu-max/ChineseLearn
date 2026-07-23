# Migrations

The initial schema is split into six ordered, transaction-wrapped migrations:

1. extensions, enums, and shared helpers;
2. family, consent, and privacy tables;
3. versioned curriculum tables;
4. learning evidence, rewards, and AI audit tables;
5. indexes and `updated_at` triggers;
6. authorization helpers, RLS policies, and explicit grants.

`supabase db reset` applies these files in filename order, then loads `../seed.sql`.
Do not edit an applied migration in a shared environment; add a new ordered migration instead.

The root `pnpm db:validate:static` check verifies ordering, transaction wrappers, primary keys,
RLS coverage, explicit client privilege revocation, and the two-family seed fixture. It does not
replace a real `supabase db reset` against the local Postgres stack.
