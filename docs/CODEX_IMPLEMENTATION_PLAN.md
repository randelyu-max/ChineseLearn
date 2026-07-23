# HanziQuest V1 Codex implementation plan

Status: Task 5.2P offline `audio_to_pinyin` exercise implemented; 5.3P is next.
Execute one task at a time; stop after its acceptance checks and review.

## Superseded work

The original family RLS, parent authentication, consent/child profile, parent gate, parent
dashboard/report, Child Profile, Household, Parent/Guardian roles, AI story/prompt/moderation,
AI parent report, AI speech, Premium AI, and AI entitlement tasks are **SUPERSEDED** and must not
be resumed. Original Task 3.5 is **SUPERSEDED by Task 3.5R**.

Task 3.1 BKT, 3.2 memory stability, 3.3 confusion risk, and 3.4 session planning remain accepted
age-neutral learning algorithms. Their persistence adapters are not accepted because the current
database still uses `child_id`.

## Required order

P0 (complete) → P1 (complete) → 2.2R (complete) → 2.3R (complete) → 2.4R (complete) → 3.5R (complete) → 3.6R (complete) →
5.1P (complete) → 3.7R (complete) → 4.1R (complete) → 4.2R (complete) → 4.3R (complete) → 5.2P–5.8P → 6.1W–6.4W → 7.1H–7.3H → 8.0.

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

| Task            | 目标                                                         | 非目标                     | 依赖                | 文件范围                       | 数据变化                 | 测试要求与验收                                                                                                                          |
| --------------- | ------------------------------------------------------------ | -------------------------- | ------------------- | ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1P (complete) | Pinyin initials/finals/syllables/tones domain and validation | No UI                      | 3.5R contract       | curriculum/contracts/validator | `pinyin-content-v1` only | Implemented 2026-07-23: legal/illegal combinations, deterministic tone normalization, five-tone table, references, and approved fixture |
| 5.2P (complete) | `audio_to_pinyin`                                            | No speech upload           | 5.1P                | mobile feature/tests           | Attempts only later      | Implemented 2026-07-23: deterministic tone distractors, bundled/replayable MP3, supportive retry, responsive and screen-reader semantics |
| 5.3P            | `pinyin_to_audio`                                            | No pronunciation scoring   | 5.2P                | mobile feature/tests           | None                     | Audio preload/replay/error; correct clip stable                                                                                         |
| 5.4P            | `pinyin_to_glyph`                                            | No translation dependency  | 5.1P                | mobile feature/tests           | None                     | Tone variants and ambiguity; target mapping correct                                                                                     |
| 5.5P            | `glyph_to_pinyin`                                            | No always-on ruby text     | 5.1P                | mobile feature/tests           | None                     | Polyphone context and hints; accepted reading explicit                                                                                  |
| 5.6P            | `tone_choice`                                                | No dialect judgment        | 5.1P                | mobile feature/tests           | None                     | Tone/neutral-tone table tests; no shaming copy                                                                                          |
| 5.7P            | `pinyin_syllable_build`                                      | No free text IME           | 5.1P                | mobile feature/tests           | None                     | Tap alternative, legal order, diacritics; accessible completion                                                                         |
| 5.8P            | Adaptive Pinyin display and fading                           | No hidden global heuristic | 3.6R, prior P tasks | engine/mobile/tests            | Support preference/state | Fade/re-enable/interruption tests; evidence and UI agree                                                                                |

## Writing task series

All writing tasks operate only on the user's own Chinese name, normalize coordinates, keep raw
strokes local by default, never authenticate/verify identity, never imitate a real person, and
never call AI. Each task needs unit, local persistence, accessibility, and privacy assertions.

| Task | 目标                                                | 非目标                                   | 依赖       | 文件范围                 | 数据变化                           | 测试要求与验收                                             | 回滚                              |
| ---- | --------------------------------------------------- | ---------------------------------------- | ---------- | ------------------------ | ---------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| 6.1W | Vector canvas and normalized `StrokePoint`/`Stroke` | No scoring/upload                        | 2.4R       | mobile writing/storage   | Local strokes                      | Resize/replay/undo/performance; same normalized trace      | Remove route/local table          |
| 6.2W | Standard stroke order, tracing to free writing      | No signature style                       | 6.1W       | curriculum/mobile        | Static stroke assets               | Start/direction/structure/ratio; offline tracing           | Remove lesson layer/assets        |
| 6.3W | Deterministic clear/compact/leaning/flowing styles  | No AI or celebrity imitation             | 6.2W       | pure transform module/UI | Selected style metadata            | Fixed input reproducibility/bounds; own-name only          | Remove transforms/style field     |
| 6.4W | Local save and self-consistency feedback            | No forensic verification/cloud raw trace | 6.3W, 2.2R | local store/summary API  | Server metadata/count/summary only | Assert no raw points/image payload; repeatability feedback | Disable sync, retain local export |

## Humor task series

Humor is static editorial curriculum with `off | light | playful` preference (`light` default),
neutral fallback, no AI/network, no humiliation, identity stereotypes, false etymology, or changed
answers.

| Task | 目标                                              | 非目标                       | 依赖       | 文件范围             | 数据变化                | 测试要求与验收                                         | 回滚                          |
| ---- | ------------------------------------------------- | ---------------------------- | ---------- | -------------------- | ----------------------- | ------------------------------------------------------ | ----------------------------- |
| 7.1H | Humor schema and validator for six approved types | No content generation        | 5.1P       | curriculum/validator | Content metadata        | Same target/answer, fallback, safety checks            | Remove additive fields/rules  |
| 7.2H | Profile humor preference                          | No personalization profiling | 7.1H, 2.4R | profile/mobile       | `humor_preference`      | Default/update/offline selection; `off` always neutral | Default to off/remove control |
| 7.3H | Human-authored reviewed humor content             | No AI rewrite                | 7.2H       | curriculum/assets    | Static content versions | Editorial status, locales, targets, fallbacks          | Unpublish humor variants      |

### 8.0 — Full V1 regression and release preparation

- **目标：** Validate complete single-user V1 for release.
- **非目标：** No new features, AI, payment, or speculative architecture.
- **依赖：** All accepted tasks above.
- **文件范围：** Entire repository, release docs, CI, store metadata.
- **数据变化：** Release migration rehearsal and backups only.
- **安全和隐私：** Forbidden-domain scan, RLS audit, local-stroke audit, secret scan.
- **测试要求：** Full unit/integration/E2E, offline stress, performance, accessibility, privacy,
  content, migration/rollback, supported devices.
- **验收标准：** No Parent/Child/Household/AI runtime surface; all release gates documented green.
- **回滚方式：** Do not promote candidate; restore previous deployment/database snapshot.
