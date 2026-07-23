# AGENTS.md — HanziQuest repository instructions

Codex reads this file before making changes. Keep it short, current, and enforceable.

## Product mission

Build a safe, privacy-minimizing Chinese character and reading app for overseas Chinese children who can understand/speak Mandarin but cannot yet read Chinese well.

The product is child-directed. Safety, privacy, learning integrity, and deterministic business rules take priority over speed or visual novelty.

## Required documents

Before changing a feature, read the relevant sections of:

- `docs/PRODUCT_TECH_DESIGN.md` or `HanziQuest_完整产品技术设计.md`
- `docs/ADR/`
- `packages/contracts/`
- the nearest directory-specific `AGENTS.md`, if present

For complex or cross-cutting work, use Plan mode before editing.

## Repository shape

Expected monorepo:

```text
apps/mobile          Expo + React Native + TypeScript
apps/admin           Next.js + TypeScript
packages/contracts   Zod API/event/AI contracts
packages/learning-engine
packages/content-validator
packages/curriculum
packages/design-tokens
supabase/migrations
supabase/functions
supabase/tests
```

Do not create duplicate domain types inside individual apps when a shared contract belongs in `packages/contracts`.

## Standard commands

Use the repository scripts once initialized. Expected commands:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm content:validate
pnpm build
```

For local backend work:

```bash
supabase start
supabase db reset
supabase functions serve
```

For a focused task, run the narrowest relevant tests during implementation, then run the full required validation before completion.

## Non-negotiable architecture rules

1. The deterministic learning engine decides what to teach, difficulty, mastery, review scheduling, unlocks, and rewards.
2. Generative AI may create constrained stories, hints, or parent-report wording only. It must not directly update mastery, unlock content, or grant rewards.
3. Never put OpenAI, Supabase secret/service-role, payment, signing, or admin secrets in mobile/web client code.
4. The mobile client may use only public/publishable configuration protected by Row Level Security.
5. All private household tables use RLS and automated cross-household denial tests.
6. Reward balances and inventory are server-authoritative and use idempotent immutable transactions.
7. Attempts are immutable events with client-generated UUIDs. Duplicate delivery must not duplicate learning updates or rewards.
8. Offline behavior uses a persistent outbox. Never rely on in-memory queues for learning progress.
9. Database changes require versioned migrations, constraints, RLS policies, tests, and a forward/rollback note.
10. AI outputs require Structured Outputs/Zod parsing, deterministic validation, moderation, and a static fallback before any child can see them.

## Child privacy rules

Do not collect or transmit unless a task explicitly has approved requirements and tests:

- child email or phone number
- exact date of birth
- school, class, address, or precise location
- child photo
- advertising identifiers
- unrestricted chat text
- raw child voice recordings

Use age bands, controlled interest enums, random internal IDs, and optional non-real nicknames.

Never send child nickname, identity, school, location, or household data to an AI provider.

Cloud processing of child voice is disabled by default. Do not implement or enable it without a documented privacy decision, parental-consent flow, retention controls, and feature flag.

Logs must not contain child nicknames, raw speech/transcripts, authentication tokens, or full AI prompts that may contain personal data.

## Child experience rules

- No ads.
- No public leaderboards or stranger interaction.
- No open-ended child AI chat in MVP.
- Purchases, external links, account settings, privacy controls, and subscriptions stay behind a parental gate.
- Wrong answers must not remove earned assets or use shaming language.
- Do not add infinite reward loops after the daily goal is completed.
- Drag-and-drop activities need an accessible tap alternative.
- Do not use color as the only feedback signal.

## Learning-engine rules

Keep `packages/learning-engine` pure and deterministic:

- no network calls
- no database imports
- no AI SDKs
- no UI imports
- no wall-clock access without an injected clock
- no random behavior without an injected seeded RNG

Every algorithm change must:

- increment or explicitly retain `algorithmVersion`
- include unit tests and property/invariant tests
- document expected behavior changes
- preserve mastery bounds and idempotency
- include fixtures for strong, struggling, returning, and offline learners

Core invariants:

- mastery remains between 0.02 and 0.98
- stability is positive
- no session exceeds the configured new-character limit
- no more than two consecutive high-difficulty activities
- a non-empty session ends with a high-success activity
- prerequisites are never bypassed by interest personalization

## API and contract rules

- Define request/response schemas in `packages/contracts` with Zod.
- Derive TypeScript types from schemas; do not hand-maintain parallel interfaces.
- Validate at every trust boundary.
- Use a consistent versioned error shape.
- Server re-evaluates correct answers; never trust `isCorrect` from the client.
- All mutation endpoints use idempotency keys.
- Child-visible error text is separate from technical error messages.

## AI implementation rules

- All AI calls run server-side.
- Model names are configuration aliases, not scattered string literals.
- Store prompt version, schema version, validator version, and model alias with generation metadata.
- Send only the minimum curriculum constraints required for generation.
- Use a maximum of one automatic repair retry after validation failure.
- Never display unparsed, unmoderated, or unvalidated model output.
- A static editorial fallback is required for every child-facing AI feature.
- Tests must mock provider calls; normal CI must not spend API credits.

## Database and RLS rules

- Enable RLS on every household-private table.
- Default deny. Add the narrowest policy needed.
- Use helper functions carefully with a fixed `search_path`.
- Service-role usage is limited to server functions and admin jobs.
- Never let clients directly write mastery, reward balances, inventory, publication state, or moderation results.
- Add indexes for every expected child/session/review query and verify query plans for large tables.

## Testing requirements

A task is incomplete without tests for relevant failure modes.

Minimum expectations:

- domain logic: unit + invariant/property tests
- API: success, auth denial, invalid input, duplicate request, and retry behavior
- database: migration + RLS tests
- offline/sync: duplicate and out-of-order events
- rewards: duplicate completion and insufficient balance
- AI: schema failure, moderation failure, validator failure, timeout, and static fallback
- UI: loading, empty, error, offline, accessibility labels, and interrupted-session recovery

Do not disable tests, add broad ignores, or use `any` merely to make CI pass. Explain and isolate unavoidable exceptions.

## Change discipline

- Work in one focused milestone or issue at a time.
- Before edits, inspect current code and state assumptions.
- Prefer small, reviewable commits.
- Do not rewrite unrelated files.
- Keep generated files clearly marked and reproducible.
- Do not update dependency major versions unless the task requests it.
- Run formatter only on touched files unless a formatting migration is the task.
- Add an ADR for architecture decisions with lasting consequences.

## Completion response

At the end of a task, report:

1. What changed.
2. Key files and migrations.
3. Tests and commands run, with actual results.
4. Privacy/security/learning implications.
5. Remaining risks or follow-up work.

Never claim tests passed if they were not run.
