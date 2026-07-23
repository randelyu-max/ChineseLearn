import type { AttemptDraft, LearningExercise } from '@hanziquest/contracts';
import { describe, expect, it } from 'vitest';

import { answerMatchesExercise, evaluateAttempt, replaySkillState } from './attempt-processing.js';

const activityId = '70000000-0000-4000-8000-000000000001';
const correctOptionId = '70000000-0000-4000-8000-000000000002';
const wrongOptionId = '70000000-0000-4000-8000-000000000003';
const exercise = {
  activityId,
  type: 'audio_to_glyph',
  promptAudioAssetId: '70000000-0000-4000-8000-000000000004',
  targetConceptIds: ['70000000-0000-4000-8000-000000000005'],
  options: [
    { optionId: correctOptionId, glyph: '家', accessibilityLabel: '家' },
    { optionId: wrongOptionId, glyph: '门', accessibilityLabel: '门' },
  ],
  correctOptionId,
  visualHintZh: '想想家的声音。',
} satisfies LearningExercise;
const attempt = {
  attemptId: '70000000-0000-4000-8000-000000000006',
  activityId,
  answer: { optionId: wrongOptionId },
  isCorrectClient: true,
  responseMs: 1_000,
  hintLevel: 'none',
  replayCount: 0,
  retryCount: 0,
  occurredAt: '2026-07-23T10:00:00.000Z',
  offlineSequence: 1,
} satisfies AttemptDraft;

describe('authoritative attempt processing', () => {
  it('ignores client correctness and evaluates the reviewed exercise answer', () => {
    expect(answerMatchesExercise(attempt, exercise)).toBe(true);
    const evaluated = evaluateAttempt(attempt, exercise);
    expect(evaluated.correct).toBe(false);
    expect(evaluated.evidenceWeight).toBe(0);
    expect(evaluated.metadata.clientCorrectnessIgnored).toBe(true);
  });

  it('reduces independent Hanzi evidence after Pinyin support', () => {
    const unhinted = evaluateAttempt(
      { ...attempt, answer: { optionId: correctOptionId }, isCorrectClient: false },
      exercise,
    );
    const supported = evaluateAttempt(
      {
        ...attempt,
        answer: { optionId: correctOptionId },
        isCorrectClient: false,
        pinyinSupport: 'pinyin_revealed',
      },
      exercise,
    );
    expect(unhinted.correct).toBe(true);
    expect(supported.correct).toBe(true);
    expect(supported.evidenceWeight).toBeLessThan(unhinted.evidenceWeight);
  });

  it('replays out-of-order immutable events to the same skill state', () => {
    const earlier = {
      correct: false,
      deviceEventAt: new Date('2026-07-23T10:00:00.000Z'),
      evidenceWeight: 0,
      hintLevel: 0,
      id: 'a',
      offlineSequence: 1,
      pinyinSupport: 'none' as const,
    };
    const later = {
      correct: true,
      deviceEventAt: new Date('2026-07-23T10:01:00.000Z'),
      evidenceWeight: 1,
      hintLevel: 0,
      id: 'b',
      offlineSequence: 2,
      pinyinSupport: 'none' as const,
    };
    expect(replaySkillState([later, earlier], 'audio_to_glyph')).toEqual(
      replaySkillState([earlier, later], 'audio_to_glyph'),
    );
  });

  it('does not count Pinyin-supported answers as independent Hanzi successes', () => {
    const state = replaySkillState(
      [
        {
          correct: true,
          deviceEventAt: new Date('2026-07-23T10:00:00.000Z'),
          evidenceWeight: 0.45,
          hintLevel: 0,
          id: 'supported',
          offlineSequence: 1,
          pinyinSupport: 'pinyin_revealed',
        },
      ],
      'audio_to_glyph',
    );
    expect(state.independentCorrectCount).toBe(0);
    expect(state.hintedCorrectCount).toBe(1);
  });
});
