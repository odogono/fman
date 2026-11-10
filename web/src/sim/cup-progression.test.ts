import { expect, test } from 'bun:test';

import { prepareCupMatch, prepareReplay, settleCupLeg } from './cup';
import { nextFixture } from './league';
import { createNewGame } from './management';

const entry = (round: number) => ({
  ...createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 }),
  cupRound: round - 1,
  leagueMatches: round * 2 - 1,
  scheduleCounter: 2
});

test('later draws use the original round bands and semifinal/final receipts survive replays', () => {
  for (let round = 2; round <= 8; round++) {
    const game = entry(round);
    expect(nextFixture(game)).toBe('cup');
    const fixture = prepareCupMatch(game);
    expect(fixture.game.cupRound).toBe(round);
    expect(fixture.opponent).toBeGreaterThan((8 - round) * 8);
    expect(fixture.opponent).toBeLessThanOrEqual((9 - round) * 8);
    if (round >= 7) {
      expect(fixture.gate).toBe(round === 7 ? 50_000 : 100_000);
      expect(prepareReplay(fixture.game, fixture).gate).toBe(fixture.gate);
    }
  }
});

test('winning the final ends the cup, while a drawn final remains a replay', () => {
  const fixture = prepareCupMatch(entry(8));
  const win = fixture.home ? [2, 1] : [1, 2];
  const completed = settleCupLeg(fixture.game, fixture, win);
  expect(completed.cupWon).toBe(true);
  expect(completed.game.cupFinished).toBe(true);
  expect(nextFixture(completed.game)).toBe('season');
  const draw = settleCupLeg(fixture.game, fixture, [1, 1]);
  expect(draw.replay).toBe(true);
  expect(draw.game.cupFinished).toBe(false);
  expect(draw.bills).toBeUndefined();
});
