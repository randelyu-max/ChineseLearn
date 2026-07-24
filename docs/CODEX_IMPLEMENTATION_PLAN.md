# HanziQuest V1 Codex implementation plan

Status: Task 8.2A restored only the Review Center read model/API. The old direct Task 8.2B to
Task 9.5R sequence is **SUPERSEDED** by
[`docs/addenda/CODEX_REMEDIATION_PLAN_POST_8_2A.md`](addenda/CODEX_REMEDIATION_PLAN_POST_8_2A.md)
and `TASK_MANIFEST_POST_8_2A.yaml`. The current stage is Closed Alpha, not a public V1 release
candidate. Task 8.3D is complete; the next dependency-scoped task is 8.3E.
Execute one task at a time; stop after its acceptance checks and review.

## Superseded work

The original family RLS, parent authentication, consent/child profile, parent gate, parent
dashboard/report, Child Profile, Household, Parent/Guardian roles, AI story/prompt/moderation,
AI parent report, AI speech, Premium AI, and AI entitlement tasks are **SUPERSEDED** and must not
be resumed. Original Task 3.5 is **SUPERSEDED by Task 3.5R**.

Task 3.1 BKT, 3.2 memory stability, 3.3 confusion risk, and 3.4 session planning remain accepted
age-neutral learning algorithms. Their persistence adapters are not accepted because the current
database still uses `child_id`.

The historical cards and results through Task 8.2A remain accepted evidence. Their old continuation
`8.2B → 9.5R` must not be executed directly. Continue with the independently accepted Post-8.2A
cards beginning at Task 8.2C-A.

## Required order

P0 (complete) → P1 (complete) → 2.2R (complete) → 2.3R (complete) → 2.4R (complete) → 3.5R (complete) → 3.6R (complete) →
5.1P (complete) → 3.7R (complete) → 4.1R (complete) → 4.2R (complete) → 4.3R (complete) → 5.2P–5.8P → 6.1W–6.4W → 7.1H–7.3H → 8.2A (complete).

Post-8.2A order:

`8.2C-A → 8.2C-B → 8.2C-C → 8.2C-D → 8.2D-A → 8.2D-B → 5.9P-A → 5.9P-B → 5.9P-C → 8.2A-H → 8.2B-R → 8.3D → 8.3E → 8.3C → 6.5W → 8.3A → 8.3B → 8.3T → 9.5R`

## Task cards

### P0 — Product pivot audit and documentation baseline

- **目标：** Freeze Task 3.4, audit old domains, and establish this V1 design/ADR/plan.
- **非目标：** No runtime, route, database, Pinyin UI, canvas, or AI cleanup.
- **依赖：** Verified Task 3.4 checkpoint.
- **文件范围：** `AGENTS.md`, `docs/**`, canonical-plan pointers only.
- **数据变化：** None.
- **安全和隐私：** Document cross-user isolation and local raw strokes.
- **测试要求：** Format, lint, typecheck, learning-engine/content-validator tests, diff check.
- **验收标准：** Audit A–D, new ADR/design/plan, P1 checklist, real command results.
- **回滚方式：** Revert the P0 documentation commit; Task 3.4 checkpoint remains.

### P1 — Remove V1 AI code and configuration

- **状态：** Complete on 2026-07-23; do not extend this card into 2.2R.
- **目标：** Execute every item in `docs/audits/P0_V1_PIVOT_AUDIT.md`.
- **非目标：** No single-user schema or future AI implementation.
- **依赖：** P0.
- **文件范围：** AI contracts, backend config/schema planning, tests, lockfile if needed.
- **数据变化：** Remove AI-only types/tables from the proposed clean V1 baseline; document deployed-history choice.
- **安全和隐私：** No provider secrets, prompts, payloads, moderation, flags, usage, quota, or entitlement.
- **测试要求：** Repository forbidden-term check plus full validation.
- **验收标准：** Runtime/config contains no V1 AI surface; only future backlog note remains.
- **回滚方式：** Revert P1 commit; do not restore provider secrets.

### 2.2R — Single-user database model and RLS

