# HanziQuest V1 rollback runbook

## Before promotion

1. Record the Git commit, mobile build numbers, API/admin deployment IDs, and all content versions.
2. Create a PostgreSQL snapshot using the hosting provider's backup mechanism.
3. Verify the snapshot can be listed or restored into an isolated database without touching
   production.
4. Run migrations and cross-user RLS tests against an isolated restore.
5. Keep the prior API/admin deployment and prior signed mobile build available.

Never reset a remote database or edit an applied migration.

## Production Curriculum Release

Before promotion, record the current row in `active_curriculum_releases`. If a newly activated
Curriculum is faulty, deploy an application version that does not request the faulty content and
move the active pointer to a previously published compatible release in a reviewed transaction.
Existing Sessions remain pinned to their original `curriculum_version_id`; do not rewrite them.

Never edit or delete published Curriculum rows, the published import receipt, or an applied
migration. If no compatible previous release exists, stop new Session creation and restore a
verified database snapshot or ship a forward-only replacement release.

## Application rollback

- Stop promotion of the candidate mobile build.
- Redeploy the previously recorded API/admin deployment.
- If the mobile build is already available, use the store's phased-release halt and previous-build
  recovery process.
- For a static-content problem, stop publishing the affected content version and restore the prior
  bundled version in a new application build.

## Database rollback

Migrations are forward-only. If a migration has not run, remove it from the candidate before
promotion. Once applied, choose one of:

- ship a separately reviewed corrective forward migration that preserves user records; or
- restore the verified pre-promotion snapshot into a replacement database and repoint the API
  during a maintenance window.

Do not use `git reset --hard`, rewrite an applied migration, drop a remote database, or bypass RLS
with a service role.

## Verification after rollback

- `/health` responds successfully.
- Login and session restoration work.
- User A cannot read or modify User B records.
- The last accepted offline event remains idempotent after retry.
- Raw writing strokes remain local.
- The previous curriculum/content version is visible.
- Error rates and database connections return to their prior baseline.
