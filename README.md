# HanziQuest

HanziQuest V1 is a Chinese-learning app for overseas Chinese teenagers aged 13+ and adults who
understand or speak some Chinese but need stronger Pinyin, Hanzi reading, review, and Chinese-name
writing skills.

## V1 decision

- One Better Auth user maps one-to-one to one profile.
- Private records use `user_id` and forced PostgreSQL RLS.
- No Parent, Child, Household, Guardian, family roles, learner switching, or parent gate.
- No generative-AI runtime, provider configuration, entitlement, quota, or placeholder interface.
- Pinyin is a first-class deterministic learning domain.
- Raw signature trajectories stay local by default and are never used for identity verification.
- Humor is static, human-authored, reviewed curriculum with a neutral fallback.

P1 removed the old generative-AI surface. The database and authentication stack now use standard
PostgreSQL, Better Auth, and a portable Hono API. Cross-user RLS tests exercise the same
transaction-local identity used by the API. Tasks 2.3R/2.4R replace the legacy role-based
mobile UI with single-user login, registration, password recovery, secure session restoration,
profile onboarding, protected routes, offline lesson recovery, and Learning/Pinyin/Writing/Review/Me
navigation.

Task 3.5R adds `diagnostic-v1`, a pure and reproducible six-axis Pinyin/Hanzi diagnostic in
`packages/learning-engine`. It uses injected clocks and seeded randomness, returns neutral
machine-code recommendations, and has no database, network, UI, or AI dependency.

Tasks 6.1W–6.4W provide an own-name normalized writing canvas, reviewed offline stroke order,
four deterministic styles, and local self-consistency feedback. Raw points and images stay in
the per-user Web/SQLite draft. The API accepts only strict project metadata and immutable derived
metric events; PostgreSQL produces the authoritative practice count and summary under forced RLS.

Task 7.1H adds the versioned `humor-content-v1` contract and a pure static-content validator for
six approved humor types. It requires bundled human-editorial text, an equivalent neutral fallback,
unchanged learning targets and answers, release review, supportive language, and an explicit
mnemonic-not-etymology disclosure for memory scenes. Actual reviewed humor content remains a later
task.

Task 7.2H keeps the existing `light` profile default and adds an age-neutral preference control.
The pure selector works against bundled content without network access: `off` always selects the
neutral fallback, `light` cannot select playful variants, and a missing offline preference fails
closed to neutral. Preference updates continue through the authenticated profile endpoint and do
not create a personalization profile.

Task 7.3H publishes `humor-content-v1` version `1.0.0`: six bundled, human-edited items approved by
于永, with stable IDs, simplified/traditional targets and answers, and exact neutral fallbacks.
The default content command and CI now validate the published package; no text is generated or
rewritten at runtime.

Task 8.2A adds a session-authenticated, forced-RLS, read-only `GET /api/review-center` endpoint.
Its versioned contract returns bounded due/overdue summaries, all six stable groups, safe published
content labels, deterministic estimates, and cursor pagination without changing mastery, schedules,
attempts, or confusion state. The Review tab remains an unfinished placeholder until Task 8.2B,
and the full release audit must be rerun as Task 9.5R.

Task 5.9P-A moves Pinyin from a demo-only fixture into a versioned PostgreSQL curriculum domain.
It adds stable initial/final/tone/syllable concepts, licensed audio metadata with byte-verified
SHA-256 hashes, an idempotent formal import, and explicit canonical/surface Pinyin reading fields.
Pinyin planning and server scoring remain disabled until Task 5.9P-B.

## Canonical documents

- [Product and technical design](docs/PRODUCT_TECH_DESIGN.md)
- [Implementation plan](docs/CODEX_IMPLEMENTATION_PLAN.md)
- [Pivot ADR](docs/ADR/0002-v1-single-user-no-ai-pinyin-signature-humor.md)
- [Portable PostgreSQL/API ADR](docs/ADR/0003-portable-postgresql-api-and-auth.md)
- [Repository rules](AGENTS.md)
- [V1 release checklist](docs/release/V1_RELEASE_CHECKLIST.md)
- [Store metadata](docs/release/STORE_METADATA.md)
- [Privacy notice](docs/release/PRIVACY_NOTICE.md)
- [Rollback runbook](docs/release/ROLLBACK_RUNBOOK.md)
- [Supported devices](docs/release/SUPPORTED_DEVICES.md)

## Repository

```text
apps/mobile                 Expo + React Native + Expo Router
apps/admin                  Next.js administration shell
apps/api                    Hono API and Better Auth server
packages/contracts          Shared trust-boundary contracts
packages/curriculum         Static curriculum domain
packages/content-validator  Deterministic content validation
packages/learning-engine    Pure adaptive-learning algorithms
packages/design-tokens      Shared visual tokens
database                    Standard PostgreSQL migrations and operating notes
```

## Toolchain

- Node `>=22.13.0 <25`
- pnpm `11.15.1`
- PostgreSQL 17, optionally through Docker Desktop for local database tests

On Windows without a global pnpm shim, direct commands can use Corepack:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev:api
corepack pnpm --filter @hanziquest/mobile start
```

Turbo-based root commands require `pnpm` on PATH. CI installs it automatically.

## Validation

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:no-ai
pnpm verify:v1-release
pnpm db:validate:static
pnpm db:migrate
pnpm db:import:pinyin
pnpm db:test
pnpm db:test:pinyin
pnpm build
```

Do not claim dynamic database tests passed unless they were actually run against PostgreSQL.
