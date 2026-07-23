import { z } from 'zod';

const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const VERSION_TAG_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SCHEMA_VERSION_PATTERN = /^[a-z][a-z0-9-]*-v[1-9]\d*$/;

export const API_VERSION = 'v1' as const;
export const ERROR_SCHEMA_VERSION = 'error-v1' as const;

export const ApiVersionSchema = z.literal(API_VERSION);
export const SemanticVersionSchema = z
  .string()
  .max(64)
  .regex(SEMANTIC_VERSION_PATTERN, 'Expected a semantic version such as 1.0.0.');
export const VersionTagSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(
    VERSION_TAG_PATTERN,
    'Version tags must use lowercase letters, numbers, dots, or hyphens.',
  );
export const SchemaVersionSchema = z
  .string()
  .max(64)
  .regex(SCHEMA_VERSION_PATTERN, 'Schema versions must use a name-vN form.');

export type ApiVersion = z.infer<typeof ApiVersionSchema>;
export type SemanticVersion = z.infer<typeof SemanticVersionSchema>;
export type VersionTag = z.infer<typeof VersionTagSchema>;
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;
