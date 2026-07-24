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

function pinyinActivity(
  fixtureIndex: 4 | 5 | 6 | 7 | 8 | 9,
  evidenceTargets?: readonly EvidenceTargetV1[],
): SessionActivitySnapshotV2 {
  const pinyinExercise = learningExerciseV2Fixtures[fixtureIndex];
  const primary = {
    schemaVersion: 'evidence-target-v1',
    conceptType: 'pinyin',
    conceptId: `pinyin.fixture.${fixtureIndex}`,
    skill: pinyinExercise.type,
    abilityAxis:
      pinyinExercise.type === 'tone_choice' ? 'tone_discrimination' : 'pinyin_recognition',
    role: 'primary',
  } satisfies EvidenceTargetV1;
  return SessionActivitySnapshotV2Schema.parse({
    schemaVersion: 'session-activity-v2',
    sessionActivityId: '20000000-0000-4000-8000-000000000001',
    sourceExerciseId: pinyinExercise.activityId,
    position: 0,
    exerciseType: pinyinExercise.type,
    contentRef: `lesson.fixture.${pinyinExercise.activityId}`,
    contentVersion: 'fixture-v1',
    contentSha256: 'b'.repeat(64),
    exercise: pinyinExercise,
    evidenceTargets: evidenceTargets ?? [primary],
    pinyinSupport: null,
    humorContentRef: null,
    estimatedSeconds: 60,
  });
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

  it.each([
    [4, { optionId: 'option.ma3' }, { optionId: 'option.ma1' }],
    [5, { optionId: 'option.audio-ma2' }, { optionId: 'option.audio-ma1' }],
    [6, { optionId: 'option.glyph-ma' }, { optionId: 'option.glyph-mother' }],
    [7, { optionId: 'option.hang2' }, { optionId: 'option.hang4' }],
    [8, { optionId: 'tone.5' }, { optionId: 'tone.4' }],
    [
      9,
      { tileIds: ['initial.x', 'final.ue', 'build-tone.2'] },
      { tileIds: ['initial.q', 'final.ue', 'build-tone.2'] },
    ],
  ] as const)(
    'server-scores Pinyin fixture %s from its immutable answer key',
    (fixtureIndex, correctAnswer, wrongAnswer) => {
      const snapshot = pinyinActivity(fixtureIndex);
      const normalizedCorrect =
        'tileIds' in correctAnswer ? { tileIds: [...correctAnswer.tileIds] } : correctAnswer;
      const normalizedWrong =
        'tileIds' in wrongAnswer ? { tileIds: [...wrongAnswer.tileIds] } : wrongAnswer;
      const correct = evaluateAttemptV2(draft({ answer: normalizedCorrect }), snapshot);
      const wrong = evaluateAttemptV2(draft({ answer: normalizedWrong }), snapshot);
      expect(correct.correct).toBe(true);
      expect(wrong.correct).toBe(false);
      expect(correct.evidence[0]?.algorithmVersion).toContain('pinyin-scoring-v1');
    },
  );

  it('accepts only the context-specific reading for a polyphonic glyph', () => {
    const snapshot = pinyinActivity(7);
    expect(
      evaluateAttemptV2(draft({ answer: { optionId: 'option.hang2' } }), snapshot).correct,
    ).toBe(true);
    expect(
      evaluateAttemptV2(draft({ answer: { optionId: 'option.xing2' } }), snapshot).correct,
    ).toBe(false);
  });

  it('keeps Pinyin evidence whole and discounts Hanzi transfer from a visible Pinyin cue', () => {
    const pinyinExercise = learningExerciseV2Fixtures[6]!;
    const targets = [
      {
        schemaVersion: 'evidence-target-v1',
        conceptType: 'pinyin',
        conceptId: 'pinyin.syllable.ma3',
        skill: pinyinExercise.type,
        abilityAxis: 'pinyin_recognition',
        role: 'primary',
      },
      {
        schemaVersion: 'evidence-target-v1',
        conceptType: 'character',
        conceptId: 'character.ma',
        skill: pinyinExercise.type,
        abilityAxis: 'hanzi_recognition',
        role: 'transfer',
      },
    ] satisfies readonly EvidenceTargetV1[];
    const result = evaluateAttemptV2(
      draft({ answer: { optionId: 'option.glyph-ma' } }),
      pinyinActivity(6, targets),
    );
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]?.supportMultiplier).toBe(1);
    expect(result.evidence[1]?.supportMultiplier).toBe(0.75);
    expect(result.evidence[1]?.effectiveQuality).toBeLessThan(
      result.evidence[0]?.effectiveQuality ?? 0,
    );
  });

  it.each([4, 5, 6, 7, 8] as const)(
    'rejects a tile answer for Pinyin option fixture %s',
    (fixtureIndex) => {
      expect(
        answerMatchesExerciseV2(
          draft({ answer: { tileIds: ['illegal.tile'] } }),
          pinyinActivity(fixtureIndex).exercise,
        ),
      ).toBe(false);
    },
  );

  it('rejects an option answer for the three-part Pinyin assembly exercise', () => {
    expect(
      answerMatchesExerciseV2(
        draft({ answer: { optionId: 'initial.x' } }),
        pinyinActivity(9).exercise,
      ),
    ).toBe(false);
  });
});
