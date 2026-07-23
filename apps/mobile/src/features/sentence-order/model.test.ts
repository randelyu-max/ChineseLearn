import { describe, expect, it } from 'vitest';

import {
  createSentenceOrderState,
  recordSentenceReplay,
  requestSentenceOrderHint,
  retrySentenceOrder,
  sentenceOrderDemoExercise,
  sentenceOrderLayout,
  submitSentenceOrder,
  toggleSentenceTile,
} from './model.ts';

const context = {
  attemptId: () => '00000000-0000-4000-8000-000000000099',
  nowIso: () => '2026-07-22T18:00:00Z',
  nowMs: () => 2400,
  offlineSequence: 6,
};

function arrange(ids: readonly string[]) {
  return ids.reduce(
    (state, tileId) => toggleSentenceTile(sentenceOrderDemoExercise, state, tileId),
    createSentenceOrderState(),
  );
}

describe('sentence_order interaction model', () => {
  it('adds and removes sentence chunks by tap', () => {
    const tileId = sentenceOrderDemoExercise.tiles[0]!.tileId;
    const added = toggleSentenceTile(sentenceOrderDemoExercise, createSentenceOrderState(), tileId);
    expect(added.selectedTileIds).toEqual([tileId]);
    expect(toggleSentenceTile(sentenceOrderDemoExercise, added, tileId).selectedTileIds).toEqual(
      [],
    );
  });

  it('creates a standard ordered-tile attempt', () => {
    const result = submitSentenceOrder(
      sentenceOrderDemoExercise,
      arrange(sentenceOrderDemoExercise.correctTileOrder),
      context,
    );
    expect(result.attempt).toMatchObject({
      answer: { tileIds: sentenceOrderDemoExercise.correctTileOrder },
      responseMs: 2400,
    });
  });

  it('gives a hint and retry for incorrect order', () => {
    const wrong = submitSentenceOrder(
      sentenceOrderDemoExercise,
      arrange([...sentenceOrderDemoExercise.correctTileOrder].reverse()),
      context,
    );
    expect(wrong.state).toMatchObject({
      status: 'incorrect-feedback',
      hintLevel: 'visual_hint',
      retryCount: 1,
    });
    expect(retrySentenceOrder(wrong.state, 5000).selectedTileIds).toEqual([]);
  });

  it('records replay and hint evidence', () => {
    const replayed = recordSentenceReplay(createSentenceOrderState());
    expect(replayed).toMatchObject({ replayCount: 1, hintLevel: 'audio_repeat' });
    expect(requestSentenceOrderHint(replayed).hintLevel).toBe('visual_hint');
  });

  it('rejects incomplete and duplicate submissions', () => {
    expect(
      submitSentenceOrder(sentenceOrderDemoExercise, createSentenceOrderState(), context).attempt,
    ).toBeNull();
    const completed = submitSentenceOrder(
      sentenceOrderDemoExercise,
      arrange(sentenceOrderDemoExercise.correctTileOrder),
      context,
    );
    expect(
      submitSentenceOrder(sentenceOrderDemoExercise, completed.state, context).attempt,
    ).toBeNull();
  });

  it('uses compact layout and accessible tile height on small screens', () => {
    expect(sentenceOrderLayout(320)).toEqual({ compact: true, minimumTileHeight: 56 });
    expect(sentenceOrderLayout(400).compact).toBe(false);
  });
});
