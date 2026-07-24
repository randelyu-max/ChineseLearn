import { describe, expect, it } from 'vitest';

import { learningExerciseV2Fixtures } from './exercise-v2.fixtures.ts';
import { EvidenceTargetV1Schema, SessionActivitySnapshotV2Schema } from './session-activity-v2.ts';
import {
  SessionPlanRequestV2Schema,
  SessionPlanResultV2Schema,
  SessionPlanSnapshotV2Schema,
} from './session-plan-v2.ts';

const hash = 'a'.repeat(64);
const evidence = {
  schemaVersion: 'evidence-target-v1',
  conceptType: 'character',
  conceptId: 'concept.water',
  skill: 'audio_to_glyph',
  abilityAxis: 'hanzi_recognition',
  role: 'primary',
} as const;

const activity = {
  schemaVersion: 'session-activity-v2',
  sessionActivityId: '10000000-0000-4000-8000-000000000001',
  sourceExerciseId: learningExerciseV2Fixtures[0].activityId,
  position: 0,
  exerciseType: learningExerciseV2Fixtures[0].type,
  contentRef: 'lesson.water.activity.1',
  contentVersion: '1.0.0',
  contentSha256: hash,
  exercise: learningExerciseV2Fixtures[0],
  evidenceTargets: [evidence],
  pinyinSupport: {
    profileMode: 'adaptive',
    allowReveal: true,
    fadeStage: 1,
    initialEvidenceSupport: 'none',
    presentation: 'tap_to_reveal',
    reason: 'partial_fade',
  },
  humorContentRef: null,
  estimatedSeconds: 60,
} as const;

describe('Session Activity V2', () => {
  it('accepts an immutable activity payload with explicit evidence', () => {
    expect(SessionActivitySnapshotV2Schema.parse(activity)).toEqual(activity);
  });

  it('rejects empty, duplicate, and primary-free evidence targets', () => {
    expect(
      SessionActivitySnapshotV2Schema.safeParse({ ...activity, evidenceTargets: [] }).success,
    ).toBe(false);
    expect(
      SessionActivitySnapshotV2Schema.safeParse({
        ...activity,
        evidenceTargets: [evidence, evidence],
      }).success,
    ).toBe(false);
    expect(
      SessionActivitySnapshotV2Schema.safeParse({
        ...activity,
        evidenceTargets: [{ ...evidence, role: 'secondary' }],
      }).success,
    ).toBe(false);
  });

  it('rejects content hash, type, and source mismatches', () => {
    expect(
      SessionActivitySnapshotV2Schema.safeParse({
        ...activity,
        contentSha256: 'ABC',
      }).success,
    ).toBe(false);
    expect(
      SessionActivitySnapshotV2Schema.safeParse({
        ...activity,
        exerciseType: 'glyph_to_image',
      }).success,
    ).toBe(false);
    expect(
      SessionActivitySnapshotV2Schema.safeParse({
        ...activity,
        sourceExerciseId: 'exercise.other',
      }).success,
    ).toBe(false);
  });

  it('keeps evidence ownership-free and strict', () => {
    expect(EvidenceTargetV1Schema.safeParse({ ...evidence, userId: 'forged' }).success).toBe(false);
  });
});

describe('Session Plan V2', () => {
  it('accepts learn and review intents without accepting an ownership field', () => {
    const base = {
      schemaVersion: 'session-plan-request-v2',
      clientSessionId: '20000000-0000-4000-8000-000000000001',
      idempotencyKey: 'session-plan-v2:20000000-0000-4000-8000-000000000001',
      targetMinutes: 10,
    } as const;
    expect(SessionPlanRequestV2Schema.safeParse({ ...base, intent: 'learn' }).success).toBe(true);
    expect(SessionPlanRequestV2Schema.safeParse({ ...base, intent: 'review' }).success).toBe(true);
    expect(
      SessionPlanRequestV2Schema.safeParse({ ...base, intent: 'learn', userId: 'forged' }).success,
    ).toBe(false);
  });

  it('enforces contiguous positions and total duration', () => {
    const snapshot = {
      schemaVersion: 'session-plan-snapshot-v2',
      sessionId: '30000000-0000-4000-8000-000000000001',
      clientSessionId: '20000000-0000-4000-8000-000000000001',
      intent: 'learn',
      curriculumVersionId: '40000000-0000-4000-8000-000000000001',
      contentManifestSha256: 'b'.repeat(64),
      humorContentVersion: '1.0.0',
      humorPreference: 'light',
      planningAlgorithmVersion: 'session-planner-v2',
      targetMinutes: 10,
      estimatedSeconds: 60,
      createdAt: '2026-07-24T10:00:00.000Z',
      activities: [activity],
    } as const;
    expect(SessionPlanSnapshotV2Schema.parse(snapshot)).toEqual(snapshot);
    expect(
      SessionPlanSnapshotV2Schema.safeParse({
        ...snapshot,
        estimatedSeconds: 61,
      }).success,
    ).toBe(false);
    expect(
      SessionPlanSnapshotV2Schema.safeParse({
        ...snapshot,
        activities: [{ ...activity, position: 1 }],
      }).success,
    ).toBe(false);
    expect(
      SessionPlanResultV2Schema.parse({
        schemaVersion: 'session-plan-result-v2',
        result: 'planned',
        session: {
          sessionId: snapshot.sessionId,
          clientSessionId: snapshot.clientSessionId,
          status: 'planned',
          createdAt: snapshot.createdAt,
          snapshot,
        },
      }).result,
    ).toBe('planned');
    expect(
      SessionPlanResultV2Schema.parse({
        schemaVersion: 'session-plan-result-v2',
        result: 'nothing_due',
        session: null,
      }).session,
    ).toBeNull();
  });
});
