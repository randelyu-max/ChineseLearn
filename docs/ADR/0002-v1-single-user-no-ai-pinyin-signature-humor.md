# ADR 0002: V1 single user, no AI, first-class Pinyin, signature practice, and static humor

- Status: Accepted
- Date: 2026-07-23
- Supersedes: Parent/Child/Household and generative-AI assumptions in the original baseline
- Amended by: ADR 0003 for authentication, API, and database infrastructure

## Context

The initial design targeted children inside a household managed by parents and reserved runtime
structures for generative AI. The V1 audience is now overseas Chinese teenagers aged 13+ and
adults. That audience needs a direct account, stronger Pinyin instruction, age-neutral UX, and a
practical Chinese-name writing experience. The old relationship model and speculative AI surface
increase migration, privacy, authorization, and product complexity without serving V1.

## Decision

V1 uses a strict one-to-one account-to-`public.profiles` model. Private records use `user_id` and
forced PostgreSQL RLS with the authenticated API transaction identity. Parent, Child, Household,
Guardian, family roles, learner switching,
consent workflows, parent gates, and parent reports are removed.

V1 contains no generative-AI runtime code, provider SDK, prompt, AI function, moderation pipeline,
AI configuration, AI entitlement, AI quota, or placeholder abstraction. Future exploration is
documentation-only in `docs/backlog/FUTURE_PREMIUM_AI.md`.

Pinyin becomes a first-class deterministic learning domain with content, exercise types, mastery,
diagnosis, review, and support fading. V1 adds writing and deterministic signature practice for
the user's own Chinese name. Humor is human-authored, reviewed static curriculum with a neutral
fallback.

## Why remove Parent/Child/Household

A one-person account makes identity, ownership, RLS, onboarding, navigation, deletion, and sync
unambiguous. It avoids role escalation and cross-household authorization risk and matches the 13+
and adult audience.

## Why remove AI completely

No V1 learning outcome requires generation. Removing AI reduces privacy exposure, moderation
failure modes, variable cost, nondeterminism, network dependence, and editorial inconsistency.
Static stories, hints, humor, and reports are testable and available offline.

## Why not prebuild AI entitlement

An unused entitlement system creates product coupling, payment/privacy assumptions, dead code, and
security surface. If future evidence supports premium AI, it will receive a separate ADR, threat
model, data-flow review, and migration.

## Why Pinyin is first-class

The audience may speak Mandarin yet lack either Pinyin or Hanzi literacy. Pinyin has distinct
initial/final/tone knowledge and can scaffold Hanzi recognition. Treating it as decoration cannot
measure mastery or correctly reduce evidence after a hint.

## Why raw signature trajectories remain local

Stroke trajectories are sensitive behavioral data and are unnecessary for cross-device V1
outcomes. Local storage minimizes collection and breach impact. The server may store only project
metadata, practice counts, score summaries, and selected style.

## Why humor is static and editorial

Static humor preserves the exact learning target and answer, supports neutral fallback, works
offline, and can be reviewed for tone, stereotypes, etymology, and age suitability.

## Rejected alternatives

- Keep household tables but use one member: rejected as misleading complexity.
- Rename Child to Learner while retaining roles: rejected because V1 has no multi-user use case.
- Keep dormant AI interfaces or flags: rejected as speculative runtime architecture.
- Generate signatures with AI: rejected for privacy, imitation, nondeterminism, and authentication
  confusion.
- Upload raw strokes by default: rejected under data minimization.
- Put Pinyin only above Hanzi: rejected because it cannot support independent diagnosis or mastery.

## Database impact

2.2R replaces household/child keys with `profiles.id` and `user_id`, rewrites cross-user RLS, and
removes AI types/tables. Existing development data requires an explicit
export/map/reseed decision; old migrations are not edited destructively during P0.

## Mobile impact

Parent routes, child creation, parent gate, and learner switching are removed. Generic auth logic
is retained and renamed. Navigation becomes Learning, Pinyin, Writing, Review, and Me. Onboarding
creates one profile.

## Learning-engine impact

BKT, memory stability, confusion risk, and Task 3.4 session planning remain. 3.5R replaces the old
diagnostic with Pinyin/Hanzi axes; 3.6R adds deterministic evidence weighting after Pinyin hints;
3.7R feeds Pinyin candidates into session planning.

## Privacy impact

The design removes relationship and child-consent data, AI provider data flows, and default raw
stroke uploads. Private rows remain protected by cross-user RLS tests. Chinese-name and writing
data stay purpose-limited.

## Migration risks

Database identifiers, RLS helpers, routes, tests, fixtures, reports, and copy are deeply coupled to
the old model. Removing AI from ordered migrations may require a new clean V1 baseline rather than
editing deployed history. Content needs Pinyin and humor metadata without changing answer keys.

## Reversibility

The single-user schema can later add explicitly justified collaboration through new join tables
without changing profile ownership. AI could be reconsidered only through a new ADR and isolated
server architecture. Local stroke storage can later gain an opt-in encrypted sync design without
changing the normalized stroke model.