- **状态：** Implemented on 2026-07-23 with a guarded forward migration.
- **目标：** Build one-to-one profiles and `user_id` private tables.
- **非目标：** No Household/Child migration compatibility layer.
- **依赖：** P1 and explicit clean-baseline/data-mapping decision.
- **文件范围：** `database/migrations`, database tests, schema documentation.
- **数据变化：** Profiles, sessions, attempts, skill/review/confusion, signature metadata/summary.
- **安全和隐私：** Default-deny RLS; raw strokes/images absent; cross-user denial.
- **测试要求：** Reset, constraints, grants, RLS denial, indexes, rollback rehearsal.
- **验收标准：** Every private row is isolated by the authenticated API user; forbidden IDs absent.
- **回滚方式：** Restore pre-2.2R database snapshot or revert clean baseline before data import.

### 2.3R — Single-user authentication and session

- **状态：** Implemented on 2026-07-23; do not begin 3.5R.
- **目标：** Rename and retain generic login/logout/recovery/secure session behavior.
- **非目标：** No profile onboarding, roles, learner switching, or parent gate.
- **依赖：** 2.2R.
- **文件范围：** Mobile auth feature/routes, Better Auth Expo client, tests.
- **数据变化：** Read only the authenticated user's profile.
- **安全和隐私：** SecureStore tokens; safe redirects; no token logging.
- **测试要求：** Login, logout, recovery, callback, restore, expiry, unauthenticated denial.
- **验收标准：** Neutral AuthProvider works without Parent/Child concepts.
- **回滚方式：** Revert rename atomically with route imports.

### 2.4R — Profile, first-run setup, and main navigation

- **状态：** Implemented on 2026-07-23; do not begin 3.5R.
- **目标：** Create one profile and Learning/Pinyin/Writing/Review/Me navigation.
- **非目标：** No diagnostic implementation or signature canvas.
- **依赖：** 2.3R.
- **文件范围：** Profile feature, onboarding routes, navigation, copy, tests.
- **数据变化：** Approved profile fields only.
- **安全和隐私：** Chinese name optional; no real-name or household collection.
- **测试要求：** Create/resume/update profile, duplicate prevention, accessibility, navigation.
- **验收标准：** One auth user cannot create or switch multiple profiles.
- **回滚方式：** Revert UI/profile RPC together; preserve auth session.

### 3.1–3.4 — Retained learning-engine baseline

- **目标：** Preserve BKT, memory, confusion, and deterministic session planning.
- **非目标：** No child-specific persistence adapter.
- **依赖：** Existing checkpoint `96d2df9`.
- **文件范围：** `packages/learning-engine`.
- **数据变化：** None; pure functions.
- **安全和隐私：** No network/database/AI/PII.
- **测试要求：** Existing unit/invariant/seed tests remain green.
- **验收标准：** Algorithm versions and documented invariants remain stable.
- **回滚方式：** Revert only a versioned algorithm change and its tests.

### 3.5R — Pinyin and Hanzi multidimensional diagnostic

- **状态：** Implemented on 2026-07-23 as `diagnostic-v1`; do not begin 3.6R.
- **目标：** Estimate spoken audio, Pinyin recognition, tone discrimination, Hanzi recognition,
  word reading, and sentence reading with confidence.
- **非目标：** No signature assessment, network, AI, or negative user label.
- **依赖：** 3.1–3.4 and Pinyin domain draft.
- **文件范围：** Learning-engine diagnostic module, fixtures, tests.
- **数据变化：** Pure result contract only; persistence later.
- **安全和隐私：** Audio-first, no English dependency or personal data.
- **测试要求：** Five user fixtures, consecutive-error stop, item/time cap, fixed seed.
- **验收标准：** Reasonable per-axis starts/confidence for all fixtures; reproducible output.
- **回滚方式：** Remove diagnostic export/module without changing retained algorithms.

### 3.6R — Pinyin-support evidence weighting

