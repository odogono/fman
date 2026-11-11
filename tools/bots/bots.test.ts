import { expect, test } from 'bun:test';

import {
  borrow,
  createNewGame,
  type Player
} from '../../web/src/sim/management';
import { createHarnessRng } from './random';
import { playRun, type RunRecord } from './run';
import {
  strategies,
  strategyNamed,
  strongestTeam,
  topEleven
} from './strategies';
import { compare, significant, summarise } from './summary';

const short = (strategy: string, seed = 7): RunRecord =>
  playRun({
    level: 4,
    ruleset: 'original',
    seasonLimit: 1,
    seed,
    strategy: strategyNamed(strategy)
  });

// A rejected answer or a stuck screen throws a BotError.
for (const strategy of strategies) {
  test(`${strategy.name} plays a season with only offered answers`, () => {
    const run = short(strategy.name);
    expect(['dismissed', 'season-limit']).toContain(run.end);
    if (run.end === 'season-limit') {
      expect(run.seasons).toHaveLength(1);
      const season = run.seasons[0]!;
      expect(season.won + season.drawn + season.lost).toBe(15);
    }
  });
}

test('a run counts its matches, injuries and short-handed matches', () => {
  const run = short('passive');
  // 15 league matches and at least one cup leg.
  expect(run.matches).toBeGreaterThan(15);
  expect(run.shortHanded).toBeLessThanOrEqual(run.matches);
  // Twelve players with a 1-in-20 draw before each match.
  expect(run.injuries).toBeGreaterThan(0);
});

test('a run is reproducible from its seed', () => {
  expect(short('balanced', 11)).toEqual(short('balanced', 11));
  expect(short('random', 11)).toEqual(short('random', 11));
});

test('answer timing changes the game', () => {
  const a = short('passive', 1);
  const b = short('passive', 2);
  expect(a.league).not.toEqual(b.league);
});

test('team choices are eleven available players', () => {
  const game = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'bot',
    seed: 0
  });
  const owned = game.players.filter(p => p.status > 0).length;
  for (const team of [strongestTeam(game), topEleven(game, p => p.energy)]) {
    expect(team.size).toBe(Math.min(11, owned));
    for (const id of team) {
      expect([1, 2]).toContain(game.players[id - 1]!.status);
    }
  }
});

// The search keeps running sums; this is the plain search it replaced.
const naiveStrongest = (players: readonly Player[]) => {
  const pool = players
    .filter(p => p.status === 1 || p.status === 2)
    .sort((a, b) => a.id - b.id);
  const size = Math.min(11, pool.length);
  const clamp = (v: number) => Math.max(1, Math.min(20, v));
  let best: Player[] = [];
  let bestKey = [-1, -1];
  const visit = (from: number, chosen: Player[]) => {
    if (chosen.length === size) {
      const skill = [0, 0, 0];
      for (const p of chosen) {
        skill[Math.floor((p.id - 1) / 8)]! += p.skill;
      }
      const energy = chosen.reduce((sum, p) => sum + p.energy, 0);
      const key = [
        clamp(Math.floor(energy / 11)) +
          skill.reduce((a, v) => a + clamp(v), 0),
        chosen.reduce((sum, p) => sum + p.skill * 20 + p.energy, 0)
      ];
      if (
        key[0]! > bestKey[0]! ||
        (key[0] === bestKey[0] && key[1]! > bestKey[1]!)
      ) {
        best = chosen;
        bestKey = key;
      }
      return;
    }
    for (let i = from; i <= pool.length - (size - chosen.length); i++) {
      visit(i + 1, [...chosen, pool[i]!]);
    }
  };
  visit(0, []);
  return new Set(best.map(p => p.id));
};

test('the strongest team is the one a plain search finds', () => {
  const rng = createHarnessRng(5);
  for (let seed = 0; seed < 40; seed++) {
    const game = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'bot',
      seed
    });
    // Squads of varied size, with injuries and extreme attributes.
    const players = game.players.map(p => ({
      ...p,
      energy: rng.int(1, 20),
      skill: rng.int(1, 5),
      status: rng.pick([0, 1, 1, 2, 3] as const)
    }));
    const varied = { ...game, players };
    expect(strongestTeam(varied)).toEqual(naiveStrongest(players));
  }
});

test('a summary compared with itself flags nothing', () => {
  const records = [1, 2, 3].flatMap(seed =>
    ['passive', 'balanced'].map(s => short(s, seed))
  );
  const summary = summarise(records, {
    levels: [4],
    ruleset: 'original',
    runs: 3,
    seasonLimit: 1,
    seed: 0,
    strategies: ['passive', 'balanced']
  });
  const differences = compare(summary, summary);
  expect(differences.length).toBeGreaterThan(0);
  expect(differences.filter(significant)).toEqual([]);
});

test('a shifted metric is flagged', () => {
  const values = Array.from({ length: 50 }, (_, i) => i % 5);
  const summary = (shift: number) => ({
    cells: [
      {
        level: 1,
        strategy: 'passive',
        values: { seasons: values.map(v => v + shift) }
      }
    ],
    format: 'fman-baseline' as const,
    levels: [1],
    ruleset: 'original',
    runs: 50,
    seasonLimit: 1,
    seed: 0,
    strategies: ['passive'],
    version: 1 as const
  });
  const [difference] = compare(summary(0), summary(2));
  expect(difference!.difference).toBe(2);
  expect(significant(difference!)).toBe(true);
});

test('random asks for a loan only when one can be accepted', () => {
  const game = {
    ...createNewGame({ club: 1, colour: 0, level: 1, manager: 'bot', seed: 0 }),
    debt: 400_000
  };
  expect(() => borrow(game, 0)).toThrow();
  const answer = strategyNamed('random').create(createHarnessRng(1));
  for (let i = 0; i < 50; i++) {
    expect(answer({ frames: 0, game, paused: false, screen: 'menu' })).not.toBe(
      'l'
    );
  }
});
