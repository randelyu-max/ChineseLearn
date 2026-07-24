# Task 5.9P-A completion report

Date: 2026-07-24

Status: complete

Next allowed task: 5.9P-B

## Delivered

- Added additive migration `0011_pinyin_persistence_domain.sql`.
- Added formal initial, final, tone, and syllable persistence with stable IDs, composition
  references, published-state filtering, strong constraints, and immutable published rows.
- Extended `concept_type` and `skill_type` for the Pinyin domain without enabling its runtime
  planner or Attempts capability.
- Added canonical and optional surface Pinyin to the word/sentence TypeScript and PostgreSQL
  reading contracts. No tone-sandhi value is generated automatically.
- Added three licensed `ma2`/`ma3`/`ma4` audio records with SHA-256, locale, source, and attribution.
- Added a transactional, idempotent approved-release importer independent of test seeds. It does
  not publish or displace the active Curriculum; Task 8.3E owns atomic release publication.
- Added unit and real PostgreSQL tests for normalization, invalid references, byte hashes,
  idempotency, RLS publication filtering, immutable publication, DB round trips, and the capability
  guard.

## Versions and compatibility

- Content input remains `pinyin-content-v1`; this task persists the accepted V1 semantics rather
  than claiming a new content contract.
- Formal curriculum version: `pinyin-1.0.0`.
- Database migration: `0011_pinyin_persistence_domain.sql`.
- Session materializer remains `pinyin-session-planner-v1+session-materializer-v2`.
- Existing `words.pinyin` remains in PostgreSQL for compatibility and is backfilled into
  `canonical_pinyin`. New TypeScript curriculum releases use `canonicalPinyin` and optional
  `surfacePinyin`.

## Commands and actual results

- `corepack pnpm install --lockfile-only` — passed; no package downloaded.
- Curriculum tests — 8 files, 31 tests passed.
- Content-validator tests — 4 files, 29 tests passed.
- API typecheck — passed.
- API tests — 14 files, 53 tests passed.
- Static migration validation — 11 immutable migrations passed.
- Fresh PostgreSQL 17 Alpine migration — passed in an isolated no-volume container.
- `corepack pnpm db:test:pinyin` — passed; 29 concepts, RLS, constraints, import idempotency,
  reading round trip, and capability guard verified.
- `corepack pnpm db:test` — passed; the full existing PostgreSQL integration regression passed.
- `corepack pnpm db:import:pinyin` twice — both passed with manifest
  `879fbd611bcb752c272f31da08d6736821383872a1cd24a0fcc5830cb9387430`; approved row count
  remained 29.

- Frozen-lockfile install — passed.
- Full root `validate` — passed: no-AI, portable backend, V1 boundary, format, lint, typecheck,
  92 test files / 466 tests, content validation, 11-migration static validation, and all eight
  package builds.
- Expo web export — passed with 23 static routes.
- `git diff --check` — passed (Git emitted only configured LF-to-CRLF checkout notices).

## Safety, privacy, offline, and learning impact

- This task adds public curriculum content only and no new user-private data.
- The application role cannot write Pinyin curriculum and cannot read unpublished rows.
- No remote database was contacted or reset.
- Audio is bundled and verified locally, so the persisted domain has no online media dependency.
- Planner and Attempts Pinyin capabilities remain explicitly disabled; learning state cannot be
  changed by the new content before 5.9P-B.

## Rollback and risks

- Before deployment, omit the new migration and importer changes.
- After deployment, do not edit or delete migration `0011`; stop invoking the importer and ship a
  reviewed forward migration if schema correction is required.
- Published rows are intentionally immutable. Content corrections require a new curriculum version
  and manifest.
- The import currently formalizes a deliberately small seed set. Curriculum expansion and the
  general release pipeline remain Task 8.3E.
- Server Pinyin scoring/Evidence and the universal mobile Pinyin runner are intentionally absent.
  The next unique task is 5.9P-B.
