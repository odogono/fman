import { expect, test } from 'bun:test';

import { injuryBand, refreshPlayers } from './cup';
import { createNewGame, type Game, type Player } from './management';
import { settleInjuries } from './match-injuries';
import { createMatchday, type Matchday } from './matchday';
import { decideMoments, type Moment } from './moments';
import {
  clearances,
  clubSquads,
  gracePeriodWeeks,
  lastingSkill,
  matchInjuries,
  momentHighlights,
  opponentBonus,
  presentDay,
  rulesets,
  tiringInjuries,
  type Ruleset
} from './ruleset';
import { decodeSave, encodeSave } from './save';
import { completeSeason } from './season';
import type { SquadPlayer } from './squads';

const fresh = (ruleset: Ruleset = 'enhanced-9', seed = 0): Game =>
  createNewGame({
    club: 1,
    ...(presentDay(ruleset) ? {} : { colour: 0 }),
    level: 1,
    manager: 'alex',
    ruleset,
    seed
  });

/** A new squad with eleven picked players at `energy` and the rest reserves. */
const pickedAt = (energy: number): Player[] =>
  fresh().players.map((p, i) => ({
    ...p,
    energy,
    status: i < 11 ? 2 : i < 16 ? 1 : 0
  }));

const even = [10, 10, 10, 10, 10];

const decide = (
  seed: number,
  players: readonly Player[],
  options: { injuries?: boolean; squad?: readonly SquadPlayer[] } = {}
) =>
  decideMoments({
    clearances: true,
    home: true,
    injuries: options.injuries ?? true,
    opponent: even,
    players,
    seed,
    strength: even,
    ...(options.squad ? { opponentSquad: options.squad, squadSeed: 7 } : {})
  });

const injuriesOf = (moments: readonly Moment[]) =>
  moments.filter(m => m.kind === 'injury');

/** The second club's squad in a new game, under club squads. */
const squad = fresh().clubs[1]!.squad!;

test('Enhanced version 9 is version 8 with match injuries', () => {
  for (const ruleset of rulesets) {
    expect(matchInjuries(ruleset)).toBe(
      ruleset === 'enhanced-9' ||
        ruleset === 'enhanced-10' ||
        ruleset === 'enhanced-11'
    );
  }
  for (const accessor of [
    clearances,
    clubSquads,
    gracePeriodWeeks,
    lastingSkill,
    momentHighlights,
    presentDay,
    tiringInjuries
  ]) {
    expect(accessor('enhanced-9')).toEqual(accessor('enhanced-8'));
  }
  for (let level = 1; level <= 7; level++) {
    expect(opponentBonus('enhanced-9', level)).toBe(
      opponentBonus('enhanced-8', level)
    );
  }
});

test('each picked player rolls the lasting-injuries curve once a match', () => {
  const seeds = 4000;
  for (const energy of [20, 13, 8, 3]) {
    const band = injuryBand(energy);
    const players = pickedAt(energy);
    let injured = 0;
    for (let seed = 0; seed < seeds; seed++) {
      for (const injury of injuriesOf(decide(seed, players).moments)) {
        injured++;
        expect(players[injury.player! - 1]!.status).toBe(2);
        expect(injury.side).toBe('club');
        expect(injury.weeksOut).toBeGreaterThanOrEqual(1);
        expect(injury.weeksOut).toBeLessThanOrEqual(band);
      }
    }
    // One roll in 20 per band step, for each of the eleven.
    expect(injured / (seeds * 11)).toBeCloseTo(band / 20, 1);
  }
});

test('the chances, the score and the seed are the same as without injuries', () => {
  const players = pickedAt(4);
  for (let seed = 0; seed < 2000; seed++) {
    for (const opponentSquad of [undefined, squad]) {
      const options = opponentSquad ? { squad: opponentSquad } : {};
      const with_ = decide(seed, players, options);
      const without = decide(seed, players, { ...options, injuries: false });
      expect(with_.moments.filter(m => m.kind !== 'injury')).toEqual(
        without.moments
      );
      expect(with_.score).toEqual(without.score);
      expect(with_.seed).toBe(without.seed);
    }
  }
});

