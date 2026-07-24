# HanziQuest V1 privacy notice

Last updated: 2026-07-23

HanziQuest is a single-user Chinese-learning application for people aged 13 and over.

## Data used by the service

The account service processes an email address, secure session data, profile preferences, and
private learning records such as sessions, attempts, skill state, review schedules, and derived
practice summaries. These records are attached directly to the authenticated user ID and protected
by forced PostgreSQL row-level security.

## Writing practice

Raw pen or touch trajectories and rendered signature images remain in local device storage. They
are not used for identity verification, biometric identification, forensic comparison, or
imitation of another person's signature. If synchronization is enabled, the server receives only
bounded derived practice metrics and never the raw points or image.

## Offline storage

The app stores downloaded curriculum, session snapshots, pending attempt events, synchronization
cursors, and the user's own writing draft on the device. Authentication tokens use the platform's
secure storage. Clearing application data removes local-only records that have not been
synchronized.

## Data not collected in V1

HanziQuest does not request a precise birth date, school, address, family relationships, contacts,
location, microphone recordings, advertising identifiers, or payment information. It does not
sell personal data and does not use behavioural advertising.

## Static curriculum

Pinyin, Hanzi, hints, and optional light/playful text are bundled, versioned curriculum reviewed by
human editors. No learner text or learning record is sent to a generative content service.

## Retention, access, and deletion

Server records are retained while the account is active and according to the operator's documented
backup-retention period. Users may request access to or deletion of account data through the
operator's private support channel. The operator must publish that private contact before a public
store release; users should never post an email address, learning history, or writing data in a
public repository issue.

## Security

The mobile client cannot access the database directly. The API derives identity from the
authenticated session and uses least-privilege database grants plus forced row-level security.
Secrets are server-only and are not committed to the application repository.

Material changes to this notice require a new review date and an updated store listing.
