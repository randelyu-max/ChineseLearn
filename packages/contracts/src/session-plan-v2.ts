import { z } from 'zod';

import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import {
  MAX_SESSION_ACTIVITIES_V2,
  SessionActivitySnapshotV2Schema,
  Sha256HexSchema,
} from './session-activity-v2.ts';
import { SessionPlanSnapshotSchema } from './session-plan.ts';
import { createApiSuccessResponseSchema } from './response.ts';
import { UtcDateTimeSchema } from './time.ts';
import { PINYIN_EXERCISES_CLIENT_CAPABILITY } from './pinyin-session-material.ts';

export const SESSION_PLAN_REQUEST_V2_SCHEMA_VERSION = 'session-plan-request-v2' as const;
export const SESSION_PLAN_SNAPSHOT_V2_SCHEMA_VERSION = 'session-plan-snapshot-v2' as const;
export const SESSION_PLAN_RESULT_V2_SCHEMA_VERSION = 'session-plan-result-v2' as const;

export const SessionIntentSchema = z.enum(['learn', 'review']);

export const SessionPlanRequestV2Schema = z
  .object({
    schemaVersion: z.literal(SESSION_PLAN_REQUEST_V2_SCHEMA_VERSION),
    clientSessionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    intent: SessionIntentSchema,
    targetMinutes: z.number().int().min(3).max(20),
    clientCapabilities: z.array(z.literal(PINYIN_EXERCISES_CLIENT_CAPABILITY)).max(8).optional(),
  })
  .strict();

export const SessionPlanSnapshotV2Schema = z
  .object({
    schemaVersion: z.literal(SESSION_PLAN_SNAPSHOT_V2_SCHEMA_VERSION),
    sessionId: UuidSchema,
    clientSessionId: UuidSchema,
    intent: SessionIntentSchema,
    curriculumVersionId: UuidSchema,
    contentManifestSha256: Sha256HexSchema,
    humorContentVersion: z.string().trim().min(1).max(64).nullable(),
    humorPreference: z.enum(['off', 'light', 'playful']),
    planningAlgorithmVersion: z.string().trim().min(1).max(80),
    targetMinutes: z.number().int().min(3).max(20),
    estimatedSeconds: z.number().int().min(10).max(6_000),
    createdAt: UtcDateTimeSchema,
    activities: z.array(SessionActivitySnapshotV2Schema).min(1).max(MAX_SESSION_ACTIVITIES_V2),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const positions = snapshot.activities.map((activity) => activity.position);
    if (new Set(positions).size !== positions.length) {
      context.addIssue({
        code: 'custom',
        message: 'Activity positions must be unique.',
        path: ['activities'],
      });
    }
    if (
      [...positions]
        .sort((left, right) => left - right)
        .some((position, index) => position !== index)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Activity positions must be contiguous and zero-based.',
        path: ['activities'],
      });
    }
    const activityIds = snapshot.activities.map((activity) => activity.sessionActivityId);
    if (new Set(activityIds).size !== activityIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Session activity IDs must be unique.',
        path: ['activities'],
      });
    }
    const calculatedSeconds = snapshot.activities.reduce(
      (total, activity) => total + activity.estimatedSeconds,
      0,
    );
    if (calculatedSeconds !== snapshot.estimatedSeconds) {
      context.addIssue({
        code: 'custom',
        message: 'Estimated seconds must equal the activity duration sum.',
        path: ['estimatedSeconds'],
      });
    }
  });

const PlannedSessionV2Schema = z
  .object({
    sessionId: UuidSchema,
    clientSessionId: UuidSchema,
    status: z.literal('planned'),
    createdAt: UtcDateTimeSchema,
    snapshot: SessionPlanSnapshotV2Schema,
  })
  .strict();

const ActiveSessionPlanSchema = z
  .object({
    sessionId: UuidSchema,
    clientSessionId: UuidSchema,
    status: z.enum(['planned', 'in_progress']),
    createdAt: UtcDateTimeSchema,
    snapshot: z.union([SessionPlanSnapshotSchema, SessionPlanSnapshotV2Schema]),
  })
  .strict();

export const SessionPlanResultV2Schema = z.discriminatedUnion('result', [
  z
    .object({
      schemaVersion: z.literal(SESSION_PLAN_RESULT_V2_SCHEMA_VERSION),
      result: z.literal('planned'),
      session: PlannedSessionV2Schema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(SESSION_PLAN_RESULT_V2_SCHEMA_VERSION),
      result: z.literal('active_session_exists'),
      session: ActiveSessionPlanSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(SESSION_PLAN_RESULT_V2_SCHEMA_VERSION),
      result: z.literal('nothing_due'),
      session: z.null(),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(SESSION_PLAN_RESULT_V2_SCHEMA_VERSION),
      result: z.literal('insufficient_safe_content'),
      session: z.null(),
    })
    .strict(),
]);

export const SessionPlanV2SuccessResponseSchema =
  createApiSuccessResponseSchema(SessionPlanResultV2Schema);

export type SessionIntent = z.infer<typeof SessionIntentSchema>;
export type SessionPlanRequestV2 = z.infer<typeof SessionPlanRequestV2Schema>;
export type SessionPlanSnapshotV2 = z.infer<typeof SessionPlanSnapshotV2Schema>;
export type SessionPlanResultV2 = z.infer<typeof SessionPlanResultV2Schema>;
export type SessionPlanV2SuccessResponse = z.infer<typeof SessionPlanV2SuccessResponseSchema>;
