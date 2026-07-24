# Task 8.2A-H completion report

Date: 2026-07-24

Status: complete

Next allowed task: 8.2B-R

## Delivered

- Replaced offset pagination with an HMAC-signed keyset cursor containing the fixed
  `generatedAt`, last priority, last due time, and last review key.
- Moved due filtering, stable ordering, same-content multi-skill merging, confusion coverage,
  group/summary aggregation, and bounded `limit + 1` pagination into PostgreSQL.
- Added explicit active Curriculum selection by spoken and script track. Retired Curriculum
  schedules remain historical data but do not appear in the current Review Center.
- Changed `pinyin_dependency` to require observed Hanzi-recognition Evidence with a reduced support
  multiplier; `glyph_to_sound` alone is no longer sufficient.
- Preserved real Pinyin and tone groups and the read-only, session-owned API boundary.
- Added due-query indexes and an integration assertion over the PostgreSQL query plan.

## Versions and migration

- Cursor: `review-center-cursor-v2`.
- Request/response remain `review-center-request-v1` and `review-center-v1`; item fields are
  backward compatible.
- Additive migration: `0012_review_center_hardening.sql`.
- The migration backfills one explicit active release per existing spoken/script track. Future
  activation is an explicit row change and validates that the selected release is published and
  track-compatible.

## Verification

- Contracts: 15 files, 80 tests passed.
- API: 14 files, 72 tests passed.
- Local PostgreSQL migration passed.
- Local PostgreSQL integration passed, including Review Center read-only behavior, RLS/cross-user
  denial, and a bounded due-query index plan.
- `corepack pnpm validate` passed: no-AI, portable-backend and V1 boundary checks; format; lint
  and typecheck for all eight packages; 96 test files with 500 tests; content validation; 12
  immutable migration checks; and all eight builds.
- Expo Web export passed with 23 static routes and a 2.3 MB bundle.

## Safety, compatibility, and rollback

- No answer keys, private ownership identifiers, or mastery values were added to the response.
- The API remains read-only and executes under the existing user transaction identity.
- No client-side planner, mobile UI, AI, recording, or learning-algorithm change was added.
- Application rollback may restore the prior Review Center service while leaving migration `0012`
  in place. Database migrations are forward-only; do not drop the activation table or indexes
  from an applied environment.
- Switching Curriculum releases does not rewrite historical Attempts, Evidence, Skill State, or
  schedules. Items not present in the active release remain retained but hidden until an explicit
  replacement/migration policy moves them.

## Remaining risks

- The integration fixture proves the selected index under a forced no-sequential-scan explain
  session; production planners may legitimately choose a sequential scan for very small tables.
- Physical mobile review UI and offline cache behavior remain Task 8.2B-R.
- Production Curriculum activation/import remains Task 8.3E.
