import { expect, test } from 'bun:test';

import { createNewGame, type Game, type Player } from './management';
import { lastingSkill, type Ruleset } from './ruleset';
import { completeSeason } from './season';

/** A finished season in which the club, 8th in Division 2, stays put. */
const finished = (ruleset: Ruleset, seed: number, skill: number): Game => {
  const fresh = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    ruleset,
    seed
  });
  return {
    ...fresh,
    club: 24,
    cupFinished: true,
    cupRound: 3,
    division: 2,
    league: fresh.league.map((r, i) => ({
      ...r,
      position: i + 1
    })),
    leagueMatches: 15,
    leaguePosition: 8,
    // Players 1–8 owned (one injured), the rest in the pool.
    players: fresh.players.map((p, i): Player => ({
      ...p,
      skill,
      status: i < 7 ? 1 : i === 7 ? 3 : 0
    })),
    seed
  };
};

test('only lasting-skill keeps skill between seasons', () => {
  expect(lastingSkill('lasting-skill')).toBe(true);
  for (const ruleset of ['original', 'enhanced-1', 'enhanced-2'] as const) {
    expect(lastingSkill(ruleset)).toBe(false);
  }
});

test('owned players drift by at most one, unowned reroll, and every draw matches the original', () => {
  const drifts = new Set<number>();
  const rerolled = new Set<number>();
  for (let seed = 0; seed < 300; seed++) {
    const before = finished('lasting-skill', seed, 3);
    const lasting = completeSeason(before).game;
    const original = completeSeason(finished('original', seed, 3)).game;
    expect(lasting.seed).toBe(original.seed);
    expect(lasting.division).toBe(2);
    lasting.players.forEach((p, i) => {
      const was = original.players[i]!;
      expect(p.energy).toBe(was.energy);
      expect(p.status).toBe(before.players[i]!.status);
      expect(p.value).toBe(p.skill * 5000 * 3);
      if (p.status > 0) {
        drifts.add(p.skill - 3);
      } else {
        expect(p.skill).toBe(was.skill);
        rerolled.add(p.skill);
      }
    });
  }
  expect([...drifts].sort()).toEqual([-1, 0, 1]);
  expect([...rerolled].sort()).toEqual([1, 2, 3, 4, 5]);
});

test('skill drift stays within 1 to 5', () => {
  const seen = { 1: new Set<number>(), 5: new Set<number>() };
  for (let seed = 0; seed < 300; seed++) {
    for (const skill of [1, 5] as const) {
      const { players } = completeSeason(
        finished('lasting-skill', seed, skill)
      ).game;
      for (const p of players.filter(q => q.status > 0)) {
        seen[skill].add(p.skill);
      }
    }
  }
  expect([...seen[1]].sort()).toEqual([1, 2]);
  expect([...seen[5]].sort()).toEqual([4, 5]);
});

test('value follows the new division after drift', () => {
  const before = finished('lasting-skill', 7, 4);
  const promoted = completeSeason({
    ...before,
    league: before.league.map((r, i) => ({
      ...r,
      position: i === 7 ? 1 : i === 0 ? 8 : i + 1
    })),
    leaguePosition: 1
  }).game;
  expect(promoted.division).toBe(1);
  for (const p of promoted.players) {
    expect(p.value).toBe(p.skill * 5000 * 4);
  }
});
