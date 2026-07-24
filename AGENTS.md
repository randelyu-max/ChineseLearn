# AGENTS.md — HanziQuest repository instructions

## Product mission

为会说或听得懂一些中文、但不熟悉汉字阅读和书写的 13 岁以上海外华裔青少年及成人，建立一款拼音、汉字阅读、复习和中文名字书写学习应用。

## Required documents

Before changing a feature, read `docs/PRODUCT_TECH_DESIGN.md`, the relevant ADRs, shared contracts,
and the nearest directory-specific `AGENTS.md`. Work in one focused task from
`docs/CODEX_IMPLEMENTATION_PLAN.md`; do not silently revive superseded tasks.

For work after Task 8.2A, also read `CODEX_START_AFTER_8_2A.md`,
`AGENTS_ADDENDUM_POST_8_2A.md`, the Post-8.2A design/remediation addenda, ADR 0004-0006, and the
specific task card under `docs/tasks/post-8.2A/`. The manifest order is dependency order. Keep each
task independently reviewable and do not combine its migration or acceptance evidence with the
next task.

## V1 architecture rules

1. One Better Auth `public."user"` row maps one-to-one to `public.profiles`; private records use
   `user_id`.
2. Do not create Parent, Child, Household, Family, Guardian, learner-switching, invitation, role,
   consent, parent-gate, or parent-PIN systems in V1.
3. V1 forbids all generative-AI runtime code, provider SDKs, prompts, AI functions, moderation,
   AI flags, AI entitlements, and placeholder abstractions for future AI.
4. Pinyin is a deterministic first-class learning capability with content, exercises, mastery,
   diagnosis, review, and adaptive support.
5. The learning engine remains pure, deterministic, versioned, and testable: no network, database,
   UI, AI SDK, uninjected clock, or unseeded randomness.
6. A correct answer after a pinyin hint must contribute less evidence to independent Hanzi
   recognition than an unhinted answer.
7. Raw signature stroke trajectories remain local by default.
8. Signature features must never authenticate identity, verify signatures, imitate a real person's
   signature, or claim forensic validity.
9. Humor is static, editorially reviewed curriculum content with a neutral fallback.
10. Wrong-answer feedback must be supportive and never shame the user.
11. UI and copy use age-neutral language suitable for teenagers and adults.
12. Every private table is isolated by forced PostgreSQL RLS using the API transaction identity
    and tested for cross-user denial.
13. Clients cannot directly modify mastery, rewards, publication state, or other
    server-authoritative records.
14. Do not add future-AI interfaces, entitlements, configuration, or empty implementations to V1.
15. A formal Session is a server-created, versioned, bounded, immutable snapshot. It may contain
    multiple lessons and domains and must not discover answers later through a single `lesson_id`.
16. Answer keys may appear only inside an authenticated, already-created bounded Session for
    offline feedback. Catalog, Review Center, and pre-start previews must not expose them; the
    server always re-scores submitted answers.
17. Review Center is a read-only preview. Starting review must use the same authoritative
    `session-plan` service with `intent: review`; do not build a second planner.
18. Demo and showcase routes are not formal learning-loop entry points and cannot satisfy release
    acceptance.
19. Never mark Closed Alpha, release readiness, or a release gate green using historical evidence
    after code or migrations have changed. Record only commands and devices actually exercised.

## Privacy and safety

Collect only data required for the learning experience. Do not require real names, school,
precise location, government identifiers, biometric claims, or raw voice recordings. Logs must
not contain tokens, private writing trajectories, raw audio, or sensitive profile text.

The optional Chinese name is learning content for the user's own writing practice. Normalized
stroke points may be processed locally. V1 server storage is limited to project metadata,
practice counts, score summaries, and selected deterministic style unless a later reviewed task
explicitly changes this rule.

## Learning invariants

- Mastery stays between `0.02` and `0.98`; stability is positive.
- Attempts are immutable and idempotent.
- Prerequisites are never bypassed.
- No session introduces more than four new Hanzi.
- No more than two consecutive high-difficulty activities.
- A non-empty session ends with a predicted-success activity of at least `0.90`.
- Fixed seeds produce reproducible plans.
- Pinyin support changes evidence weight, not the truth of the answer.

