# HanziQuest V1 release checklist

Candidate: `1.0.0` (`iOS build 1`, `Android versionCode 1`)

Audit date: 2026-07-23

Review API checkpoint: 2026-07-24 (Task 8.2A complete; 8.2B and 9.5R pending)

Overall decision: **NOT READY FOR PROMOTION**

This report records only checks that were actually run. The candidate must not be promoted while
any release blocker below remains open.

## Release blockers

| Gate                     | Result                   | Evidence / required action                                                                                                                                                                                            |
| ------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review experience        | **BLOCKED**              | Task 8.2A now provides the authenticated read-only `GET /api/review-center` contract/API. The Review tab still renders `复习计划将在后续任务中实现。`; complete Task 8.2B, then rerun this entire audit as Task 9.5R. |
| Native signed builds     | **PENDING**              | Android and iOS JavaScript exports pass, but signed builds and physical-device checks require Apple/Google credentials and real devices.                                                                              |
| Operator support channel | **PENDING**              | A private contact for account access/deletion requests must be published before public store promotion.                                                                                                               |
| Store identifiers        | **PENDING CONFIRMATION** | Confirm ownership of `com.hanziquest.app` before creating irreversible store records.                                                                                                                                 |

## Automated gates

| Gate                      | Result | Actual result                                                                          |
| ------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Frozen dependency install | PASS   | pnpm 11.15.1 reported the lockfile up to date.                                         |
| Format                    | PASS   | Prettier checked the repository with no differences.                                   |
| Lint                      | PASS   | 8/8 workspace packages passed.                                                         |
| Typecheck                 | PASS   | 8/8 workspace packages passed.                                                         |
| Unit/integration tests    | PASS   | 75 test files, 382 tests passed.                                                       |
| Content validation        | PASS   | Curriculum, approved Pinyin, and approved humor packages passed.                       |
| Static migrations         | PASS   | 6 immutable PostgreSQL migrations passed validation.                                   |
| Build                     | PASS   | 8/8 workspace packages built; Expo rendered 22 static Web routes.                      |
| Android JS export         | PASS   | Expo export completed; Hermes bundle was 4.4 MB.                                       |
| iOS JS export             | PASS   | Expo export completed; Hermes bundle was 4.1 MB.                                       |
| Diff whitespace           | PASS   | `git diff --check` completed without whitespace errors after the documentation update. |

The Web export produced a 2.2 MB uncompressed entry bundle, within the documented 3 MiB V1
budget. JavaScript export success is not a native signing or physical-device result.

## Task 8.2A checkpoint

This is implementation evidence, not the Task 9.5R release decision:

- `review-center-request-v1`, `review-center-v1`, and `review-center-cursor-v1` contracts passed.
- Full repository validation passed: format; 8/8 lint; 8/8 typecheck; 78 test files and 396 tests;
  curriculum/content, forbidden-domain, secret, raw-writing, portable-backend, and six immutable
  migration checks; and 8/8 builds.
- An isolated no-volume PostgreSQL 17 database applied all six migrations and passed planning,
  attempts, concurrency, idempotency, immutability, Review Center publication filtering,
  read-without-write checks, and cross-user forced-RLS denial.
- The existing `review_schedule_user_due_idx (user_id, due_at)` was verified. Task 8.2A adds no
  table, field, index, migration, or remote database operation.
- The current session-plan contract does not support review intent. This is an explicit Task 8.2B
  start checkpoint, not permission to implement a second planner.

## Security, privacy, and data

| Gate                               | Result | Actual result                                                                                                                                                                   |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 forbidden-domain scan           | PASS   | Runtime scan found no Parent/Child/Household structure or legacy audience-specific meaning fields in executable/data code.                                                      |
| Generative runtime scan            | PASS   | Apps, packages, and database contain no generative-provider runtime surface.                                                                                                    |
| Secret scan                        | PASS   | 332 tracked/untracked candidate files were checked; no high-confidence private key, cloud, GitHub, or provider key was found. Only `.env.example` is allowed to be tracked.     |
| Raw writing boundary               | PASS   | API/contracts/migrations contain no raw stroke points or images; mobile persistence and tests keep raw trajectories local.                                                      |
| RLS audit                          | PASS   | All 10 private business tables have RLS enabled and forced, each with one narrow user policy. Public curriculum and Better Auth infrastructure are not private business tables. |
| Cross-user database test           | PASS   | Planning, attempts, concurrency, idempotency, immutability, cascade deletion, and cross-user denial passed against PostgreSQL 17.                                               |
| Migration backup/restore rehearsal | PASS   | All 6 migrations were applied in an isolated no-volume PostgreSQL 17 container, backed up, restored into a second database, and the dynamic database suite passed again.        |

Backup rehearsal artifact:

- Operator-side file (outside the Git repository):
  `release-backups/hanziquest-v1-release-2026-07-23.dump`
- SHA-256: `6B47DF3531EB4C3C32DAE1EE23911A94B4DD22618E77A3EE2413E0F2EDB03E19`
- Scope: disposable local release-rehearsal data only; it is not a production backup.

No remote database was reset or modified.

## Browser and accessibility smoke

The browser smoke used the isolated local API on port 3101, isolated PostgreSQL on port 55432, and
Expo Web on port 8181.

| Flow                                              | Result                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Registration → onboarding                         | PASS                                                               |
| Required profile fields and optional Chinese name | PASS                                                               |
| Existing-session restoration after reload         | PASS                                                               |
| Profile/humor preference save                     | PASS                                                               |
| Logout                                            | PASS                                                               |
| Password-recovery request acknowledgement         | PASS                                                               |
| Pinyin tab and six exercise entry points          | PASS                                                               |
| Own-name writing/local-trajectory disclosure      | PASS                                                               |
| Review tab                                        | **BLOCKED — placeholder only**                                     |
| Browser console                                   | PASS — no error entries                                            |
| Radio selected-state semantics                    | PASS — 10 source gates and live `aria-checked="true"` verification |
| 390×844 layout                                    | PASS — browser visual smoke                                        |
| 1024×768 layout                                   | PASS — browser visual smoke                                        |

The existing offline recovery, persistent outbox, batching, and synchronization suites passed as
part of the 152 mobile tests. This is not a substitute for a physical-device airplane-mode run,
which remains part of native device validation.

Local development timing smoke over five requests:

- API `/health`: median 13.2 ms, range 9.9–90.8 ms.
- Expo development page response: median 367.1 ms, range 333.0–1848.1 ms.

These local development timings are diagnostic only and are not a production load benchmark.

## Editorial approval

The bundled `humor-content-v1` `1.0.0` package is approved for publication:

- Reviewer: 于永
- Decision: approved for release
- Basis: every item was manually edited and finalized as human-editorial copy
- Recorded package review time: `2026-07-23T20:55:17.680Z`

Any later text, target, answer, or fallback change requires a new content version and renewed human
review.

## Promotion and rollback decision

Do not promote this candidate. Complete Task 8.2B, rerun this entire checklist as Task 9.5R,
produce signed native builds, complete the physical-device matrix, publish the private support
channel, and confirm the store identifiers.

Rollback for the current unpromoted candidate is to leave the prior deployment/build active and
discard the candidate. Database migrations remain forward-only; use the verified snapshot/restore
procedure or a reviewed corrective migration after deployment.
