import { expect, test } from 'bun:test';

import { createNewGame, type Player } from './management';
import { decideMoments, type Moment } from './moments';
import { penaltyOdds } from './penalties';
import {
  clearances,
  clubSquads,
  gracePeriodWeeks,
  lastingSkill,
  latestEnhanced,
  matchInjuries,
  momentHighlights,
  opponentBonus,
  penalties,
  plainNames,
  presentDay,
  rulesets,
  tiringInjuries
} from './ruleset';

const players: Player[] = createNewGame({
  club: 1,
  level: 1,
  manager: 'alex',
  ruleset: 'enhanced-10',
  seed: 0
}).players.map((p, i) => ({
  ...p,
  // Tired, so injuries are common enough to test the fouls.
  energy: 3,
  status: i < 11 ? 2 : 1
}));

const even = [10, 10, 10, 10, 10];

const decide = (seed: number, withPenalties = true) =>
  decideMoments({
    clearances: true,
    home: seed % 2 === 0,
    injuries: true,
    opponent: even,
    penalties: withPenalties,
    players,
    seed,
    strength: even
  });

const seeds = Array.from({ length: 4000 }, (_, i) => (i * 7919 + 1) % 65_536);

test('Enhanced version 11 is version 10 with penalties, which later versions keep', () => {
  expect(rulesets.filter(r => penalties(r))).toEqual([
    'enhanced-11',
    'enhanced-12',
    'enhanced-13',
    'enhanced-14'
  ]);
  expect(penalties(latestEnhanced)).toBe(true);
  for (const accessor of [
    clearances,
    clubSquads,
    gracePeriodWeeks,
    lastingSkill,
    matchInjuries,
    momentHighlights,
    plainNames,
    presentDay,
    tiringInjuries
  ]) {
    expect(accessor('enhanced-11')).toEqual(accessor('enhanced-10'));
  }
  for (let level = 1; level <= 7; level++) {
    expect(opponentBonus('enhanced-11', level)).toBe(
      opponentBonus('enhanced-10', level)
    );
  }
});

test('penalties leave every other moment, and the seed, as they were', () => {
  for (const seed of seeds.slice(0, 500)) {
    const plain = decide(seed, false);
    const withPenalties = decide(seed);
    expect(withPenalties.seed).toBe(plain.seed);
    expect(
      withPenalties.moments
        .filter(m => !m.penalty)
        .map(({ foul: _foul, ...m }) => m)
    ).toEqual(plain.moments);
  }
});

test('about one match in four has a penalty, scored as often as any chance', () => {
  const all = seeds.map(seed => decide(seed).moments);
  const taken = all.flatMap(moments => moments.filter(m => m.penalty));
  const matches = all.filter(moments => moments.some(m => m.penalty)).length;
  const expected = 1 - (1 - 1 / penaltyOdds) ** 2;
  expect(Math.abs(matches / all.length - expected)).toBeLessThan(0.02);
  for (const side of ['club', 'opponent'] as const) {
    const share = taken.filter(m => m.side === side).length / all.length;
    expect(Math.abs(share - 1 / penaltyOdds)).toBeLessThan(0.02);
  }
  const scored = taken.filter(m => m.kind === 'goal').length / taken.length;
  expect(Math.abs(scored - 0.55)).toBeLessThan(0.04);
  expect(new Set(taken.map(m => m.kind))).toEqual(
    new Set(['goal', 'near-miss', 'save'])
  );
});

const goalsOf = (moments: readonly Moment[], side: Moment['side']) =>
  moments.filter(m => m.kind === 'goal' && m.side === side).length;

test('a penalty goal counts in the score', () => {
  for (const seed of seeds.slice(0, 1000)) {
    const result = decide(seed);
    const home = seed % 2 === 0 ? 'club' : 'opponent';
    const away = home === 'club' ? 'opponent' : 'club';
    expect(result.score).toEqual([
      goalsOf(result.moments, home),
      goalsOf(result.moments, away)
    ]);
  }
});

test("a club's penalty is for the tackle that injured a player, taken by someone fit", () => {
  let fouls = 0;
  for (const seed of seeds) {
    const { moments } = decide(seed);
    const penalty = moments.find(m => m.penalty && m.side === 'club');
    const tackled = moments.filter(m => m.kind === 'injury' && m.tackled);
    const foul = moments.find(m => m.foul);
    if (!penalty) {
      expect(foul).toBeUndefined();
      continue;
    }
    if (tackled.length) {
      fouls++;
      // The first injury from a tackle, then the penalty straight after.
      expect(foul).toBe(tackled[0]);
      expect(moments[moments.indexOf(foul!) + 1]).toBe(penalty);
      expect(penalty.player).not.toBe(foul!.player);
    } else {
      expect(foul).toBeUndefined();
    }
    // Nobody takes a penalty after going off injured.
    const off = moments.find(
      m => m.kind === 'injury' && m.player === penalty.player
    );
    expect(off === undefined || off.minute > penalty.minute).toBe(true);
    expect(
      off === undefined || moments.indexOf(off) > moments.indexOf(penalty)
    ).toBe(true);
  }
  expect(fouls).toBeGreaterThan(20);
});
