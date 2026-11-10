import { expect, test } from 'bun:test';

import { refreshPlayers } from './cup';
import cases from './fixtures/league-progression.json';
import { simulateHighlights } from './highlights';
import {
  completeLeagueMatch,
  nextFixture,
  prepareLeagueMatch,
  teamStrength
} from './league';
import { createNewGame, type Game, type Player } from './management';

for (const reference of cases) {
  test(`original league continuation after cup seed ${reference.cupSeed}, league seed ${reference.seed}`, () => {
    const initial = reference.initial;
    const fresh = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      seed: 0
    });
    let game: Game = {
      ...fresh,
      attackCarry: {
        attackers: initial['f(3,2)'].map(([x, y]) => ({ x: x!, y: y! })),
        defenders: initial['g(3,2)'].map(([x, y]) => ({ x: x!, y: y! }))
      },
      cash: initial.m,
      cupFinished: Boolean(initial.fa),
      cupRound: initial.c,
      debt: initial.l,
      homeGate: initial.g,
      league: fresh.league.map((_, i) => ({
        against: initial['c(16)'][i]!,
        for: initial['b(16)'][i]!,
        points: initial['z(17)'][i]!,
        position: initial['t(16)'][i]!
      })),
      leagueHome: initial.h1 === 1,
      leagueMatches: initial.ml,
      leaguePosition: initial['t(16)'][15]!,
      morale: initial['a(5)'][1]!,
      players: fresh.players.map((p, i): Player => ({
        ...p,
        energy: initial['y(24)'][i]!,
        skill: initial['r(24)'][i]!,
        status: initial['p(24)'][i]! as Player['status'],
        value: initial['v(24)'][i]!
      })),
      previousNet: initial.xp,
      scheduleCounter: initial.ma,
      seed: reference.seed
    };
    for (const expected of reference.matches) {
      const fixture = prepareLeagueMatch({ ...game, seed: reference.seed });
      game = fixture.game;
      expect(fixture.home).toBe(expected.home);
      expect(fixture.opponent).toBe(expected.opponent);
      expect(fixture.gate).toBe(expected.gate);
      expect(fixture.opponentStrength).toEqual(expected.opponentStrength);
      expect(game.seed).toBe(expected.fixtureSeed);
      game = refreshPlayers(game);
      expect(game.seed).toBe(expected.teamSeed);
      expect<number[]>(game.players.map(p => p.status)).toEqual(
        expected.statuses
      );
      expect(game.players.map(p => p.energy)).toEqual(expected.energy);
      expect(teamStrength(game)).toEqual(expected.strength);
      const highlights = simulateHighlights({
        awayInk: fixture.home ? 7 : 0,
        carry: game.attackCarry,
        home: fixture.home,
        homeInk: fixture.home ? 0 : 7,
        opponent: fixture.opponentStrength,
        seed: game.seed,
        strength: teamStrength(game)
      });
      expect(highlights.score).toEqual(expected.score);
      expect(highlights.seed).toBe(expected.finalSeed);
      expect(highlights.carry.attackers.map(p => [p.x, p.y])).toEqual(
        expected.attackers
      );
      expect(highlights.carry.defenders.map(p => [p.x, p.y])).toEqual(
        expected.defenders
      );
      const completion = completeLeagueMatch(
        { ...game, attackCarry: highlights.carry, seed: highlights.seed },
        fixture,
        highlights.score
      );
      game = completion.game;
      const end = expected.completed;
      expect(game.cash).toBe(end.m);
      expect(game.debt).toBe(end.l);
      expect(game.homeGate).toBe(end.g);
      expect(game.previousNet).toBe(end.xp);
      expect(game.morale).toBe(end['a(5)'][1]!);
      expect(game.leagueMatches).toBe(end.ml);
      expect(game.scheduleCounter).toBe(end.ma);
      expect(game.seed).toBe(expected.completedSeed);
      expect(game.league.map(t => t.points)).toEqual(end['z(17)'].slice(0, 16));
      expect(game.league.map(t => t.for)).toEqual(end['b(16)']);
      expect(game.league.map(t => t.against)).toEqual(end['c(16)']);
      expect(game.league.map(t => t.position)).toEqual(end['t(16)']);
      expect(completion.bills.balance).toBe(end.i);
      expect(completion.bills.wages).toBe(end.w);
      expect(completion.bills.rent).toBe(end.x);
    }
    expect(nextFixture(game)).toBe(
      game.leagueMatches === 15 ? 'season' : game.cupFinished ? 'league' : 'cup'
    );
  });
}
