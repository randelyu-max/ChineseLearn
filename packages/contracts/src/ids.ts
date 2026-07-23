import { z } from 'zod';

const REQUEST_ID_PATTERN = /^req_[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export const UuidSchema = z.uuid();

export const RequestIdSchema = z
  .string()
  .min(12)
  .max(80)
  .regex(REQUEST_ID_PATTERN, 'Request IDs must use the req_ prefix and URL-safe characters.');

export const IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(IDEMPOTENCY_KEY_PATTERN, 'Idempotency keys must use URL-safe printable characters.');

export type Uuid = z.infer<typeof UuidSchema>;
export type RequestId = z.infer<typeof RequestIdSchema>;
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