- **状态：** Implemented on 2026-07-23 as `pinyin-evidence-v1`.
- **目标：** Reduce independent Hanzi evidence after Pinyin hints deterministically.
- **非目标：** Do not mark a correct answer incorrect.
- **依赖：** 3.5R.
- **文件范围：** Learning quality/evidence module and tests.
- **数据变化：** Add support/evidence metadata contract.
- **安全和隐私：** Pure local calculation.
- **测试要求：** Hint levels, bounds, mastery invariants, no-hint compatibility.
- **验收标准：** Pinyin-hinted correct evidence is strictly lower than unhinted evidence.
- **回滚方式：** Revert versioned weighting and metadata together.

### 3.7R — Integrate Pinyin into session planning

- **状态：** Implemented on 2026-07-23 as `session-planner-v2` and
  `pinyin-session-planner-v1`.
- **目标：** Add Pinyin review/new/transfer candidates and adaptive support fading.
- **非目标：** No UI or database function.
- **依赖：** 3.6R and 5.1P schema contract.
- **文件范围：** Session planner adapters/tests.
- **数据变化：** None.
- **安全和隐私：** Deterministic seed and prerequisite protection.
- **测试要求：** Ratio, due priority, fade, frustration guards, reproducibility.
- **验收标准：** Pinyin and Hanzi plans obey Task 3.4 invariants.
- **回滚方式：** Remove Pinyin adapter; retain core planner.

### 4.1R — Single-user `session-plan`

- **状态：** Implemented on 2026-07-23; do not begin 4.2R in the same task.
- **目标：** Authorize user, call planner, persist immutable idempotent plan.
- **非目标：** No attempt mutation or AI.
- **依赖：** 2.2R, 3.7R.
- **文件范围：** Node API route, contracts, integration tests.
- **数据变化：** Insert `learning_sessions.user_id`.
- **安全和隐私：** Derive user from JWT; ignore client ownership fields.
- **测试要求：** Auth denial, invalid input, duplicate client ID, retry, RLS.
- **验收标准：** Same idempotency key returns same snapshot.
- **回滚方式：** Undeploy API route and revert additive migration.

### 4.2R — Local cache and Outbox

- **状态：** Implemented on 2026-07-23; 4.3R is separately scoped.
- **目标：** Persist content, active session, attempts, and sync queue offline.
- **非目标：** No server attempt processing.
- **依赖：** 4.1R.
- **文件范围：** Mobile storage/outbox adapters and recovery UI.
- **数据变化：** Local-only versioned tables; no raw signature trajectory here.
- **安全和隐私：** Minimize cached profile data and redact logs.
- **测试要求：** Restart recovery, duplicate queue, corruption, migration, offline UX.
- **验收标准：** Process death does not lose completed attempts.
- **回滚方式：** Local schema migration with export/clear fallback.

### 4.3R — Single-user `attempts-batch`

- **状态：** Implemented on 2026-07-23; 5.2P is separately scoped.
- **目标：** Validate answers and apply idempotent authoritative learning updates.
- **非目标：** No client mastery writes or rewards redesign.
- **依赖：** 4.2R, 3.6R.
- **文件范围：** Contracts, Node API route, transaction/RLS tests.
- **数据变化：** Attempts, skill states, reviews, confusion keyed by user.
- **安全和隐私：** JWT-derived user; server answer check; bounded batch.
- **测试要求：** Duplicate, out-of-order, concurrency, invalid answer, cross-user denial.
- **验收标准：** One event changes state at most once.
- **回滚方式：** Stop function; immutable attempts support replay with prior algorithm.

## Pinyin task series

Each Pinyin task uses static reviewed content, no AI/network at exercise time, age-neutral copy,
and focused unit/accessibility tests. Rollback removes the task's additive schema/export/UI while
preserving previous Pinyin tasks.

