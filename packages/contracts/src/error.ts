import { z } from 'zod';

import { RequestIdSchema } from './ids.ts';
import {
  API_VERSION,
  ERROR_SCHEMA_VERSION,
  ApiVersionSchema,
  SchemaVersionSchema,
} from './version.ts';

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

export const ErrorCodeSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(ERROR_CODE_PATTERN, 'Error codes must use UPPER_SNAKE_CASE.');

export const ApiErrorSchema = z
  .object({
    schemaVersion: SchemaVersionSchema.pipe(z.literal(ERROR_SCHEMA_VERSION)).default(
      ERROR_SCHEMA_VERSION,
    ),
    code: ErrorCodeSchema,
    message: z.string().trim().min(1).max(500),
    retryable: z.boolean(),
    requestId: RequestIdSchema,
    childMessage: z.string().trim().min(1).max(200).optional(),
    retryAfterSeconds: z.number().int().min(0).max(86_400).optional(),
  })
  .strict()
  .superRefine((error, context) => {
    if (!error.retryable && error.retryAfterSeconds !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'retryAfterSeconds is allowed only when retryable is true.',
        path: ['retryAfterSeconds'],
      });
    }
  });

export const ApiErrorResponseSchema = z
  .object({
    apiVersion: ApiVersionSchema.default(API_VERSION),
    error: ApiErrorSchema,
  })
  .strict();

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorInput = z.input<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiErrorResponseInput = z.input<typeof ApiErrorResponseSchema>;
