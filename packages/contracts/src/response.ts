import { z } from 'zod';

import { RequestIdSchema } from './ids.ts';
import { UtcDateTimeSchema } from './time.ts';
import { API_VERSION, ApiVersionSchema } from './version.ts';

export const ApiResponseMetaSchema = z
  .object({
    requestId: RequestIdSchema,
    respondedAt: UtcDateTimeSchema,
  })
  .strict();

export const EmptyResponseDataSchema = z.object({}).strict();

export function createApiSuccessResponseSchema<TDataSchema extends z.ZodType>(
  dataSchema: TDataSchema,
) {
  return z
    .object({
      apiVersion: ApiVersionSchema.default(API_VERSION),
      data: dataSchema,
      meta: ApiResponseMetaSchema,
    })
    .strict();
}

export type ApiResponseMeta = z.infer<typeof ApiResponseMetaSchema>;
export type EmptyResponseData = z.infer<typeof EmptyResponseDataSchema>;
