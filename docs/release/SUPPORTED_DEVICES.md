# HanziQuest V1 supported-device matrix

## Release target

| Platform   | Minimum target                        | Release check                                                                       |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Web        | Current Chrome, Edge, Safari, Firefox | Static Expo export plus browser smoke test                                          |
| Android    | Android 10+ phone/tablet              | Expo Android JavaScript export; signed device build required before store promotion |
| iOS/iPadOS | iOS/iPadOS 16+                        | Expo iOS JavaScript export; signed device build required before store promotion     |

The release design targets touch and keyboard interaction, dynamic text scaling, reduced motion,
screen reader labels, and portrait layouts. Tablet support is enabled. Signed physical-device
validation remains required before promotion. Audio exercises use bundled assets and do not
request microphone permission.

## Performance budgets

- Web JavaScript entry bundle: no more than 3 MiB uncompressed for V1.
- Main deterministic learning operations: synchronous and free of network/database access.
- Session planning and diagnostics: bounded by explicit item/time limits.
- Offline outbox batch: no more than 50 attempts per API request.

Native signing, physical-device audio output, and store review remain promotion checks because they
require Apple/Google credentials and real devices; they are not represented as passed by a
JavaScript export.
