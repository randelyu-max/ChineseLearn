# Task 5.9P-C completion report

Date: 2026-07-24

Status: complete

Next allowed task: 8.2A-H

## Delivered

- Integrated all six Pinyin activity types into the existing formal Session Runner:
  `audio_to_pinyin`, `pinyin_to_audio`, `pinyin_to_glyph`, `glyph_to_pinyin`,
  `tone_choice`, and `pinyin_syllable_build`.
- Reused the shared immutable Activity Snapshot, local Attempt outbox, retry/recovery,
  server-authoritative scoring, Evidence, mastery, review, and Session completion flow. No
  Pinyin-only persistence or client-owned scoring path was added.
- Added pure adapters from the formal V2 contracts to the six existing Pinyin renderers. Answer
  submission uses immutable option or tile IDs, including accepted context readings, neutral tone
  5, and ordered initial/final/tone syllable assembly.
- Added local-only Pinyin audio resolution and prefetch caching keyed by Activity content hash.
  Unknown or network audio assets fail closed with a retryable message; the implementation does
  not request microphone access, record audio, or upload audio.
- Replaced the Pinyin tab's demo launcher with a formal-session entry showing current progress and
  the age-neutral actions `继续拼音学习` and `复习声调`.
- Advertised `pinyin-exercises-v1` from the mobile Session request only after the six formal
  renderers were available.
- Extended mixed-session, neutral-tone, context-reading, replay-count, hint, restart, offline
  audio, adapter, entry, and production-navigation tests.
- Corrected the isolated Attempt Evidence backfill test harness so it applies only migrations that
  precede migration `0010`, instead of incorrectly requiring `0010` to remain the latest migration.
  Runtime database logic and published migrations were not changed.

## Files

- Runner: `apps/mobile/src/features/session-runner/FormalSessionRunner.tsx`,
  `FormalPinyinActivityRenderer.tsx`, `model.ts`, and related tests/fixtures.
- Pinyin adapters/audio: `apps/mobile/src/features/session-runner/pinyin-adapters.ts`,
  `pinyin-audio.ts`, and their tests.
- Entry/navigation: `apps/mobile/src/features/session-runner/learn-entry.ts`,
  `pinyin-entry.ts`, `navigation.ts`, `apps/mobile/src/app/(tabs)/pinyin.tsx`, and tests.
- Existing renderers: the six Pinyin exercise components received only the common disabled-state
  integration required by the formal Runner.
- Database test harness: `apps/api/src/db/test-attempt-evidence-backfill.ts`.
- Status/design: `TASK_MANIFEST_POST_8_2A.yaml`, the implementation/design/remediation documents,
  the release-gate addendum, the task card, and this report.

## Versions, migrations, and compatibility

- Mobile Runner version: `formal-session-runner-v2`.
- Server scoring/BKT version remains `pinyin-scoring-v1`.
- Client capability remains `pinyin-exercises-v1`.
- Activity contracts, server materialization, Evidence, mastery, and Review Center contracts are
  unchanged from Task 5.9P-B.
- No dependency, lockfile, environment, CI, contract, learning-algorithm, or database migration
  change was required.
- Migrations `0001`-`0011` remain immutable. PostgreSQL 17 integration was exercised locally only;
  no remote database was reset or modified.

## Actual verification

- `corepack pnpm install --frozen-lockfile` — passed with pnpm 11.15.1.
- Mobile focused regression — 42 files, 195 tests passed.
- `corepack pnpm db:migrate` — passed against the local PostgreSQL 17 Docker container.
- `corepack pnpm db:test` — passed, including formal Session materialization, authoritative
  Attempts, normalized Evidence, replay/idempotency, offline concurrency, capability gating,
  lifecycle recovery, RLS, and cross-user denial.
- `corepack pnpm db:test:pinyin` — passed; 29 concepts, idempotent import, constraints, immutable
  publication, audio metadata, reading round trip, RLS publication filtering, and server
  capability were verified.
- `corepack pnpm db:test:attempt-backfill` — passed against a disposable local database after the
  stale migration-order test assumption was corrected; the exact disposable database was then
  dropped.
- `corepack pnpm validate` — passed: no-AI, portable-backend, V1 boundary, format, lint,
  typecheck, 96 test files with 498 tests, content validation, 11 immutable migration checks, and
  all eight package builds.
- Expo Web export inside the root build — passed with 23 static routes and a 2.3 MB web bundle.
- `git diff --check` — passed; Git emitted only configured LF-to-CRLF checkout notices.

The first sandboxed Expo export could not write an Expo log because of Windows `EPERM`; the same
build was rerun with repository write access and passed. The first backfill test exposed the stale
test-harness assumption described above; only the successful rerun is reported as passing.

## Safety, privacy, offline, and learning impact

- Correctness, Evidence, mastery, and review scheduling remain server authoritative.
- Pinyin attempts use the same local persistence and idempotent outbox as other formal activities;
  process restart resumes the immutable Session instead of generating replacement content.
- Replay count, support state, and response duration are preserved without adding answer content
  or private user data to telemetry.
- Audio is limited to an approved bundled registry and is cached by immutable content hash.
- The feature requests no microphone permission and performs no recording or audio upload.

## Rollback and remaining risks

- Revert the Task 5.9P-C mobile/docs commit to remove the capability advertisement and formal
  Pinyin UI. Existing immutable server records and migration `0011` require no rollback.
- The current approved bundled registry contains the exercised `ma2`, `ma3`, and `ma4` assets.
  Task 8.3E must bind every production Curriculum audio reference to a bundled/released asset;
  unknown assets intentionally fail closed.
- Physical-device process-death, airplane-mode audio playback, and signed native builds were not
  run in this Windows verification environment. Unit and Expo Web coverage do not replace that
  release-device matrix.
- Historical Pinyin mastery/review presentation remains owned by 8.2A-H and 8.2B-R. This task
  exposes the active formal Session progress and sends authoritative outcomes into the existing
  backend only.
- Production Curriculum import and publication remain owned by Task 8.3E.
