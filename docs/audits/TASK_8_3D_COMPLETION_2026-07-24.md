# Task 8.3D completion report

Date: 2026-07-24

Status: complete

Next allowed task: 8.3E

## Delivered

- Added the authenticated onboarding diagnostic route with start, pause, same-device resume,
  skip, offline progress, completion, supportive result copy, and a home resume entry.
- Added a fixed 36-item `diagnostic-content-v1.0.0` pack covering all six `diagnostic-v1` axes.
  Listening and tone items use operating-system Mandarin speech and never record the learner.
- Added strict `diagnostic-run-v1` contracts and an authenticated GET/POST API. Requests never
  accept a user ID.
- Added migration `0013_diagnostic_runs.sql` with forced RLS, one-active-run enforcement,
  idempotency keys, terminal immutability, bounded version fields, and cascade deletion.
- Stores only a strict result summary or skip marker. No raw audio, answer-by-answer history, or
  sensitive profile text is persisted on the server.
- Session Plan V2 uses the latest completed diagnostic only while there are no accepted Attempts.
  It applies the initial ability estimate, Pinyin support recommendation, starting-domain boost,
  and a 2–4 new-concept cap. A skip uses adaptive Pinyin support and a two-concept cap.
- The first accepted Attempt switches planning back to authoritative Evidence and removes every
  diagnostic prior decision.

## Versions

- Algorithm: unchanged `diagnostic-v1`.
- Content: `diagnostic-content-v1.0.0`.
- API/local contract: `diagnostic-run-v1` / `local-diagnostic-v1`.
- Database: forward-only migration `0013_diagnostic_runs.sql`.
- Session planner materializer version is unchanged; this task changes only its initial
  authoritative input policy.

## Verification

- Contracts: 16 files, 83 tests passed.
- API: 14 files, 76 tests passed.
- Mobile: 44 files, 206 tests passed.
- API, mobile, and contracts typechecks passed.
- Formatting and all eight workspace lint tasks passed.
- PostgreSQL static validation passed for 13 immutable migrations.
- The local PostgreSQL migration applied and the dynamic integration suite passed, including
  diagnostic persistence, idempotent terminal replay, forged-user insertion denial, and
  cross-user read denial.
- Final full validation exited with code 0: 99 test files and 518 tests passed across all eight
  workspaces. Content validation, all builds, and the Expo web export passed; Expo generated 24
  static routes and a 2.3 MB JavaScript bundle.

## Compatibility and rollback

- The migration is additive and does not rewrite migrations `0001`–`0012`.
- Existing users without a diagnostic row keep the previous balanced planning defaults.
- Existing accepted Attempts remain authoritative and ignore diagnostic priors.
- Before deployment, omit `0013` and revert this task. After deployment, first undeploy the
  diagnostic route and planner read; retain the table, or use a reviewed forward migration or a
  verified database restore. Never edit an applied migration.

## Remaining risks

- Automated checks and Expo web export do not replace physical VoiceOver/TalkBack or signed native
  verification.
- System TTS availability and pronunciation vary by device. Human audio/editorial review remains a
  separate release gate; this task does not claim studio audio approval.
- Pause/resume is intentionally same-device. The server stores only the bounded summary, not
  answer-level state, so an unfinished run cannot resume on another device.
- Production curriculum import remains Task 8.3E.
