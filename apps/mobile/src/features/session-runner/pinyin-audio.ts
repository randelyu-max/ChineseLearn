import type { LearningExerciseV2 } from '@hanziquest/contracts';
import { preload, type AudioSource } from 'expo-audio';

import ma2Audio from '../../../assets/audio/pinyin/ma2.mp3';
import ma3Audio from '../../../assets/audio/pinyin/ma3.mp3';
import ma4Audio from '../../../assets/audio/pinyin/ma4.mp3';
import type { FormalSessionCacheRecord } from '../offline-storage';

const PINYIN_AUDIO_SOURCES: Readonly<Record<string, AudioSource>> = Object.freeze({
  '50000000-0000-4000-8000-000000000401': ma2Audio,
  '50000000-0000-4000-8000-000000000402': ma3Audio,
  '50000000-0000-4000-8000-000000000403': ma4Audio,
  'pinyin-ma2-v1': ma2Audio,
  'pinyin-ma3-v1': ma3Audio,
  'pinyin-ma4-v1': ma4Audio,
});

const preloadByContentHash = new Map<string, Promise<PinyinAudioPrefetchResult>>();

export type PinyinAudioPrefetchResult = Readonly<{
  contentSha256: string;
  missingAssetKeys: readonly string[];
  status: 'cached' | 'missing_asset' | 'ready';
}>;

export function resolvePinyinAudioSource(assetKey: string): AudioSource | null {
  return PINYIN_AUDIO_SOURCES[assetKey] ?? null;
}

export function pinyinAudioKeys(exercise: LearningExerciseV2): readonly string[] {
  switch (exercise.type) {
    case 'audio_to_pinyin':
      return [exercise.promptAudioAssetKey];
    case 'pinyin_to_audio':
      return exercise.options.map((option) => option.audioAssetKey);
    case 'tone_choice':
      return exercise.promptAudioAssetKey ? [exercise.promptAudioAssetKey] : [];
    default:
      return [];
  }
}

export function clearPinyinAudioPrefetchCache(): void {
  preloadByContentHash.clear();
}

export function prefetchPinyinActivityAudio(
  exercise: LearningExerciseV2,
  contentSha256: string,
  preloadSource: (source: AudioSource) => Promise<void> = preload,
): Promise<PinyinAudioPrefetchResult> {
  const existing = preloadByContentHash.get(contentSha256);
  if (existing) {
    return existing.then((result) => ({ ...result, status: 'cached' as const }));
  }
  const pending = (async (): Promise<PinyinAudioPrefetchResult> => {
    const keys = [...new Set(pinyinAudioKeys(exercise))];
    const missingAssetKeys = keys.filter((assetKey) => resolvePinyinAudioSource(assetKey) === null);
    if (missingAssetKeys.length > 0) {
      return {
        contentSha256,
        missingAssetKeys,
        status: 'missing_asset',
      };
    }
    await Promise.all(
      keys.map((assetKey) => preloadSource(resolvePinyinAudioSource(assetKey) as AudioSource)),
    );
    return { contentSha256, missingAssetKeys: [], status: 'ready' };
  })();
  preloadByContentHash.set(contentSha256, pending);
  void pending.catch(() => preloadByContentHash.delete(contentSha256));
  return pending;
}

export async function prefetchPinyinSessionAudio(
  session: FormalSessionCacheRecord,
  preloadSource: (source: AudioSource) => Promise<void> = preload,
): Promise<readonly PinyinAudioPrefetchResult[]> {
  return Promise.all(
    session.activities
      .filter((activity) => pinyinAudioKeys(activity.exercise).length > 0)
      .map((activity) =>
        prefetchPinyinActivityAudio(activity.exercise, activity.contentSha256, preloadSource),
      ),
  );
}
