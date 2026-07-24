# Task 8.3E completion report

Date: 2026-07-24

Status: complete

Next allowed task: 8.3C

## Delivered

- Added the immutable `production-curriculum-release-v1` starter package, version directory,
  coverage report, editorial checklist, media authorization list, and previous-version mapping.
- Added `production-release-import-v1`, which validates, hashes, stages, publishes, and explicitly
  activates the release in one transaction.
- Added migration `0014_production_curriculum_releases.sql` with immutable publication receipts and
  published content protections.
- Changed V1 and V2 Session planning to select the explicit active spoken/script track instead of
  the latest publication timestamp.
- Added empty-database release rehearsal covering repeat import, hash mismatch, missing review,
  unauthorized media, active pointer, Learn and Review Session smoke, old Session pinning, and
  published-row immutability.

## Versions and compatibility

- Release contract: `production-curriculum-release-v1`.
- Import algorithm: `production-release-import-v1`.
- Curriculum version: `1.0.0`.
- Migration: forward-only `0014_production_curriculum_releases.sql`.
- Manifest:
  `57f6b18a90abc91799a74f9c8bf232586521709edf4587fd8151587a1a25dc81`.

Published versions remain in place. Rollback moves the explicit active pointer to a previously
published compatible version; existing Sessions remain pinned. Never edit an applied migration or
published release row.

## Verification

- Content Validator focused suite: 5 files, 32 tests passed.
- API focused suite: 15 files, 78 tests passed.
- API, Curriculum, and Content Validator typechecks passed after the final fixes.
- PostgreSQL static validation passed for 14 migrations.
- Disposable fresh-PostgreSQL rehearsal passed all release-import and Session smoke assertions.
- Migration `0014` applied to the existing local development database, after which the full
  PostgreSQL integration/RLS regression passed.
- Final full validation exited with code 0: 101 test files and 523 tests passed across all eight
  workspaces. Content validation, all builds, and Expo Web export passed; Expo generated 24 static
  routes and a 2.3 MB JavaScript bundle.

Two intermediate rehearsal runs failed truthfully: first on the existing Pinyin concept-code
constraint and then on the required canonical word-Pinyin column. Both import mappings were fixed;
the final clean-database rehearsal passed and deleted its random temporary database.

## Security, privacy, offline, and learning impact

- Runtime clients receive no database or publication credentials.
- The package contains no raw voice or writing data. Hanzi prompts use device TTS; reviewed Pinyin
  media keeps license and hash evidence.
- Immutable Session snapshots keep downloaded/offline work pinned across later active-version
  changes.
- The planner uses only reviewed, hashed, explicitly active content and continues to re-score
  answers server-side.

## Remaining risk

The starter release contains 6 Hanzi, 4 words, 3 sentence patterns, and 1 short story. This is below
the Public V1 editorial target of 100/200/30/10 and remains a release blocker. Task 8.3C must publish
a new immutable version for its 13+ themes and static humor; it must not edit version 1.0.0.