test('a player is injured after their last chance, and nobody is named after going off', () => {
  const players = pickedAt(3);
  let found = 0;
  for (let seed = 0; seed < 2000; seed++) {
    const { moments } = decide(seed, players);
    for (const injury of injuriesOf(moments)) {
      const at = moments.indexOf(injury);
      expect(injury.minute).toBeLessThanOrEqual(90);
      for (const later of moments.slice(at + 1)) {
        expect(later.side === 'club' && later.player === injury.player).toBe(
          false
        );
      }
      found++;
    }
    expect(moments.map(m => m.minute)).toEqual(
      moments.map(m => m.minute).toSorted((a, b) => a - b)
    );
  }
  expect(found).toBeGreaterThan(100);
});

test('a tackle causes an injury 2 times in 3, made by an opposing outfield player', () => {
  const players = pickedAt(3);
  let tackled = 0;
  let total = 0;
  for (let seed = 0; seed < 3000; seed++) {
    for (const injury of injuriesOf(decide(seed, players, { squad }).moments)) {
      total++;
      if (injury.tackled) {
        tackled++;
        expect(squad[injury.tackler!]!.position).not.toBe('GK');
      } else {
        expect(injury.tackler).toBeUndefined();
      }
    }
    // Without a squad, the opposing club makes the tackle.
    for (const injury of injuriesOf(decide(seed, players).moments)) {
      expect(injury.tackler).toBeUndefined();
    }
  }
  expect(tackled / total).toBeCloseTo(2 / 3, 1);
});

test('the refresh before team selection injures nobody, and draws as before', () => {
  for (let seed = 0; seed < 300; seed++) {
    const game = {
      ...fresh(),
      leagueMatches: 2,
      players: fresh().players.map((p, i) => ({
        ...p,
        energy: 2,
        ...(i === 0 ? { status: 3 as const, weeksOut: 2 } : {})
      })),
      seed
    };
    const refreshed = refreshPlayers(game);
    const lasting = refreshPlayers({ ...game, ruleset: 'enhanced-8' });
    expect(refreshed.seed).toBe(lasting.seed);
    // An injury counts down here, as under lasting injuries.
    expect(refreshed.players[0]).toEqual(lasting.players[0]!);
    expect(refreshed.players[0]!.weeksOut).toBe(1);
    refreshed.players.slice(1).forEach((p, i) => {
      const before = game.players[i + 1]!;
      expect(p.status).toBe(before.status);
      expect(p.energy).toBe(lasting.players[i + 1]!.energy);
    });
  }
});

test('a match’s injuries start a week longer, so the next refresh doesn’t heal them', () => {
  const game: Game = {
    ...fresh(),
    players: fresh().players.map((p, i) =>
      i === 0
        ? { ...p, status: 3, weeksOut: 1 }
        : i === 2
          ? { ...p, status: 2 }
          : p
    )
  };
  const injury: Moment = {
    kind: 'injury',
    minute: 51,
    player: 3,
    side: 'club',
    weeksOut: 1
  };
  const after = settleInjuries(game, [injury]);
  // An injury from before the match counts down at the refresh, not here.
  expect(after.players[0]).toEqual(game.players[0]!);
  expect(after.players[2]).toMatchObject({ status: 3, weeksOut: 2 });
  const refreshed = refreshPlayers({ ...after, leagueMatches: 2 });
  expect(refreshed.players[0]!.status).toBe(1);
  // Out for the next match, recovering no energy.
  expect(refreshed.players[2]).toMatchObject({
    energy: game.players[2]!.energy,
    status: 3,
    weeksOut: 1
  });
});

