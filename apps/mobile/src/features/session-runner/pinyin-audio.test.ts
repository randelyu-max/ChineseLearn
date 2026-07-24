import { learningExerciseV2Fixtures } from '@hanziquest/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPinyinAudioPrefetchCache,
  pinyinAudioKeys,
  prefetchPinyinActivityAudio,
  prefetchPinyinSessionAudio,
  resolvePinyinAudioSource,
} from './pinyin-audio';
import { runnerActivities, runnerSession } from './test-fixtures';

vi.mock('expo-audio', () => ({
  preload: vi.fn(async () => undefined),
}));

describe('formal Pinyin audio cache', () => {
  beforeEach(() => clearPinyinAudioPrefetchCache());

  it('resolves every approved bundled audio ID without a network URL', () => {
    for (const assetId of [
      '50000000-0000-4000-8000-000000000401',
      '50000000-0000-4000-8000-000000000402',
      '50000000-0000-4000-8000-000000000403',
    ]) {
      expect(resolvePinyinAudioSource(assetId)).not.toBeNull();
    }
    expect(resolvePinyinAudioSource('https://example.com/voice.mp3')).toBeNull();
  });

  it('prefetches each Activity once by immutable content hash', async () => {
    const exercise = runnerActivities[5]!.exercise;
    const preloader = vi.fn(async () => undefined);
    await expect(
      prefetchPinyinActivityAudio(exercise, 'a'.repeat(64), preloader),
    ).resolves.toMatchObject({ status: 'ready' });
    await expect(
      prefetchPinyinActivityAudio(exercise, 'a'.repeat(64), preloader),
    ).resolves.toMatchObject({ status: 'cached' });
    expect(preloader).toHaveBeenCalledTimes(pinyinAudioKeys(exercise).length);
  });

  it('prefetches all required formal Session audio for offline playback', async () => {
    const preloader = vi.fn(async () => undefined);
    const results = await prefetchPinyinSessionAudio(runnerSession(), preloader);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'ready')).toBe(true);
    expect(preloader).toHaveBeenCalledTimes(4);
  });

  it('fails closed when a snapshot references an unbundled audio asset', async () => {
    const base = learningExerciseV2Fixtures[4]!;
    if (base.type !== 'audio_to_pinyin') throw new Error('Expected audio fixture.');
    await expect(
      prefetchPinyinActivityAudio(
        { ...base, promptAudioAssetKey: 'missing.asset' },
        'b'.repeat(64),
        vi.fn(async () => undefined),
      ),
    ).resolves.toEqual({
      contentSha256: 'b'.repeat(64),
      missingAssetKeys: ['missing.asset'],
      status: 'missing_asset',
    });
  });
});