| Task            | 目标                                                         | 非目标                     | 依赖                | 文件范围                       | 数据变化                 | 测试要求与验收                                                                                                                           |
| --------------- | ------------------------------------------------------------ | -------------------------- | ------------------- | ------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1P (complete) | Pinyin initials/finals/syllables/tones domain and validation | No UI                      | 3.5R contract       | curriculum/contracts/validator | `pinyin-content-v1` only | Implemented 2026-07-23: legal/illegal combinations, deterministic tone normalization, five-tone table, references, and approved fixture  |
| 5.2P (complete) | `audio_to_pinyin`                                            | No speech upload           | 5.1P                | mobile feature/tests           | Attempts only later      | Implemented 2026-07-23: deterministic tone distractors, bundled/replayable MP3, supportive retry, responsive and screen-reader semantics |
| 5.3P (complete) | `pinyin_to_audio`                                            | No pronunciation scoring   | 5.2P                | mobile feature/tests           | None                     | Implemented 2026-07-23: module-scope preload, per-clip replay/error recovery, bundled assets, stable correct clip, accessible controls   |
| 5.4P (complete) | `pinyin_to_glyph`                                            | No translation dependency  | 5.1P                | mobile feature/tests           | None                     | Implemented 2026-07-23: tone-aware distractors, required homophone context, stable target mapping, accessible responsive glyph choices   |
| 5.5P (complete) | `glyph_to_pinyin`                                            | No always-on ruby text     | 5.1P                | mobile feature/tests           | None                     | Implemented 2026-07-23: explicit accepted readings, required polyphone context, priority alternate reading, on-demand supportive hints   |
| 5.6P (complete) | `tone_choice`                                                | No dialect judgment        | 5.1P                | mobile feature/tests           | None                     | Implemented 2026-07-23: deterministic five-tone table, neutral-tone target, stable mapping, accessible choices, supportive retry         |
| 5.7P (complete) | `pinyin_syllable_build`                                      | No free text IME           | 5.1P                | mobile feature/tests           | None                     | Implemented 2026-07-23: ordered tap controls, legal initial/final filtering, canonical tone marks, reset/retry, accessible completion    |
| 5.8P (complete) | Adaptive Pinyin display and fading                           | No hidden global heuristic | 3.6R, prior P tasks | engine/mobile/tests            | Support preference/state | Implemented 2026-07-23: versioned staged fade, immediate recovery, one-activity interruption, profile preference, UI/evidence agreement  |

## Writing task series

All writing tasks operate only on the user's own Chinese name, normalize coordinates, keep raw
strokes local by default, never authenticate/verify identity, never imitate a real person, and
never call AI. Each task needs unit, local persistence, accessibility, and privacy assertions.

| Task            | 目标                                                | 非目标                                   | 依赖       | 文件范围                 | 数据变化                           | 测试要求与验收                                                                                                                                                       | 回滚                              |
| --------------- | --------------------------------------------------- | ---------------------------------------- | ---------- | ------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 6.1W (complete) | Vector canvas and normalized `StrokePoint`/`Stroke` | No scoring/upload                        | 2.4R       | mobile writing/storage   | Local strokes                      | Implemented 2026-07-23: normalized trace, resize-safe SVG, undo/clear/replay, per-user Web/SQLite local drafts, bounded dense input                                  | Remove route/local table          |
| 6.2W (complete) | Standard stroke order, tracing to free writing      | No signature style                       | 6.1W       | curriculum/mobile        | Static stroke assets               | Implemented 2026-07-23: licensed offline 王家豪 fixture, ordered start/direction guide, observe/trace/free modes, unsupported fallback                               | Remove lesson layer/assets        |
| 6.3W (complete) | Deterministic clear/compact/leaning/flowing styles  | No AI or celebrity imitation             | 6.2W       | pure transform module/UI | Selected style metadata            | Implemented 2026-07-23: versioned pure transforms, reproducible bounded output, preserved stroke/timing order, own-name-only preview                                 | Remove transforms/style field     |
| 6.4W (complete) | Local save and self-consistency feedback            | No forensic verification/cloud raw trace | 6.3W, 2.2R | local store/summary API  | Server metadata/count/summary only | Implemented 2026-07-23: local rolling baseline and persistent raw-free outbox, deterministic supportive feedback, idempotent RLS metadata API, trigger-owned summary | Disable sync, retain local export |

## Humor task series

Humor is static editorial curriculum with `off | light | playful` preference (`light` default),
neutral fallback, no AI/network, no humiliation, identity stereotypes, false etymology, or changed
answers.

