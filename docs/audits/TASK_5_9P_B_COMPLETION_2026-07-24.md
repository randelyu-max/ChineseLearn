# Task 5.9P-B completion report

Date: 2026-07-24

Status: complete

Next allowed task: 5.9P-C

## Delivered

- Enabled authoritative server scoring for `audio_to_pinyin`, `pinyin_to_audio`,
  `pinyin_to_glyph`, `glyph_to_pinyin`, `tone_choice`, and `pinyin_syllable_build`.
- Added strict `pinyin-lesson-exercise-v1` published-material validation. It binds an immutable
  `learning-exercise-v2` payload to explicit Evidence targets, a Pinyin skill type, duration, and
  the `pinyin-exercises-v1` minimum client capability.
- Added server planning from published Pinyin concepts and Lesson declarations. Pinyin-only review
  pools receive a deterministic high-success closing candidate, preserving the Session planner's
  confidence-closing invariant.
- Added optional Session Plan V2 client capabilities. Server planning/Attempts capability is open,
  but a client without `pinyin-exercises-v1` receives only the four existing Hanzi exercise types.
- Added context-specific polyphonic scoring, explicit neutral tone 5 scoring, ordered three-part
  syllable assembly, and accepted-reading scoring for glyph-to-Pinyin.
- Added normalized multi-target Evidence for Pinyin. Pinyin/tone targets keep support multiplier
  1.0; Hanzi-dependent targets retain the versioned none/visible/revealed/full-answer weighting.
  `pinyin_to_glyph` treats its Hanzi target as Pinyin-visible transfer Evidence even when the
  submitted support state is `none`.
- Added versioned BKT parameter rows and deterministic replay for all six types.
- Added real published Pinyin concepts to Review Center resolution, including stable `pinyin` and
  `tone` groups, due reasons, labels, activity types, and dedupe keys.
- Strengthened PostgreSQL integration to persist a neutral-tone Attempt through immutable Session
  materialization, normalized Evidence, Skill State, Review Schedule, batch replay, and duplicate
  delivery.

## Files

- Contracts: `packages/contracts/src/pinyin-session-material.ts`,
  `packages/contracts/src/pinyin-session-material.test.ts`,
  `packages/contracts/src/session-plan-v2.ts`,
  `packages/contracts/src/session-plan-v2.test.ts`, and the package export.
- Learning engine: `packages/learning-engine/src/bkt.ts` and `bkt.test.ts`.
- API runtime: `apps/api/src/attempt-processing-v2.ts`,
  `apps/api/src/attempt-processing.ts`, `apps/api/src/session-plan-v2-service.ts`, and
  `apps/api/src/review-center-service.ts`.
- API tests: the corresponding Attempt/Session unit tests plus
  `apps/api/src/db/test-database.ts` and `test-pinyin-domain.ts`.
- Status/design: `README.md`, `TASK_MANIFEST_POST_8_2A.yaml`,
  `docs/CODEX_IMPLEMENTATION_PLAN.md`, the Post-8.2A design/remediation addenda, and this report.

## Versions and database compatibility

- Scoring/BKT version: `pinyin-scoring-v1`.
- Formal lesson source: `pinyin-lesson-exercise-v1`.
- Client capability: `pinyin-exercises-v1`.
- Session materializer remains `pinyin-session-planner-v1+session-materializer-v2`.
- Evidence remains `exercise-quality-v1+pinyin-evidence-v1`, with Pinyin attempts recording the
  additive `pinyin-scoring-v1` suffix.
- No dependency, lockfile, environment, CI, or database migration change was required.
- Existing additive migration `0011_pinyin_persistence_domain.sql` already supplies the required
  enums, Pinyin concepts, RLS, and publication constraints. Migrations `0001`-`0011` were not
  rewritten.

## Actual verification

- `corepack pnpm install --frozen-lockfile` — passed with pnpm 11.15.1.
- Contracts — 15 files, 80 tests passed.
- Learning engine — 10 files, 87 tests passed.
- API focused suite — 14 files, 70 tests passed.
- `corepack pnpm db:migrate` — passed against the local PostgreSQL 17 container.
- `corepack pnpm db:test:pinyin` — passed; 29 concepts, idempotent import, constraints, immutable
  publication, audio metadata, reading round trip, RLS filter, and server capability verified.
- `corepack pnpm db:test` — passed; includes Pinyin-only review planning, neutral-tone authoritative
  scoring, normalized Evidence, BKT/Review persistence, replay/duplicate behavior, generic offline
  concurrency, old-client gating, real tone grouping, RLS, and the full existing database
  regression.
- `corepack pnpm validate` — passed: no-AI, portable backend, release boundary, format, 8-package
  lint/typecheck, 93 test files with 486 tests, content validation, 11 immutable migration checks,
  and all eight package builds.
- Expo web export inside the root build — passed with 23 static routes.
- `git diff --check` — passed; Git emitted only configured LF-to-CRLF checkout notices.

The first sandboxed root validation attempt could not write Turbo cache logs and exited during
lint. The same command was rerun with repository write access and completed successfully. No test
result from the failed invocation is reported as a pass.

## Safety, privacy, offline, and learning impact

- Scoring uses only immutable Activity Snapshots; client correctness remains ignored.
- No answer, content, or user-private data is added to telemetry or logs.
- Pinyin curriculum remains read-only for the runtime role, and private Skill/Review data remains
  behind existing forced RLS.
- Offline idempotency and immutable Attempt IDs use the existing V2 path; Pinyin does not add a
  parallel queue or client-owned mastery calculation.
- The mobile client is unchanged and does not advertise Pinyin Runner support, so deployed old
  clients cannot receive unknown Activity types.

## Rollback and remaining risks

- Before deployment, revert the Task 5.9P-B application/docs changes; no schema rollback is needed.
- After deployment, stop accepting `pinyin-exercises-v1` and disable Pinyin candidates while
  retaining immutable Attempts, Evidence, Skill State, and Review records for audit/replay.
- Do not delete or rewrite migration `0011`; published Pinyin corrections require a new Curriculum
  version.
- Mobile formal rendering remains intentionally absent. Task 5.9P-C must implement all six Runner
  renderers, capability opt-in, accessibility, audio behavior, offline recovery, and native-device
  tests before users can receive these activities.
- The formal production Curriculum release remains owned by Task 8.3E; this task proves the
  runtime against valid published fixtures but does not publish a production course.