/** A matchday for `game`, played through to the result. */
const played = (game: Game) => {
  const matchday = createMatchday(game)!;
  matchday.refresh();
  matchday.kickOff();
  matchday.advance(1_000_000);
  return matchday;
};

const injuredIn = (matchday: Matchday) =>
  matchday.highlights?.kind === 'moments'
    ? injuriesOf(matchday.highlights.result.moments)
    : [];

test('an injury in a league match keeps the player out of exactly the next matches', () => {
  for (let seed = 0; seed < 500; seed++) {
    const first = played({ ...fresh('enhanced-9', seed), seed });
    expect(first.fixture.kind).toBe('league');
    const [injury] = injuredIn(first);
    if (injury?.weeksOut !== 1) {
      continue;
    }
    // Nothing changes until the match is settled.
    expect(first.game.players[injury.player! - 1]!.status).toBe(2);
    first.settle();
    const id = injury.player!;
    expect(first.game.players[id - 1]).toMatchObject({
      status: 3,
      weeksOut: 2
    });
    const next = createMatchday(first.game)!;
    next.refresh();
    expect(next.game.players[id - 1]).toMatchObject({
      status: 3,
      weeksOut: 1
    });
    next.kickOff();
    next.advance(1_000_000);
    next.settle();
    const after = createMatchday(next.game)!;
    after.refresh();
    // Back in the reserves for the match after, with no energy recovered.
    expect(after.game.players[id - 1]!.status).toBe(1);
    expect(after.game.players[id - 1]!.weeksOut).toBeUndefined();
    expect(after.game.players[id - 1]!.energy).toBe(
      first.game.players[id - 1]!.energy
    );
    return;
  }
  throw new Error('No one-week injury found');
});

test('a drawn cup leg settles its injuries before the replay', () => {
  for (let seed = 0; seed < 4000; seed++) {
    const cup = played({
      ...fresh('enhanced-9', seed),
      cupRound: 1,
      leagueMatches: 3,
      scheduleCounter: 5,
      seed
    });
    expect(cup.fixture.kind).toBe('cup');
    const score = cup.score!;
    const injuries = injuredIn(cup);
    if (score[0] !== score[1] || !injuries.length) {
      continue;
    }
    cup.settle();
    expect(cup.stage).toBe('replay');
    for (const injury of injuries) {
      expect(cup.game.players[injury.player! - 1]).toMatchObject({
        status: 3,
        weeksOut: injury.weeksOut! + 1
      });
    }
    cup.replay();
    cup.refresh();
    for (const injury of injuries) {
      expect(cup.game.players[injury.player! - 1]!.status).toBe(3);
    }
    return;
  }
  throw new Error('No drawn cup tie with an injury found');
});

test('every injury heals at the season end', () => {
  const game = fresh('enhanced-9', 9);
  const ended = completeSeason({
    ...game,
    club: 24,
    cupFinished: true,
    cupRound: 3,
    division: 2,
    league: game.league.map((r, i) => ({ ...r, position: i + 1 })),
    leagueMatches: 15,
    leaguePosition: 8,
    players: game.players.map((p, i) =>
      i < 3 ? { ...p, status: 3, weeksOut: 3 } : p
    )
  }).game;
  for (const p of ended.players.slice(0, 3)) {
    expect(p.status).toBe(1);
    expect(p.weeksOut).toBeUndefined();
  }
});

/** A new game whose third player has four weeks out. */
const injured = (ruleset: Ruleset): Game => ({
  ...fresh(ruleset),
  players: fresh(ruleset).players.map((p, i) =>
    i === 2 ? { ...p, status: 3, weeksOut: 4 } : p
  )
});

test('a save mid-injury keeps the weeks out, up to four under match injuries', () => {
  const game = injured('enhanced-9');
  expect(decodeSave(encodeSave(game, 100)).game).toEqual(game);
  expect(() => decodeSave(encodeSave(injured('enhanced-8'), 100))).toThrow(
    RangeError
  );
});