| Task            | 目标                                              | 非目标                           | 依赖       | 文件范围             | 数据变化                           | 测试要求与验收                                                                                                                                                                                                                                   | 回滚                          |
| --------------- | ------------------------------------------------- | -------------------------------- | ---------- | -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 7.1H (complete) | Humor schema and validator for six approved types | No content generation            | 5.1P       | curriculum/validator | Content metadata                   | Implemented 2026-07-23: versioned bundled human-editorial schema, six types, exact target/answer and neutral fallback checks, release review and deterministic safety gates                                                                      | Remove additive fields/rules  |
| 7.2H (complete) | Profile humor preference                          | No personalization profiling     | 7.1H, 2.4R | profile/mobile       | Existing `humor_preference`        | Implemented 2026-07-23: existing `light` default and strict update endpoint retained; age-neutral mobile control added; pure bundled selector is deterministic offline, fails closed when unavailable, and maps `off` to neutral unconditionally | Default to off/remove control |
| 7.3H (complete) | Human-authored reviewed humor content             | No runtime rewrite or generation | 7.2H       | curriculum/assets    | `humor-content-v1` version `1.0.0` | Implemented 2026-07-23: six published bundled items approved by 于永, stable IDs, simplified/traditional targets and answers, exact neutral fallbacks, release validation in local command and CI                                                | Unpublish humor variants      |

### 8.0 — Historical incomplete release audit

- **目标：** Validate complete single-user V1 for release.
- **非目标：** No new features, AI, payment, or speculative architecture.
- **依赖：** All accepted tasks above.
- **文件范围：** Entire repository, release docs, CI, store metadata.
- **数据变化：** Release migration rehearsal and backups only.
- **安全和隐私：** Forbidden-domain scan, RLS audit, local-stroke audit, secret scan.
- **测试要求：** Full unit/integration/E2E, offline stress, performance, accessibility, privacy,
  content, migration/rollback, supported devices.
- **验收标准：** No Parent/Child/Household/AI runtime surface; all release gates documented green.

Audit note (2026-07-23): dependency, format, lint, type, 382-test, content, migration, RLS,
backup/restore, Web build, Android/iOS JavaScript export, browser, privacy, secret, and forbidden
runtime checks were run. The Review tab still displays a later-task placeholder and has no
authenticated read API, so the release decision remained red. This historical audit does not own
Review Center implementation. See `docs/release/V1_RELEASE_CHECKLIST.md`; Task 9.5R supersedes this
incomplete audit after 8.2A and 8.2B are accepted.

- **回滚方式：** Do not promote candidate; restore previous deployment/database snapshot.

### 8.2A — Review Center read model and API

- **状态：** Complete on 2026-07-24; stop before 8.2B.
- **目标：** Return a bounded, versioned, read-only due-review summary for the authenticated user.
- **非目标：** No mobile screen, review-session creation, mastery calculation, schedule mutation,
  AI, or new learning algorithm.
- **依赖：** 3.1–3.7, 4.1R–4.4R, 7.3H.
- **文件范围：** Shared contracts, Hono API route/read service, PostgreSQL/RLS integration tests,
  and canonical documentation.
- **数据变化：** None. Reuse `review_schedule`, `skill_states`, `confusion_stats`, `attempts`, and
  published curriculum. The existing `(user_id, due_at)` index is sufficient.
- **安全和隐私：** Session-derived identity, forced RLS, no client `user_id`, answers, internal
  weights, mastery values, unpublished content, or cross-user data in the response.
- **测试要求：** Contract/service/route tests, live PostgreSQL cross-user and read-only checks,
  Task 3.x/4.x regression, forbidden-domain checks, and `git diff --check`.
- **验收标准：** `GET /api/review-center` returns `review-center-v1`, stable grouping and cursor
  pagination without writing learning state.
- **实际验证：** Contract/API suites, 396-test full regression, 8-package build, static migration
  validation, and isolated PostgreSQL 17 migration/RLS/read-only integration passed. The existing
  `(user_id, due_at)` index was verified; no migration was added.
