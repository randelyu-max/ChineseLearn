# AGENTS.md — HanziQuest repository instructions

## Product mission

为会说或听得懂一些中文、但不熟悉汉字阅读和书写的 13 岁以上海外华裔青少年及成人，建立一款拼音、汉字阅读、复习和中文名字书写学习应用。

## Required documents

Before changing a feature, read `docs/PRODUCT_TECH_DESIGN.md`, the relevant ADRs, shared contracts,
and the nearest directory-specific `AGENTS.md`. Work in one focused task from
`docs/CODEX_IMPLEMENTATION_PLAN.md`; do not silently revive superseded tasks.

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

## Completion report

Report changed files, actual commands and results, privacy/security/learning implications,
remaining risks, and rollback instructions. Task 4.3R established bounded, session-authenticated
attempt batches, server-side answer evaluation, immutable/idempotent attempts, authoritative
skill/review replay, cross-user RLS coverage, and mobile outbox synchronization. Tasks 5.2P through
5.7P added deterministic, accessible Pinyin/audio/glyph/tone exercises and ordered tap-based
syllable assembly with legal combinations and canonical tone marks. The next eligible task is
5.8P; do not silently combine it with a completed task.
