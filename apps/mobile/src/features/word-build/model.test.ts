import { describe, expect, it } from 'vitest';

import {
  createWordBuildState,
  recordWordBuildReplay,
  requestWordBuildHint,
  retryWordBuild,
  submitWordBuild,
  toggleWordBuildTile,
  wordBuildDemoExercise,
  wordBuildLayout,
} from './model.ts';

const context = {
  attemptId: () => '00000000-0000-4000-8000-000000000099',
  nowIso: () => '2026-07-22T18:00:00Z',
  nowMs: () => 1800,
  offlineSequence: 5,
};

function choose(ids: readonly string[]) {
  return ids.reduce(
    (state, tileId) => toggleWordBuildTile(wordBuildDemoExercise, state, tileId),
    createWordBuildState(),
  );
}

describe('word_build interaction model', () => {
  it('supports tap-to-add and tap-to-remove as the accessible drag alternative', () => {
    const tileId = wordBuildDemoExercise.tiles[0]!.tileId;
    const added = toggleWordBuildTile(wordBuildDemoExercise, createWordBuildState(), tileId);
    expect(added.selectedTileIds).toEqual([tileId]);
    expect(toggleWordBuildTile(wordBuildDemoExercise, added, tileId).selectedTileIds).toEqual([]);
  });

  it('creates an ordered-tile attempt for the correct word', () => {
    const result = submitWordBuild(
      wordBuildDemoExercise,
      choose(wordBuildDemoExercise.correctTileOrder),
      context,
    );
    expect(result.attempt).toMatchObject({
      answer: { tileIds: wordBuildDemoExercise.correctTileOrder },
      responseMs: 1800,
    });
  });

  it('provides a hint and retry after reversed order', () => {
    const wrong = submitWordBuild(
      wordBuildDemoExercise,
      choose([...wordBuildDemoExercise.correctTileOrder].reverse()),
      context,
    );
    expect(wrong.state).toMatchObject({
      status: 'incorrect-feedback',
      hintLevel: 'visual_hint',
      retryCount: 1,
    });
    expect(retryWordBuild(wrong.state, 4000)).toMatchObject({
      status: 'building',
      selectedTileIds: [],
    });
  });

  it('records replay and explicit hint evidence', () => {
    const replayed = recordWordBuildReplay(createWordBuildState());
    expect(replayed).toMatchObject({ replayCount: 1, hintLevel: 'audio_repeat' });
    expect(requestWordBuildHint(replayed).hintLevel).toBe('visual_hint');
  });

  it('does not submit incomplete or duplicate completed answers', () => {
    expect(
      submitWordBuild(wordBuildDemoExercise, createWordBuildState(), context).attempt,
    ).toBeNull();
    const complete = submitWordBuild(
      wordBuildDemoExercise,
      choose(wordBuildDemoExercise.correctTileOrder),
      context,
    );
    expect(submitWordBuild(wordBuildDemoExercise, complete.state, context).attempt).toBeNull();
  });

  it('adapts the answer area for small screens', () => {
    expect(wordBuildLayout(320)).toEqual({ answerMinHeight: 72, compact: true });
    expect(wordBuildLayout(400).compact).toBe(false);
  });
});
