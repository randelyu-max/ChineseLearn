# ADR 0001: Versioned shared API contracts

- Status: Accepted
- Date: 2026-07-22
- Scope: Task 0.2

## Context

Mobile, admin, and Edge Functions need one runtime-validated representation for identifiers,
timestamps, versions, responses, and errors. The design baseline includes an unversioned error
example, while repository rules require a consistent versioned shape and separate child-safe text.

## Decision

1. `packages/contracts` owns Zod schemas and derives TypeScript types from them.
2. API responses use `apiVersion: "v1"`; errors also use `schemaVersion: "error-v1"`.
3. Legacy payloads that omit these two fields are accepted and normalized to the current version.
4. Explicit unknown versions and unknown object fields are rejected at trust boundaries.
5. Error `message` is technical. Child UI may use only an explicitly authored `childMessage`.
6. Mutation-specific contracts will reuse `IdempotencyKeySchema` in later tasks.
7. The package remains runtime-neutral: no UI, database, Node-only, or network imports.
8. Private workspace consumers resolve TypeScript source. The build output is verification output,
   not a published package contract.

## Consequences

- Consumers must parse untrusted input before use.
- Breaking protocol changes require a new explicit schema version rather than widening `v1`.
- Supporting omitted version fields is a documented migration path, not permission to accept
  arbitrary legacy fields.
- Endpoint-specific requests, responses, and error-code enums remain outside Task 0.2.
