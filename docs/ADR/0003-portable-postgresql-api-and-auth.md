# ADR 0003: Portable PostgreSQL, API, and authentication

- Status: Accepted
- Date: 2026-07-23

## Context

The original backend coupled database migrations, authentication, direct mobile queries, local
tooling, and server functions to one backend platform. HanziQuest needs a conventional backend
that can run on Railway while keeping the single-user model and cross-user isolation.

## Decision

- Use standard PostgreSQL 17 and immutable SQL migrations in `database/migrations`.
- Use Better Auth with its PostgreSQL adapter for email/password accounts, verification, password
  recovery, and sessions.
- Expose a Hono Node API from `apps/api`; mobile and admin clients never receive database
  credentials.
- Keep SecureStore through the Better Auth Expo integration.
- Run private queries as `hanziquest_app` with a transaction-local `app.current_user_id`.
- Force RLS on every private business table as defense in depth.
- Use provider-neutral SMTP configuration for account email.
- Provide Railway build, pre-deploy migration, start, and health-check configuration.

## Consequences

- Deployments require `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and allowed origins.
- Verification and password-recovery email require a configured SMTP transport.
- The migration user must be allowed to create/grant the non-login `hanziquest_app` role.
- Existing hosted data, if any, needs an explicit export/transform/import rehearsal before
  cutover; these migrations never reset a remote database.
- Rollback is an application rollback plus database restore or a reviewed forward migration.
  Applied migration files are never rewritten.
