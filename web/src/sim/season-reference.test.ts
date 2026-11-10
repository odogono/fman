import { expect, test } from 'bun:test';

import { refreshPlayers } from './cup';
import reference from './fixtures/seasons.json';
import { prepareLeagueMatch } from './league';
import { createNewGame, type Game, type Player } from './management';
import { completeSeason } from './season';

for (const observed of reference.cases) {
  test(`original season: division ${observed.division}, rank ${observed.rank}, seed ${observed.seed}`, () => {
    const base = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      seed: 0
    });
    const initial = reference.initial;
    const game: Game = {
      ...base,
      attackCarry: {
        attackers: initial['f(3,2)'].map(([x, y]) => ({ x: x!, y: y! })),
        defenders: initial['g(3,2)'].map(([x, y]) => ({ x: x!, y: y! }))
      },
      cash: initial.m,
      club: (observed.division - 1) * 16 + 8,
      cupFinished: true,
      cupRound: observed.cupRound,
      debt: initial.l,
      division: observed.division,
      league: base.league.map((r, i) => ({
        ...r,
        position: observed.positions[i]!
      })),
      leagueMatches: 15,
      leaguePosition: observed.rank,
      players: base.players.map((p, i): Player => ({
        ...p,
        energy: initial['y(24)'][i]!,
        skill: initial['r(24)'][i]!,
        status: initial['p(24)'][i]! as Player['status'],
        value: initial['v(24)'][i]!
      })),
      previousNet: initial.xp,
      ratingTotal: 48,
      seasons: 3,
      seed: observed.seed
    };
    const { game: next } = completeSeason(game);
    const expected = observed.completed;
    expect(next.club).toBe(expected.t1);
    expect(next.division).toBe(expected.d1);
    expect(next.clubs.map(c => base.clubs.indexOf(c) + 1)).toEqual(
      observed.clubOrder
    );
    expect(next.cash).toBe(expected.m);
    expect(next.debt).toBe(expected.l);
    expect(next.previousNet).toBe(expected.xp);
    expect(next.homeGate).toBe(expected.g);
    expect(next.ratingTotal).toBe(expected.s);
    expect(next.seasons).toBe(expected.s5);
    expect(next.rating).toBe(observed.rating);
    expect(next.seed).toBe(observed.finalSeed);
    expect<number[]>(next.players.map(p => p.status)).toEqual(
      expected['p(24)']
    );
    expect(next.players.map(p => p.skill)).toEqual(expected['r(24)']);
    expect(next.players.map(p => p.energy)).toEqual(expected['y(24)']);
    expect(next.players.map(p => p.value)).toEqual(expected['v(24)']);
    expect(next.attackCarry.attackers.map(p => [p.x, p.y])).toEqual(
      expected['f(3,2)']
    );
    expect(next.attackCarry.defenders.map(p => [p.x, p.y])).toEqual(
      expected['g(3,2)']
    );
    expect(next.league.map(t => t.position)).toEqual(expected['t(16)']);
    expect(next.league.map(t => t.for)).toEqual(expected['b(16)']);
    expect(next.league.map(t => t.against)).toEqual(expected['c(16)']);
    expect(next.league.map(t => t.points)).toEqual(
      expected['z(17)'].slice(0, 16)
    );
    expect(next.leagueMatches).toBe(expected.ml);
    expect(next.scheduleCounter).toBe(expected.ma);
    expect(next.cupRound).toBe(expected.c);
    expect(next.cupFinished).toBe(Boolean(expected.fa));
    expect(next.leagueHome).toBe(expected.h1 === 1);
    const opening = prepareLeagueMatch({ ...next, seed: observed.seed });
    expect(opening.opponent).toBe(observed.opening.opponent);
    expect(opening.home).toBe(observed.opening.home);
    expect(opening.gate).toBe(observed.opening.gate);
    expect(opening.opponentStrength).toEqual(observed.opening.strength);
    expect(opening.game.seed).toBe(observed.opening.seed);
    const team = refreshPlayers(opening.game);
    expect(team.seed).toBe(observed.opening.teamSeed);
    expect<number[]>(team.players.map(p => p.status)).toEqual(
      observed.opening.statuses
    );
    expect(team.players.map(p => p.energy)).toEqual(observed.opening.energy);
  });
}
