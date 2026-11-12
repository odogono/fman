import { expect, test } from 'bun:test';

import { createNewGame, type Game, type Player } from './management';
import { createMatchday } from './matchday';
import { decideMoments, type Moment } from './moments';
import type { SquadPlayer } from './squads';

const even = [10, 10, 10, 10, 10];
const strongest = [20, 20, 20, 20, 20];
const weakest = [1, 1, 1, 1, 1];

const fresh = (seed = 0): Game =>
  createNewGame({
    club: 1,
    level: 1,
    manager: 'alex',
    ruleset: 'enhanced-7',
    seed
  });

const decide = (
  seed: number,
  options: {
    home?: boolean;
    opponent?: readonly number[];
    opponentSquad?: readonly SquadPlayer[];
    players?: readonly Player[];
    squadSeed?: number;
    strength?: readonly number[];
  } = {}
) =>
  decideMoments({
    home: options.home ?? true,
    opponent: options.opponent ?? even,
    players: options.players ?? fresh().players,
    seed,
    strength: options.strength ?? even,
    ...(options.opponentSquad
      ? {
          opponentSquad: options.opponentSquad,
          squadSeed: options.squadSeed ?? 0
        }
      : {})
  });

/** The second club's squad in a new game, under club squads. */
const squad = fresh().clubs[1]!.squad!;

const seeds = Array.from({ length: 400 }, (_, i) => (i * 163 + 7) % 65_536);
const goals = (moments: readonly Moment[], side: Moment['side']) =>
  moments.filter(m => m.kind === 'goal' && m.side === side).length;

test('moments are in minute order, each in 1–90', () => {
  for (const seed of seeds) {
    const { moments } = decide(seed);
    for (const [i, moment] of moments.entries()) {
      expect(moment.minute).toBeGreaterThanOrEqual(1);
      expect(moment.minute).toBeLessThanOrEqual(90);
      if (i > 0) {
        expect(moment.minute).toBeGreaterThanOrEqual(moments[i - 1]!.minute);
      }
    }
  }
});

test('the score is the goal moments, home first', () => {
  for (const seed of seeds) {
    for (const home of [true, false]) {
      const { moments, score } = decide(seed, { home });
      const club = goals(moments, 'club');
      const opponent = goals(moments, 'opponent');
      expect(score).toEqual(home ? [club, opponent] : [opponent, club]);
    }
  }
});

test("the managed club's moments name a picked player", () => {
  const players = fresh().players;
  const picked = new Set(players.filter(p => p.status === 2).map(p => p.id));
  let named = 0;
  for (const seed of seeds) {
    for (const moment of decide(seed, { players }).moments) {
      if (moment.side === 'club') {
        expect(picked.has(moment.player!)).toBe(true);
        named++;
      }
    }
  }
  expect(named).toBeGreaterThan(0);
});

test("without a squad, the opponent's moments name no player", () => {
  let opponent = 0;
  for (const seed of seeds) {
    for (const moment of decide(seed).moments) {
      if (moment.side === 'opponent') {
        expect(moment.player).toBeUndefined();
        expect(moment.squadPlayer).toBeUndefined();
        opponent++;
      }
    }
  }
  expect(opponent).toBeGreaterThan(0);
});

test("with a squad, the opponent's moments name one of its players", () => {
  let opponent = 0;
  for (const seed of seeds) {
    for (const moment of decide(seed, { opponentSquad: squad }).moments) {
      if (moment.side === 'opponent') {
        expect(moment.player).toBeUndefined();
        expect(squad[moment.squadPlayer!]).toBeDefined();
        opponent++;
      } else {
        expect(moment.squadPlayer).toBeUndefined();
      }
    }
  }
  expect(opponent).toBeGreaterThan(0);
});

test("naming the opponent's players changes nothing else", () => {
  for (const seed of seeds) {
    const plain = decide(seed);
    const named = decide(seed, { opponentSquad: squad, squadSeed: seed ^ 99 });
    expect(named.score).toEqual(plain.score);
    expect(named.seed).toBe(plain.seed);
    expect(named.moments.map(({ squadPlayer: _, ...rest }) => rest)).toEqual(
      plain.moments
    );
  }
});

test("the opponent's attackers are named more often than its defenders", () => {
  const even = squad.map(p => ({ ...p, skill: 3 }));
  const named = [0, 0, 0];
  const category = { DF: 0, FW: 2, GK: 0, MF: 1 } as const;
  for (const seed of seeds) {
    for (const moment of decide(seed, { opponentSquad: even }).moments) {
      if (moment.squadPlayer !== undefined) {
        const c = category[even[moment.squadPlayer]!.position];
        named[c] = named[c]! + 1;
      }
    }
  }
  // Four players in each category, weighted 1, 2 and 4.
  expect(named[2]!).toBeGreaterThan(named[1]!);
  expect(named[1]!).toBeGreaterThan(named[0]!);
});