Algorithm changes require an explicit version decision, unit tests, invariant tests, expected
behavior documentation, and fixtures for strong, struggling, returning, and offline users.

## Contracts, database, and offline rules

- Define shared trust-boundary schemas in `packages/contracts`; derive TypeScript types from them.
- Validate all external inputs and return versioned error shapes.
- Server re-evaluates answers; never trust client `isCorrect`.
- Mutations use idempotency keys.
- Database changes require ordered migrations, constraints, cross-user RLS tests, and rollback
  notes.
- Applied migrations are immutable. Post-8.2A work begins with
  `0007_session_activity_snapshots.sql`; never edit or renumber `0001`-`0006`.
- Application clients may select their own Session activity snapshots but may not directly insert,
  update, or delete them.
- Offline progress uses a persistent outbox; never an in-memory-only queue.
- Reward and inventory changes use immutable idempotent server transactions.

## Pinyin, writing, and humor rules

- Pinyin exercises must distinguish initials, finals, syllables, and tones where appropriate.
- Do not assume English letter pronunciation equals Pinyin pronunciation.
- Writing coordinates are normalized across screen sizes.
- Deterministic signature styles are limited to clear, compact, forward-leaning, and flowing
  transformations of the user's own Chinese name.
- Humor levels are `off`, `light`, and `playful`; default is `light`.
- Humor validators must preserve the learning target and answer, reject humiliation and identity
  stereotypes, distinguish mnemonic stories from etymology, and require a neutral fallback.

## Standard validation

Use the repository's pinned package manager. On Windows without a global pnpm shim, use
`corepack pnpm` for direct package commands.

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm content:validate
pnpm build
```

Run focused checks during implementation and the required full checks before completion. Never
claim an unrun test passed. Do not disable tests, add broad ignores, use `any` to hide errors, or
rewrite unrelated files.

Do not automatically commit, push, deploy, publish curriculum, or run destructive remote database
operations. These actions require explicit user authorization. Local PostgreSQL tests must use
disposable data and preserve forward-only migration history.

## Completion report

Report changed files, actual commands and results, privacy/security/learning implications,
remaining risks, and rollback instructions. Task 4.3R established bounded, session-authenticated
attempt batches, server-side answer evaluation, immutable/idempotent attempts, authoritative
skill/review replay, cross-user RLS coverage, and mobile outbox synchronization. Tasks 5.2P through
5.8P added deterministic, accessible Pinyin exercises plus a versioned adaptive support runtime
whose visible/revealed state is the source of truth for evidence weighting. Task 8.2A added only
the versioned read-only Review Center API under session identity and forced RLS; it must not create
sessions or mutate authoritative learning state. Task 8.2B remains pending, the Review tab is still
a placeholder, and Task 9.5R must rerun the full release audit before promotion. Tasks 6.1W–6.4W
added an own-name-only normalized vector canvas, local per-user raw-stroke
storage, reviewed offline stroke-order lessons, four deterministic bounded style previews, and
local self-consistency feedback with a raw-free idempotent metadata API. Do not silently combine
them with forensic verification or human-signature imitation. Task 7.1H added the versioned static
humor schema and safety validator. Task 7.2H added only the profile preference control and pure
offline selector: `off` always resolves to the neutral fallback, missing preference fails closed,
and no personalization profile is created. Task 7.3H published six bundled items as
`humor-content-v1` version `1.0.0`, with human editorial approval by 于永, exact
simplified/traditional targets and answers, neutral fallbacks, and content validation in CI.
Published content is immutable; changes require a new content version and renewed review.
The historical Task 8.0 and Task 8.2A checkpoint evidence is recorded in
`docs/release/V1_RELEASE_CHECKLIST.md`; every red or pending promotion gate must be resolved and the
full suite rerun under Task 9.5R before release. The current session-plan contract has no review
intent, so Task 8.2B must explicitly review the smallest versioned extension and must not introduce
a second planner.