- **回滚方式：** Remove the route/service/contract and documentation additions; no database
  rollback is required.

### 8.2C-B — Session lifecycle and Active Session API

- **状态：** Complete on 2026-07-24; next task is 8.2C-C.
- **目标：** Provide one authoritative, idempotent, cross-device active Session lifecycle per
  user.
- **实现：** Versioned contracts and authenticated routes for active/start/complete/abandon;
  migration `0008` enforces server timestamps, legal transitions, one active Session per user,
  immutable idempotency events, and forced RLS.
- **兼容：** Existing V1 plans remain readable. Legacy completion requires an accepted Attempt;
  V2 completion requires evidence for every persisted Activity. The planner and mobile runtime are
  not switched here.
- **实际验证：** Frozen install, format, 8-package lint/typecheck/test/build, 414 tests,
  content/runtime boundary scans, 8 static migrations, PostgreSQL 17.10 migration/RLS/concurrency
  integration, Expo Web export of 22 routes, and `git diff --check` passed.
- **回滚：** Disable lifecycle and Session creation routes while retaining additive migration data
  and immutable audit events.

### 8.2C-C — Session Plan V2 learn/review

- **状态：** Complete on 2026-07-24; next task is 8.2C-D.
- **目标：** Materialize executable, immutable multi-source Activity Snapshots for authoritative
  learn and review plans.
- **实现：** Strict V2 request/result contracts; authoritative published curriculum and due-review
  reads; pure-engine planning with fixed seed; four-Hanzi-type capability gate; atomic Session and
  Activity materialization; immutable idempotency receipts for planned and empty outcomes.
- **兼容：** The V1 route branch remains available. `nothing_due` and
  `insufficient_safe_content` create no Session or Activity. Migration `0009` is additive and
  leaves migrations `0001`–`0008` unchanged.
- **实际验证：** Frozen install, format, 8-package lint/typecheck/test/build, 83 test files and
  421 tests, content/runtime boundary scans, 9 static migrations, fresh PostgreSQL 17.10
  migration/RLS/concurrency/atomicity integration, Expo Web export of 22 routes, and
  `git diff --check` passed.
- **风险：** Mobile does not consume V2 snapshots until 8.2D-A/B; Attempts V2 evidence is pending
  8.2C-D; Pinyin candidates remain deliberately gated; production curriculum import remains 8.3E.
- **回滚：** Disable the V2 route branch and materialization function while retaining immutable
  event receipts and snapshots for auditability; do not delete migration data.

### 8.2C-D — Attempts V2 and normalized Evidence

- **状态：** Complete on 2026-07-24; next task is 8.2D-A.
- **目标：** Score bounded offline Attempts from immutable multi-Lesson Session Activities and
  normalize every Evidence Target into an authoritative replay row.
- **实现：** Strict `attempts-batch-request/response-v2`; server scoring by
  `sessionActivityId`; immutable per-attempt selected/expected values; batch and Attempt
  idempotency; normalized multi-target quality rows; stable Skill/Review replay without JSONB
  target scans; completed/abandoned rejection.
- **迁移：** Additive `0010_attempts_v2_normalized_evidence.sql` keeps legacy Attempt columns,
  adds forced-RLS `attempt_evidence` and immutable batch receipts, and idempotently backfills
  legacy rows without changing effective quality.
- **版本决定：** Evidence uses `exercise-quality-v1+pinyin-evidence-v1`. A dependency defect found
  during repeated PostgreSQL tests bumped Session materialization to
  `pinyin-session-planner-v1+session-materializer-v2`, which admits only closing candidates with
  predicted success at least `0.90`.
- **实际验证：** Frozen install; format; 8-package lint/typecheck/test/build; 84 test files and 430
  tests; content/runtime scans; 10 static migrations; PostgreSQL 17.10 fresh migration/RLS/
  concurrency/terminal-state integration, including four consecutive full DB runs; independent
  0001–0009 → 0010 multi-target backfill equivalence; Expo Web export of 22 routes; and
  `git diff --check`.