test("the opponent's shooters change from match to match", () => {
  const firsts = new Set(
    seeds.map(
      seed =>
        decide(seed, { opponentSquad: squad, squadSeed: 1234 }).moments.find(
          m => m.side === 'opponent'
        )?.squadPlayer
    )
  );
  expect(firsts.size).toBeGreaterThan(squad.length / 2);
});

test('with no picked players, the managed club’s moments name no one', () => {
  const players = fresh().players.map(p => ({
    ...p,
    status: p.status === 2 ? (1 as const) : p.status
  }));
  for (const seed of seeds.slice(0, 50)) {
    for (const moment of decide(seed, { players }).moments) {
      expect(moment.player).toBeUndefined();
    }
  }
});

test('attackers are named more often than defenders', () => {
  const players = fresh().players.map(p => ({
    ...p,
    skill: 3,
    status: 2 as const
  }));
  const named = [0, 0, 0];
  for (const seed of seeds) {
    for (const moment of decide(seed, { players }).moments) {
      if (moment.player !== undefined) {
        const category = Math.floor((moment.player - 1) / 8);
        named[category] = named[category]! + 1;
      }
    }
  }
  expect(named[2]!).toBeGreaterThan(named[1]!);
  expect(named[1]!).toBeGreaterThan(named[0]!);
});

test('chances come from the strength tests, two for each won test', () => {
  for (const seed of seeds) {
    // A 95-point lead wins every test for the club and none for the opponent.
    const { moments } = decide(seed, {
      opponent: weakest,
      strength: strongest
    });
    const club = moments.filter(m => m.side === 'club').length;
    const opponent = moments.filter(m => m.side === 'opponent').length;
    if (goals(moments, 'club') === 0) {
      // Goalless after the tests: one more chance each.
      expect([club, opponent]).toEqual([11, 1]);
    } else {
      expect([club, opponent]).toEqual([10, 0]);
    }
  }
});

test('the same seed gives the same moments', () => {
  for (const seed of seeds.slice(0, 50)) {
    expect(decide(seed)).toEqual(decide(seed));
  }
});

test('every kind of moment happens', () => {
  const kinds = new Set(
    seeds.flatMap(seed => decide(seed).moments.map(m => m.kind))
  );
  expect([...kinds].toSorted()).toEqual(['goal', 'near-miss', 'save']);
});

/** A matchday at the first cup round, kicked off. */
const cupKickOff = (seed: number) => {
  const game: Game = { ...fresh(), scheduleCounter: 2, seed };
  const matchday = createMatchday(game)!;
  matchday.refresh();
  matchday.kickOff();
  matchday.advance(1_000_000);
  return matchday;
};

test('the ticker shows the moments, then the result follows', () => {
  const game: Game = { ...fresh(), scheduleCounter: 2, seed: 1 };
  const watching = createMatchday(game)!;
  watching.refresh();
  watching.kickOff();
  // Decided at kick-off: the ticker only shows the moments (#108).
  expect(watching.stage).toBe('highlights');
  expect(watching.score).toEqual(watching.moments!.score);
  expect(watching.ticker!.shown).toEqual([]);
  const matchday = cupKickOff(1);
  expect(matchday.fixture.kind).toBe('cup');
  expect(matchday.stage).toBe('result');
  expect(matchday.ticker!.shown).toEqual(matchday.moments!.moments);
  expect(matchday.playback).toBeUndefined();
  expect(matchday.highlights).toBeUndefined();
  expect(matchday.score).toEqual(matchday.moments!.score);
  expect(matchday.game.seed).toBe(matchday.moments!.seed);
  expect(matchday.game.attackCarry).toEqual(fresh().attackCarry);
});

test("under club squads, the opponent's moments name its players and leave the squad seed", () => {
  const matchday = cupKickOff(1);
  const { squad: opponentSquad } =
    matchday.game.clubs[matchday.fixture.opponent - 1]!;
  const opponent = matchday.moments!.moments.filter(m => m.side === 'opponent');
  expect(opponent.length).toBeGreaterThan(0);
  for (const moment of opponent) {
    expect(opponentSquad![moment.squadPlayer!]).toBeDefined();
  }
  const game: Game = { ...fresh(), scheduleCounter: 2, seed: 1 };
  expect(matchday.game.squadSeed).toBe(game.squadSeed!);
});

test('a drawn cup tie is replayed', () => {
  const matchday = seeds
    .map(cupKickOff)
    .find(m => m.score![0] === m.score![1])!;
  const { home } = matchday.fixture;
  matchday.settle();
  expect(matchday.stage).toBe('replay');
  matchday.replay();
  expect(matchday.stage).toBe('fixture');
  expect(matchday.fixture.kind).toBe('cup');
  expect(matchday.fixture.home).toBe(!home);
});
