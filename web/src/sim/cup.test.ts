import { expect, test } from 'bun:test';

import {
  cupRoundName,
  prepareCupMatch,
  prepareReplay,
  refreshPlayers,
  settleCupLeg
} from './cup';
import cases from './fixtures/first-cups.json';
import { simulateHighlights } from './highlights';
import { teamStrength } from './league';
import { createNewGame, type Game, type Player } from './management';

test('cup rounds are numbered until the semi-final and final', () => {
  expect([1, 6, 7, 8].map(cupRoundName)).toEqual([
    '1',
    '6',
    'Semi-Final',
    'Final'
  ]);
});

for (const reference of cases) {
  test(`original first cup round from seed ${reference.seed}, including replays`, () => {
    const initial = reference.initial;
    let game: Game = {
      ...createNewGame({
        club: 1,
        colour: 0,
        level: 1,
        manager: 'alex',
        seed: 0
      }),
      attackCarry: {
        attackers: initial['f(3,2)'].map(([x, y]) => ({ x: x!, y: y! })),
        defenders: initial['g(3,2)'].map(([x, y]) => ({ x: x!, y: y! }))
      },
      cash: initial.m,
      cupFinished: Boolean(initial.fa),
      cupRound: initial.c,
      debt: initial.l,
      homeGate: initial.g,
      leagueMatches: initial.ml,
      morale: initial['a(5)'][1]!,
      previousNet: initial.xp,
      scheduleCounter: initial.ma,
      seed: reference.seed
    };
    game = {
      ...game,
      players: game.players.map((p, i): Player => ({
        ...p,
        energy: initial['y(24)'][i]!,
        status: initial['p(24)'][i]! as Player['status']
      }))
    };
    let fixture = prepareCupMatch(game);
    for (const [index, leg] of reference.legs.entries()) {
      if (index > 0) {
        fixture = prepareReplay(game, fixture);
      }
      game = fixture.game;
      expect(fixture.home).toBe(leg.home);
      expect(fixture.opponent).toBe(leg.opponent);
      expect(fixture.opponentStrength).toEqual(leg.opponentStrength);
      expect(fixture.gate).toBe(leg.gate);
      expect(game.seed).toBe(leg.fixtureSeed);
      game = refreshPlayers(game);
      expect(game.seed).toBe(leg.teamSeed);
      expect<number[]>(game.players.map(p => p.status)).toEqual(leg.statuses);
      expect(game.players.map(p => p.energy)).toEqual(leg.energy);
      expect(teamStrength(game)).toEqual(leg.strength);
      const highlights = simulateHighlights({
        awayInk: fixture.home ? 7 : 0,
        carry: game.attackCarry,
        home: fixture.home,
        homeInk: fixture.home ? 0 : 7,
        opponent: fixture.opponentStrength,
        seed: game.seed,
        strength: teamStrength(game)
      });
      expect(highlights.score).toEqual(leg.score);
      expect(highlights.seed).toBe(leg.finalSeed);
      expect(highlights.carry.attackers.map(p => [p.x, p.y])).toEqual(
        leg.attackers
      );
      expect(highlights.carry.defenders.map(p => [p.x, p.y])).toEqual(
        leg.defenders
      );
      const settled = settleCupLeg(
        { ...game, attackCarry: highlights.carry, seed: highlights.seed },
        fixture,
        highlights.score
      );
      expect(settled.replay).toBe(index < reference.legs.length - 1);
      game = settled.game;
    }
    const end = reference.completed;
    expect(game.cash).toBe(end.m);
    expect(game.debt).toBe(end.l);
    expect(game.morale).toBe(end['a(5)'][1]!);
    expect(game.cupFinished).toBe(Boolean(end.fa));
    expect(game.cupRound).toBe(end.c);
    expect(game.scheduleCounter).toBe(end.ma);
    expect(game.previousNet).toBe(end.xp);
    expect(game.seed).toBe(end.seed);
    expect(game.leagueMatches).toBe(1);
  });
}