- **风险：** Mobile still submits V1 until 8.2D-A; Pinyin scoring remains gated until 5.9P-B;
  legacy columns remain for compatibility and require a later reviewed cleanup decision.
- **回滚：** Disable only the V2 route branch and retain immutable Attempts/Evidence/receipts.
  Continue V1 compatibility reads; do not drop `0010` data or rewrite migration history.

### 8.2D-A — Mobile formal Session data layer and recovery

- **状态：** Complete on 2026-07-24; next task is 8.2D-B.
- **目标：** Fetch, validate, cache, recover, reconcile, and sync a formal V2 Session without
  introducing the Runner UI.
- **实现：** A strict Session API client covers active/plan/start/complete/abandon; local schema
  version 3 stores per-user V2 headers and immutable Activity Snapshots separately from legacy
  V1/Demo data; the persistent V2 outbox references `sessionActivityId`; recovery reconciles local
  and server state, syncs before replacement, preserves rejected/unsynced events, quarantines only
  corrupt records, and invalidates active/learn/review read models on terminal lifecycle events.
- **版本决定：** No server contract or learning algorithm changed. Local recovery/export schema
  is version 3, cache records are `formal-session-cache-v2`, and outbox records are
  `formal-attempt-outbox-v2`.
- **兼容：** Web v2 documents migrate into isolated legacy buckets. SQLite migrates additively
  from 2 to 3. Demo/V1 Attempts never enter the V2 sync path. Account-scoped reads and
  `clearUser` prevent cross-account cache display.
- **实际验证：** Frozen-lockfile install; mobile lint/typecheck and 35 files/170 tests; full
  format, 8-package lint/typecheck/test/build with 87 files/448 tests; no-AI, portable backend,
  V1 boundary and content gates; 10 static PostgreSQL migrations; and Expo Web export of 22
  routes all passed.
- **风险：** SQLite migration behavior is statically validated and shares the tested storage
  contract, but native-device process-death and disk-corruption exercise remains a release gate.
  The formal Runner is intentionally not wired into navigation until 8.2D-B.
- **回滚：** Stop invoking the formal Session data layer and retain the version-3 local tables and
  recovery export for forward repair. Do not map legacy Demo records into V2 or delete pending
  outbox evidence.

### 8.2D-B — Universal Hanzi Session Runner

- **状态：** Complete on 2026-07-24; next task is 5.9P-A.
- **目标：** Connect the production Learn entry to a single formal Runner for the four released
  Hanzi exercise types while preserving server-authoritative scoring and offline recovery.
- **实现：** Home now enters `/session`, which recovers an active Session or requests a learn plan.
  The shared Runner handles `audio_to_glyph`, `glyph_to_image`, `word_build`, and
  `sentence_order`; exposes progress, remaining work, hints, retries, Pinyin-support state,
  supportive feedback, and completion; atomically persists every local Attempt with its Session
  checkpoint before best-effort V2 outbox sync; and reconciles terminal server state before
  refreshing learn/review read models. Local/server score mismatches emit only a safe telemetry
  code. Demo and showcase routes remain development-only and redirect away in production.
- **版本决定：** Runner state is `formal-hanzi-runner-v1`; no contract, migration, lockfile, or
  learning-engine version changed. Only the four already-released Hanzi capabilities are accepted.
- **兼容：** Existing V1/Demo storage remains isolated. A cached formal Session resumes at the
  first incomplete Activity, pending/rejected Attempts are retained, duplicate submit is blocked,
  and authentication expiry returns to sign-in without fabricating completion.
- **实际验证：** Frozen dependency tree; mobile lint/typecheck and 39 files/183 tests; real
  PostgreSQL 17 migration plus integration suite; full format, 8-package lint/typecheck/test/build
  with 91 files/461 tests; no-AI, portable-backend, V1 boundary, content, and 10 static migration
  gates; Expo Web export of 23 routes; and `git diff --check`.
- **风险：** Published Activity Snapshots currently carry image asset keys without a production
  asset resolver, so the glyph-to-image Runner preserves the accessible label but cannot yet show
  a production image. Pinyin display text is not fabricated when absent from the snapshot.
  Physical-device process-death, speech, disk-failure, and account-switch testing remain release
  audit work.
