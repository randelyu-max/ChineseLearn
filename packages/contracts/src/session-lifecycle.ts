import { z } from 'zod';

import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import { SessionActivitySnapshotV2Schema } from './session-activity-v2.ts';
import { SessionPlanSnapshotV2Schema } from './session-plan-v2.ts';
import { SessionPlanSnapshotSchema } from './session-plan.ts';
import { UtcDateTimeSchema } from './time.ts';

export const ACTIVE_SESSION_SCHEMA_VERSION = 'active-session-v1' as const;
export const SESSION_LIFECYCLE_REQUEST_SCHEMA_VERSION = 'session-lifecycle-request-v1' as const;
export const SESSION_LIFECYCLE_SCHEMA_VERSION = 'session-lifecycle-v1' as const;

export const SessionLifecycleStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'abandoned',
]);
export const SessionLifecycleActionSchema = z.enum(['start', 'complete', 'abandon']);

export const SessionLifecycleRequestSchema = z
  .object({
    schemaVersion: z.literal(SESSION_LIFECYCLE_REQUEST_SCHEMA_VERSION),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict();

export const SessionAbandonRequestSchema = SessionLifecycleRequestSchema.extend({
  reasonCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
}).strict();

export const SessionLifecycleStateSchema = z
  .object({
    schemaVersion: z.literal(SESSION_LIFECYCLE_SCHEMA_VERSION),
    sessionId: UuidSchema,
    status: SessionLifecycleStatusSchema,
    startedAt: UtcDateTimeSchema.nullable(),
    completedAt: UtcDateTimeSchema.nullable(),
    abandonedAt: UtcDateTimeSchema.nullable(),
    abandonedReason: z.string().trim().min(1).max(200).nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.status === 'planned') {
      if (
        state.startedAt !== null ||
        state.completedAt !== null ||
        state.abandonedAt !== null ||
        state.abandonedReason !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'A planned session cannot have lifecycle completion timestamps.',
          path: ['status'],
        });
      }
    }
    if (state.status === 'in_progress' && state.startedAt === null) {
      context.addIssue({
        code: 'custom',
        message: 'An in-progress session requires a server start time.',
        path: ['startedAt'],
      });
    }
    if (
      state.status === 'completed' &&
      (state.startedAt === null || state.completedAt === null || state.abandonedAt !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A completed session requires start and completion times only.',
        path: ['completedAt'],
      });
    }
    if (state.status === 'abandoned' && state.abandonedAt === null) {
      context.addIssue({
        code: 'custom',
        message: 'An abandoned session requires a server abandonment time.',
        path: ['abandonedAt'],
      });
    }
    if (state.status !== 'abandoned' && state.abandonedReason !== null) {
      context.addIssue({
        code: 'custom',
        message: 'Only an abandoned session may have an abandonment reason.',
        path: ['abandonedReason'],
      });
    }
  });

const ActiveSessionHeaderSchema = z
  .object({
    sessionId: UuidSchema,
    clientSessionId: UuidSchema,
    intent: z.enum(['learn', 'review']),
    status: z.enum(['planned', 'in_progress']),
    targetMinutes: z.number().int().min(3).max(60),
    snapshotSchemaVersion: z
      .enum(['session-plan-snapshot-v1', 'session-plan-snapshot-v2'])
      .nullable(),
    curriculumVersionId: UuidSchema,
    createdAt: UtcDateTimeSchema,
    startedAt: UtcDateTimeSchema.nullable(),
  })
  .strict();

const ActiveSessionSnapshotSchema = z
  .object({
    plan: z.union([SessionPlanSnapshotSchema, SessionPlanSnapshotV2Schema]),
    activities: z.array(SessionActivitySnapshotV2Schema).max(20),
  })
  .strict();

export const ActiveSessionDataSchema = z.discriminatedUnion('availability', [
  z
    .object({
      schemaVersion: z.literal(ACTIVE_SESSION_SCHEMA_VERSION),
      availability: z.literal('none'),
      session: z.null(),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(ACTIVE_SESSION_SCHEMA_VERSION),
      availability: z.literal('active'),
      session: z
        .object({
          header: ActiveSessionHeaderSchema,
          snapshot: ActiveSessionSnapshotSchema,
        })
        .strict(),
    })
    .strict(),
]);

export type ActiveSessionData = z.infer<typeof ActiveSessionDataSchema>;
export type SessionLifecycleAction = z.infer<typeof SessionLifecycleActionSchema>;
export type SessionLifecycleRequest = z.infer<typeof SessionLifecycleRequestSchema>;
export type SessionAbandonRequest = z.infer<typeof SessionAbandonRequestSchema>;
export type SessionLifecycleState = z.infer<typeof SessionLifecycleStateSchema>;
