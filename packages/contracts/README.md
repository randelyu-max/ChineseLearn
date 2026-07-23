# @hanziquest/contracts

Shared runtime contracts for every HanziQuest trust boundary. Schemas are the source of truth;
TypeScript types are derived with `z.infer` or `z.input` and must not be duplicated in apps.

## Public foundations

- IDs: UUID, request ID, and idempotency key.
- Time: UTC timestamp, offset-aware ISO timestamp, and ISO date.
- Versions: API `v1`, semantic versions, schema versions, and domain version tags.
- Pinyin: versioned initial/final/tone schemas, legal syllable combinations, and deterministic
  numbered/diacritic normalization.
- Responses: strict success response factory with request metadata.
- Errors: strict `v1` / `error-v1` error response.

## Error shape

```json
{
  "apiVersion": "v1",
  "error": {
    "schemaVersion": "error-v1",
    "code": "SESSION_EXPIRED",
    "message": "This learning session has expired.",
    "retryable": false,
    "requestId": "req_01J4Z6M3V6D8Q9W1K2Y7",
    "childMessage": "这一关需要重新开始。"
  }
}
```

`message` is technical and must never be rendered directly in the child experience. Only the
optional, deliberately authored `childMessage` is eligible for child UI. Logs must still avoid
tokens, child identity, raw speech, and other personal data.

For compatibility with the design baseline, parsers accept legacy responses that omit
`apiVersion` and `error.schemaVersion`; parsing normalizes them to `v1` and `error-v1`. Unknown
fields and unknown explicit versions are rejected.

## Usage

```ts
import { ApiErrorResponseSchema, createApiSuccessResponseSchema } from '@hanziquest/contracts';
import { z } from 'zod';

const HealthDataSchema = z.object({ status: z.literal('ok') }).strict();
const HealthResponseSchema = createApiSuccessResponseSchema(HealthDataSchema);

type HealthResponse = z.infer<typeof HealthResponseSchema>;
const error = ApiErrorResponseSchema.parse(untrustedInput);
```

## Consumers

- Mobile and admin declare `@hanziquest/contracts` as a `workspace:*` dependency and consume the
  private package directly from TypeScript source, so a clean clone does not require prebuilt
  `dist/` files before typechecking.
- The Node API imports the same workspace package directly. Trust-boundary parsing remains
  provider-neutral and uses the repository-pinned Zod version.
- `pnpm --filter @hanziquest/contracts build` still emits ESM output for build verification. The
  package remains private; publishing it would require a separate packaging decision.

## Exercise attempts

`AudioToGlyphExerciseSchema` and `AttemptDraftSchema` define the first P0 exercise boundary. Attempt
drafts are immutable client evidence intended for the persistent outbox. `isCorrectClient` is only a
client observation: the future `attempts-batch` server must load the saved activity plan and evaluate
the submitted option again before updating learning state or rewards. Replays, retry count, hint
level, response time, occurrence time, and offline sequence are retained without child identity or
free-text input.

## Pinyin normalization

`normalizePinyinSyllable` accepts one Mandarin syllable in numbered or diacritic form, normalizes
neutral tone to tone `5`, preserves `ü`, and returns its conventional initial/final analysis.
Impossible combinations and conflicting tone notation return `null`. The implementation is pure,
versioned as `pinyin-normalization-v1`, and does not infer pronunciation from English letter names.
