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

## Canonical documents

- [Product and technical design](docs/PRODUCT_TECH_DESIGN.md)
- [Implementation plan](docs/CODEX_IMPLEMENTATION_PLAN.md)
- [Pivot ADR](docs/ADR/0002-v1-single-user-no-ai-pinyin-signature-humor.md)
- [Portable PostgreSQL/API ADR](docs/ADR/0003-portable-postgresql-api-and-auth.md)
- [Repository rules](AGENTS.md)

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
pnpm db:validate:static
pnpm db:migrate
pnpm db:test
pnpm build
```

Do not claim dynamic database tests passed unless they were actually run against PostgreSQL.
