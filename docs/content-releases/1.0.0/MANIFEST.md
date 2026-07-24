# HanziQuest production Curriculum 1.0.0

- Release schema: `production-curriculum-release-v1`
- Import algorithm: `production-release-import-v1`
- Curriculum ID: `81000000-0000-4000-8000-000000000001`
- Spoken/script track: `mandarin` / `simplified`
- Minimum app version: `1.0.0`
- Manifest SHA-256:
  `57f6b18a90abc91799a74f9c8bf232586521709edf4587fd8151587a1a25dc81`
- Runtime source: `packages/curriculum/src/releases/production-v1.ts`

The manifest hash covers both the production release object and the approved Pinyin package.
Published rows and the import receipt are immutable. The active track is selected through
`active_curriculum_releases`, never by publication timestamp.
