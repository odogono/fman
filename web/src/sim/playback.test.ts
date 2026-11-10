import { expect, test } from 'bun:test';

import { simulateHighlights } from './highlights';
import { createPlayback } from './playback';

const result = () =>
  simulateHighlights({
    awayInk: 7,
    home: true,
    homeInk: 0,
    opponent: [10, 10, 10, 10, 10],
    seed: 12,
    strength: [10, 10, 10, 10, 10]
  });
test('playback preserves the simulated outcome and visits each frame once', () => {
  const simulated = result();
  const playback = createPlayback(simulated);
  expect(playback.current?.index).toBe(0);
  playback.advance(1_000_000);
  expect(playback.done).toBe(true);
  expect(playback.score).toEqual(simulated.score);
});
test('only end-of-attack pauses can be cut short by a key', () => {
  const playback = createPlayback(result());
  const key = playback.key;
  playback.skipPause();
  expect(playback.key).toBe(key);
  while (playback.current?.frame.kind !== 'pause') {
    playback.advance(1);
  }
  const paused = playback.key;
  playback.skipPause();
  expect(playback.key).not.toBe(paused);
});