- **回滚：** Restore Home navigation to its previous placeholder while retaining formal cache,
  immutable Attempts, and outbox records for recovery. Do not delete pending evidence or rewrite
  migrations.

### 5.9P-C — Pinyin integration into the universal Session Runner

- **状态：** Complete on 2026-07-24; next task is 8.2A-H.
- **目标：** Run all six formal Pinyin exercise types through the same immutable Session,
  persistent V2 outbox, supportive feedback, recovery, synchronization, and completion flow as
  Hanzi.
- **实现：** The mobile planner now declares `pinyin-exercises-v1`. Runner state
  `formal-session-runner-v2` supports all ten exercise types; pure adapters connect the six
  existing Pinyin components to immutable V2 answer IDs and the shared Attempt path. Bundled
  Pinyin audio is resolved locally, prefetched once per Activity `contentSha256`, replay-counted
  only after playback preparation succeeds, and recoverable on failure. The Pinyin tab shows
  current formal-Session Pinyin progress and opens `/session` instead of rendering six demos.
- **版本决定：** No API contract, learning algorithm, database schema, migration, dependency, or
  lockfile changed. The optional capability remains backward compatible with clients that omit it.
- **实际验证：** Frozen install; mobile lint/typecheck and 42 test files; Expo Web export of 23
  routes; PostgreSQL 17 migration, full learning-loop/Pinyin integration, and isolated legacy
  Evidence backfill tests; full repository validation; runtime/privacy boundary scans; and
  `git diff --check`.
- **风险：** Physical-device offline audio/process-death checks remain release work. The bundled
  registry currently covers the three approved `ma2/ma3/ma4` assets; future release assets must be
  bound by 8.3E or the Runner fails closed. The Pinyin tab shows active-Session progress rather
  than a historical mastery dashboard.
- **回滚：** Remove the mobile capability opt-in and Pinyin renderer/entry additions while
  retaining immutable Session snapshots, Attempts, Evidence, and pending outbox events. No
  database rollback is required.

### 8.2B — Mobile Review Center

> **SUPERSEDED:** Do not execute this historical card. Its replacement is Task 8.2B-R after the
> canonical Session, Attempts V2, universal Runner, Pinyin persistence, and Review hardening tasks.

- **状态：** Pending explicit approval after 8.2A completion.
- **目标：** Replace the Review tab placeholder with accessible summary, groups, states, paging,
  retry, and session-planner-backed “start review” behavior.
- **开始检查点：** The current `session-plan-request-v1` has no review intent. Before UI work,
  review and explicitly version the smallest compatible `intent: "review"` extension; do not build
  a second planner.
- **非目标：** No client-side mastery/schedule mutation and no duplicated 3.x planning logic.
- **回滚方式：** Restore the placeholder route while retaining the read-only API.

### 9.5R — Complete V1 release audit rerun

> **SUPERSEDED SEQUENCE:** The audit task remains required, but it may run only at the end of the
> Post-8.2A manifest, not directly after historical Task 8.2B.

- **状态：** Pending 8.2A and 8.2B.
- **目标：** Rerun the complete V1 candidate audit and replace historical 8.0 evidence with current
  results.
- **非目标：** No feature implementation inside the audit.
- **验收标准：** Every executed gate records its real result; unresolved native/store/operator
requirements remain explicit blockers rather than inferred passes.

### 8.2A-H completion checkpoint

Completed on 2026-07-24. Review Center now uses signed fixed-clock keyset pagination, explicit
active Curriculum selection, SQL-side due filtering/multi-skill merge/confusion coverage/counts,
and bounded `limit + 1` reads. The next task is 8.2B-R.

### 8.2B-R completion checkpoint

Completed on 2026-07-24. The Review tab now renders the authenticated read model, user-isolated
offline cache, supportive reasons, complete/empty/error states, and active Session recovery.
Starting review calls Session Plan V2 with `intent: review`; preview items never become client
planner input. The next task is 8.3D.
