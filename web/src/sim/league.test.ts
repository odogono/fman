import { expect, test } from 'bun:test';

import cases from './fixtures/first-matches.json';
import {
  completeLeagueMatch,
  prepareLeagueMatch,
  teamStrength,
  togglePickedPlayer
} from './league';
import { createNewGame } from './management';

const fresh = (seed = 0) => ({
  ...createNewGame({ club: 1, colour: 0, level: 1, manager: 'alex', seed: 0 }),
  seed
});
for (const reference of cases) {
  test(`original first fixture and completed cycle from seed ${reference.seed}`, () => {
    const fixture = prepareLeagueMatch(fresh(reference.seed));
    expect(fixture.opponent).toBe(reference.opponent);
    expect(fixture.opponentStrength).toEqual(reference.opponentStrength);
    expect(fixture.game.seed).toBe(reference.fixtureSeed!);
    expect(teamStrength(fixture.game)).toEqual(reference.strength);
    const completed = completeLeagueMatch(
      { ...fixture.game, seed: reference.finalSeed },
      fixture,
      reference.score
    );
    const expected = reference.completed;
    expect(completed.game.cash).toBe(expected.cash);
    expect(completed.game.debt).toBe(expected.debt);
    expect(completed.game.morale).toBe(expected.morale);
    expect(completed.game.leaguePosition).toBe(expected.position);
    expect(completed.game.seed).toBe(expected.seed);
    expect(completed.game.homeGate).toBe(expected.gate);
    expect(completed.bills.wages).toBe(expected.wages);
    expect(completed.bills.balance).toBe(expected.balance);
    expect(completed.game.league.map(team => team.points)).toEqual(
      expected.points
    );
    expect(completed.game.league.map(team => team.for)).toEqual(expected.for);
    expect(completed.game.league.map(team => team.against)).toEqual(
      expected.against
    );
    expect(completed.game.league.map(team => team.position)).toEqual(
      expected.positions
    );
  });
}

test('the original add/remove rule temporarily allows twelve but forces a removal', () => {
  const game = fresh();
  const reserve = game.players.find(p => p.status === 1)!;
  const twelve = togglePickedPlayer(game, reserve.id);
  expect(twelve.players.filter(p => p.status === 2)).toHaveLength(12);
  const eleven = togglePickedPlayer(twelve, 1);
  expect(eleven.players[0]?.status).toBe(1);
  expect(() => togglePickedPlayer(game, 1)).toThrow('PLAYER NOT AVAILABLE');
});
