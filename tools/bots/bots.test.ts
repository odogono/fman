import { expect, test } from 'bun:test';

import { placePickedPlayer, teamStrength } from '../../web/src/sim/league';
import {
  borrow,
  createNewGame,
  type Game,
  type Player
} from '../../web/src/sim/management';
import { lineAnswer } from '../../web/src/sim/natural-positions';
import type { Ruleset } from '../../web/src/sim/ruleset';
import { createHarnessRng } from './random';
import { BotError, playRun, type RunRecord } from './run';
import {
  bestMove,
  strategies,
  strategyNamed,
  strongestTeam,
  topEleven,
  type Strategy
} from './strategies';
import { compare, significant, summarise } from './summary';

const short = (
  strategy: string,
  seed = 7,
  ruleset: Ruleset = 'original'
): RunRecord =>
  playRun({
    level: 4,
    ruleset,
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

// Natural positions (#121) offer more answers; the bots must give only offered ones.
for (const strategy of strategies) {
  test(`${strategy.name} plays a season under natural positions`, () => {
    const run = short(strategy.name, 7, 'enhanced-15');
    expect(['dismissed', 'season-limit']).toContain(run.end);
  });
}

/** An answer no decision screen offers. */
const answerX = () => 'x';
/** A strategy that answers x everywhere. */
const stray: Strategy = {
  create: () => answerX,
  description: 'Answers x everywhere.',
  name: 'stray'
};
const strayRun = () =>
  playRun({
    level: 4,
    ruleset: 'original',
    seasonLimit: 1,
    seed: 7,
    strategy: stray
  });

test('a strategy answer the prompt does not offer fails the run', () => {
  // The original would ignore it; the bots stop at it.
  expect(strayRun).toThrow(BotError);
  expect(strayRun).toThrow(
    'stray answered "x" on menu, which doesn\'t offer it'
  );
});

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

/** The sim's total strength of `team`, with its best goalkeeper in goal. */
const naturalStrength = (game: Game, team: ReadonlySet<number>) => {
  const keeper = game.players
    .filter(p => team.has(p.id) && p.position === 'GK')
    .sort((a, b) => b.skill - a.skill || a.id - b.id)[0];
  const players = game.players.map((p): Player => {
    const { plays: _, ...rest } = p;
    return team.has(p.id)
      ? {
          ...rest,
          plays: p === keeper ? 'GK' : p.position === 'GK' ? 'DF' : p.position!,
          status: 2
        }
      : { ...rest, status: p.status === 2 ? 1 : p.status };
  });
  const [energy, , ...rest] = teamStrength({ ...game, players });
  return energy! + rest.reduce((a, v) => a + v, 0);
};

/** The best score of any `size` ids from `pool`, by plain search. */
const bestOf = (
  pool: readonly number[],
  size: number,
  score: (team: ReadonlySet<number>) => number
) => {
  let best = -1;
  const visit = (from: number, chosen: number[]) => {
    if (chosen.length === size) {
      best = Math.max(best, score(new Set(chosen)));
      return;
    }
    for (let i = from; i <= pool.length - (size - chosen.length); i++) {
      visit(i + 1, [...chosen, pool[i]!]);
    }
  };
  visit(0, []);
  return best;
};

test('under natural positions the strongest team scores as the sim does', () => {
  const rng = createHarnessRng(9);
  for (let seed = 0; seed < 8; seed++) {
    const game = createNewGame({
      club: 1,
      level: 1,
      manager: 'bot',
      ruleset: 'enhanced-15',
      seed
    });
    const varied: Game = {
      ...game,
      players: game.players.map(p => ({
        ...p,
        energy: rng.int(1, 20),
        skill: rng.int(1, 5),
        status: p.status === 0 ? p.status : rng.pick([1, 1, 2, 3] as const)
      }))
    };
    const pool = varied.players.filter(p => p.status === 1 || p.status === 2);
    expect(naturalStrength(varied, strongestTeam(varied))).toBe(
      bestOf(
        pool.map(p => p.id),
        Math.min(11, pool.length),
        naturalStrength.bind(undefined, varied)
      )
    );
    const keepers = [...topEleven(varied, p => p.skill)].filter(
      id => varied.players[id - 1]!.position === 'GK'
    );
    const outfield = pool.filter(p => p.position !== 'GK').length;
    const keeping = pool.length - outfield;
    expect(keepers).toHaveLength(
      Math.min(keeping, Math.max(Number(keeping > 0), 11 - outfield))
    );
  }
});

test('under natural positions the bots move players while it raises strength', () => {
  const game = createNewGame({
    club: 1,
    level: 1,
    manager: 'bot',
    ruleset: 'enhanced-15',
    seed: 3
  });
  // Every picked player a skill-5 midfielder: midfield is full at 20, so
  // moving some into defence and attack adds strength.
  let next: Game = {
    ...game,
    players: game.players.map(p =>
      p.status === 2 ? { ...p, plays: 'MF', position: 'MF', skill: 5 } : p
    )
  };
  const before = teamStrength(next);
  let moves = 0;
  for (let move = bestMove(next); move; move = bestMove(next)) {
    const placing = lineAnswer(move)!;
    next = placePickedPlayer(next, placing.id, placing.line);
    moves++;
    expect(moves).toBeLessThan(40);
  }
  expect(moves).toBeGreaterThan(0);
  const after = teamStrength(next);
  expect(after[3]).toBeLessThanOrEqual(20);
  expect(after[2]! + after[3]! + after[4]!).toBeGreaterThan(
    before[2]! + before[3]! + before[4]!
  );
});
