import { describe, expect, it } from 'vitest';

import {
  audioToPinyinDemoExercise,
  audioToPinyinLayout,
  audioToPinyinReplayCount,
  buildAudioToPinyinExercise,
  createAudioToPinyinState,
  recordAudioToPinyinPlayback,
  retryAudioToPinyin,
  selectAudioToPinyinOption,
} from './model';

const candidates = [
  { syllableId: '52000000-0000-4000-8000-000000000021', numbered: 'ma1' },
  { syllableId: '52000000-0000-4000-8000-000000000022', numbered: 'ma2' },
  { syllableId: '52000000-0000-4000-8000-000000000023', numbered: 'ma3' },
  { syllableId: '52000000-0000-4000-8000-000000000024', numbered: 'ma4' },
  { syllableId: '52000000-0000-4000-8000-000000000025', numbered: 'shi4' },
] as const;

function build(seed = 'fixed-seed') {
  return buildAudioToPinyinExercise({
    activityId: '52000000-0000-4000-8000-000000000030',
    audioAssetKey: 'test-bundled-audio',
    candidates,
    seed,
    targetSyllableId: candidates[2].syllableId,
  });
}

describe('audio_to_pinyin interaction model', () => {
  it('builds deterministic tone-aware options for a fixed seed', () => {
    expect(build()).toEqual(build());
    expect(build().options).toHaveLength(4);
    expect(
      build()
        .options.map((option) => option.numbered)
        .sort(),
    ).toEqual(['ma1', 'ma2', 'ma3', 'ma4']);
  });

  it('keeps the correct answer stable when the display order changes', () => {
    const first = build('seed-a');
    const second = build('seed-b');
    expect(first.correctOptionId).toBe(candidates[2].syllableId);
    expect(second.correctOptionId).toBe(candidates[2].syllableId);
    expect(first.options.map((option) => option.optionId)).not.toEqual(
      second.options.map((option) => option.optionId),
    );
  });

  it('uses a bundled source and never needs a remote URL at exercise time', () => {
    expect(audioToPinyinDemoExercise.audioAsset).toEqual({
      assetKey: 'pinyin-ma3-v1',
      source: 'bundled',
    });
    expect(JSON.stringify(audioToPinyinDemoExercise)).not.toMatch(/https?:\/\//);
  });

  it('records first play separately from replay count', () => {
    const firstPlay = recordAudioToPinyinPlayback(createAudioToPinyinState());
    const replay = recordAudioToPinyinPlayback(firstPlay);
    expect(audioToPinyinReplayCount(firstPlay)).toBe(0);
    expect(audioToPinyinReplayCount(replay)).toBe(1);
  });

  it('gives supportive retry state after a wrong answer', () => {
    const wrongOption = audioToPinyinDemoExercise.options.find(
      (option) => option.optionId !== audioToPinyinDemoExercise.correctOptionId,
    )!;
    const wrong = selectAudioToPinyinOption(
      audioToPinyinDemoExercise,
      createAudioToPinyinState(),
      wrongOption.optionId,
    );
    expect(wrong.status).toBe('incorrect-feedback');
    expect(retryAudioToPinyin(wrong)).toMatchObject({
      retryCount: 1,
      selectedOptionId: null,
      status: 'awaiting-answer',
    });
  });

  it('marks only the stable target option correct and then ignores duplicate taps', () => {
    const correct = selectAudioToPinyinOption(
      audioToPinyinDemoExercise,
      createAudioToPinyinState(),
      audioToPinyinDemoExercise.correctOptionId,
    );
    expect(correct.status).toBe('correct-feedback');
    expect(
      selectAudioToPinyinOption(
        audioToPinyinDemoExercise,
        correct,
        audioToPinyinDemoExercise.correctOptionId,
      ),
    ).toBe(correct);
  });

  it('provides spoken tone labels and large responsive targets', () => {
    expect(audioToPinyinDemoExercise.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accessibilityLabel: expect.stringMatching(/第[一二三四]声|轻声/),
        }),
      ]),
    );
    expect(audioToPinyinLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 88 });
    expect(audioToPinyinLayout(390).columns).toBe(2);
  });

  it('rejects invalid or undersized candidate sets', () => {
    expect(() =>
      buildAudioToPinyinExercise({
        activityId: '52000000-0000-4000-8000-000000000030',
        audioAssetKey: 'test-bundled-audio',
        candidates: candidates.slice(0, 2),
        seed: 'fixed-seed',
        targetSyllableId: candidates[2].syllableId,
      }),
    ).toThrow(/target/);
    expect(() =>
      buildAudioToPinyinExercise({
        activityId: '52000000-0000-4000-8000-000000000030',
        audioAssetKey: 'test-bundled-audio',
        candidates: candidates.slice(0, 3),
        seed: 'fixed-seed',
        targetSyllableId: candidates[0].syllableId,
      }),
    ).toThrow(/at least 4/);
  });
});
