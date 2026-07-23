import { describe, expect, it } from 'vitest';

import {
  buildPinyinToAudioExercise,
  createPinyinToAudioState,
  pinyinToAudioDemoExercise,
  pinyinToAudioLayout,
  pinyinToAudioReplayCount,
  recordPinyinToAudioPlayback,
  retryPinyinToAudio,
  selectPinyinToAudioOption,
} from './model';

const candidates = [
  {
    assetKey: 'ma2',
    numbered: 'ma2',
    optionId: '53000000-0000-4000-8000-000000000021',
  },
  {
    assetKey: 'ma3',
    numbered: 'ma3',
    optionId: '53000000-0000-4000-8000-000000000022',
  },
  {
    assetKey: 'ma4',
    numbered: 'ma4',
    optionId: '53000000-0000-4000-8000-000000000023',
  },
] as const;

function build(seed = 'fixed-seed') {
  return buildPinyinToAudioExercise({
    activityId: '53000000-0000-4000-8000-000000000030',
    candidates,
    seed,
    targetOptionId: candidates[0].optionId,
  });
}

describe('pinyin_to_audio interaction model', () => {
  it('builds the same offline exercise for a fixed seed', () => {
    expect(build()).toEqual(build());
    expect(build().options).toHaveLength(3);
    expect(build().options.every((option) => option.source === 'bundled')).toBe(true);
    expect(JSON.stringify(build())).not.toMatch(/https?:\/\//);
  });

  it('keeps the correct clip stable when option order changes', () => {
    const first = build('seed-a');
    const second = build('seed-b');
    expect(first.correctOptionId).toBe(candidates[0].optionId);
    expect(second.correctOptionId).toBe(candidates[0].optionId);
    expect(first.options.map((option) => option.optionId)).not.toEqual(
      second.options.map((option) => option.optionId),
    );
  });

  it('normalizes the prompt and exposes a spoken tone label', () => {
    expect(pinyinToAudioDemoExercise.prompt).toMatchObject({
      accessibilityLabel: 'má，第二声',
      display: 'má',
      numbered: 'ma2',
      tone: 2,
    });
  });

  it('tracks first play and replay per option without changing the answer', () => {
    const firstPlay = recordPinyinToAudioPlayback(
      build(),
      createPinyinToAudioState(),
      candidates[0].optionId,
    );
    const replay = recordPinyinToAudioPlayback(build(), firstPlay, candidates[0].optionId);
    expect(pinyinToAudioReplayCount(firstPlay, candidates[0].optionId)).toBe(0);
    expect(pinyinToAudioReplayCount(replay, candidates[0].optionId)).toBe(1);
    expect(replay.selectedOptionId).toBeNull();
  });

  it('requires successful playback before an option can be selected', () => {
    expect(() =>
      selectPinyinToAudioOption(build(), createPinyinToAudioState(), candidates[0].optionId),
    ).toThrow(/Listen/);
  });

  it('offers supportive retry after a wrong answer and preserves listen history', () => {
    const listened = recordPinyinToAudioPlayback(
      build(),
      createPinyinToAudioState(),
      candidates[1].optionId,
    );
    const wrong = selectPinyinToAudioOption(build(), listened, candidates[1].optionId);
    expect(wrong.status).toBe('incorrect-feedback');
    expect(retryPinyinToAudio(wrong)).toMatchObject({
      listenCounts: { [candidates[1].optionId]: 1 },
      retryCount: 1,
      selectedOptionId: null,
      status: 'awaiting-answer',
    });
  });

  it('marks only the stable target clip correct and locks the result', () => {
    const listened = recordPinyinToAudioPlayback(
      build(),
      createPinyinToAudioState(),
      candidates[0].optionId,
    );
    const correct = selectPinyinToAudioOption(build(), listened, candidates[0].optionId);
    expect(correct.status).toBe('correct-feedback');
    expect(selectPinyinToAudioOption(build(), correct, candidates[1].optionId)).toBe(correct);
    expect(recordPinyinToAudioPlayback(build(), correct, candidates[0].optionId)).toBe(correct);
  });

  it('rejects unknown clips, invalid Pinyin, and undersized exercises', () => {
    expect(() =>
      recordPinyinToAudioPlayback(build(), createPinyinToAudioState(), 'unknown'),
    ).toThrow(/does not belong/);
    expect(() =>
      buildPinyinToAudioExercise({
        activityId: 'invalid',
        candidates: [
          ...candidates.slice(0, 2),
          { assetKey: 'bad', numbered: 'not-pinyin', optionId: 'bad' },
        ],
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/Invalid Pinyin/);
    expect(() =>
      buildPinyinToAudioExercise({
        activityId: 'small',
        candidates: candidates.slice(0, 2),
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/at least 3/);
    expect(() =>
      buildPinyinToAudioExercise({
        activityId: 'duplicate-audio',
        candidates: [
          candidates[0],
          { ...candidates[1], assetKey: candidates[0].assetKey },
          candidates[2],
        ],
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/distinct bundled audio/);
    expect(() =>
      buildPinyinToAudioExercise({
        activityId: 'duplicate-reading',
        candidates: [
          candidates[0],
          { ...candidates[1], numbered: candidates[0].numbered },
          candidates[2],
        ],
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/distinct Pinyin readings/);
  });

  it('uses full-width cards on phones and three columns on wide layouts', () => {
    expect(pinyinToAudioLayout(390)).toEqual({ columns: 1, minimumOptionHeight: 132 });
    expect(pinyinToAudioLayout(800).columns).toBe(3);
  });
});
