import {
  SessionActivitySnapshotV2Schema,
  learningExerciseV2Fixtures,
  type AttemptDraftV2,
  type EvidenceTargetV1,
  type SessionActivitySnapshotV2,
} from '@hanziquest/contracts';
import { describe, expect, it } from 'vitest';

import {
  answerMatchesExerciseV2,
  evaluateAttemptV2,
  supportStateMatchesActivityV2,
} from './attempt-processing-v2.js';

const exercise = learningExerciseV2Fixtures[0]!;
const target = {
  schemaVersion: 'evidence-target-v1',
  conceptType: 'character',
  conceptId: 'concept.hanzi.shui',
  skill: 'audio_to_glyph',
  abilityAxis: 'hanzi_recognition',
  role: 'primary',
} satisfies EvidenceTargetV1;

function activity(
  pinyinSupport: SessionActivitySnapshotV2['pinyinSupport'] = null,
  evidenceTargets: readonly EvidenceTargetV1[] = [target],
) {
  return SessionActivitySnapshotV2Schema.parse({
    schemaVersion: 'session-activity-v2',
    sessionActivityId: '20000000-0000-4000-8000-000000000001',
    sourceExerciseId: exercise.activityId,
    position: 0,
    exerciseType: exercise.type,
    contentRef: 'lesson.fixture.exercise.audio-to-glyph',
    contentVersion: 'fixture-v1',
    contentSha256: 'a'.repeat(64),
    exercise,
    evidenceTargets,
    pinyinSupport,
    humorContentRef: null,
    estimatedSeconds: 60,
  });
}

function draft(overrides: Partial<AttemptDraftV2> = {}): AttemptDraftV2 {
  return {
    attemptId: '20000000-0000-4000-8000-000000000002',
    sessionActivityId: '20000000-0000-4000-8000-000000000001',
    answer: { optionId: 'option.shui' },
    isCorrectClient: false,
    responseMs: 2_000,
    hintLevel: 'none',
    pinyinSupport: 'none',
    replayCount: 0,
    retryCount: 0,
    occurredAt: '2026-07-24T12:00:00Z',
    offlineSequence: 1,
    ...overrides,
  };
}

describe('Attempts V2 server evaluation', () => {
  it('ignores forged client correctness and scores the immutable answer', () => {
    const result = evaluateAttemptV2(draft({ isCorrectClient: false }), activity());
    expect(result.correct).toBe(true);
    expect(result.selectedValue).toBe(JSON.stringify(['option.shui']));
    expect(result.expectedValue).toBe(JSON.stringify(['option.shui']));
  });

  it('emits one explicit normalized row for each Evidence Target', () => {
    const secondary = {
      ...target,
      conceptId: 'concept.hanzi.he',
      role: 'secondary',
    } satisfies EvidenceTargetV1;
    const result = evaluateAttemptV2(draft(), activity(null, [target, secondary]));
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence.map((item) => item.conceptId)).toEqual([
      'concept.hanzi.shui',
      'concept.hanzi.he',
    ]);
    for (const evidence of result.evidence) {
      expect(evidence.effectiveQuality).toBeCloseTo(
        evidence.baseQuality * evidence.supportMultiplier,
        12,
      );
    }
  });

  it('reduces independent Hanzi quality when fixed Pinyin was visible', () => {
    const visible = activity({
      profileMode: 'always',
      allowReveal: true,
      fadeStage: 0,
      initialEvidenceSupport: 'pinyin_visible',
      presentation: 'visible',
      reason: 'preference_always',
    });
    expect(supportStateMatchesActivityV2(draft(), visible)).toBe(false);
    const supported = evaluateAttemptV2(draft({ pinyinSupport: 'pinyin_visible' }), visible);
    const independent = evaluateAttemptV2(draft(), activity());
    expect(supported.evidence[0]!.effectiveQuality).toBeLessThan(
      independent.evidence[0]!.effectiveQuality,
    );
  });

  it('rejects impossible support state and mismatched answer shapes', () => {
    expect(
      supportStateMatchesActivityV2(draft({ pinyinSupport: 'pinyin_revealed' }), activity()),
    ).toBe(false);
    expect(
      answerMatchesExerciseV2(draft({ answer: { tileIds: ['tile.one'] } }), activity().exercise),
    ).toBe(false);
  });
});
