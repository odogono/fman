import { expect, test } from 'bun:test';

import cases from './fixtures/first-matches.json';
import { simulateAttack, simulateHighlights } from './highlights';

const positions = (rows: number[][]) =>
  rows.map(([x, y]) => ({ x: x!, y: y! }));
for (const game of cases) {
  for (const [index, attack] of game.attacks.entries()) {
    test(`original attack ${game.seed}/${index}: positions, ball trace and RNG`, () => {
      const result = simulateAttack({
        awayInk: 7,
        carry: {
          attackers: positions(attack.initial.attackers),
          defenders: positions(attack.initial.defenders)
        },
        direction: attack.direction as 'left' | 'right',
        homeInk: 0,
        seed: attack.initial.seed
      });
      expect(result.trace).toEqual(attack.trace);
      expect(result.seed).toBe(attack.final.seed);
      expect(result.carry.attackers.map(p => [p.x, p.y])).toEqual(
        attack.final.attackers
      );
      expect(result.carry.defenders.map(p => [p.x, p.y])).toEqual(
        attack.final.defenders
      );
      const side = attack.direction === 'right' ? 0 : 1;
      expect(result.goal).toBe(
        attack.score[side]! > (game.attacks[index - 1]?.score[side] ?? 0)
      );
    });
  }
  test(`original whole match seed ${game.seed}`, () => {
    const result = simulateHighlights({
      awayInk: 7,
      home: true,
      homeInk: 0,
      opponent: game.opponentStrength,
      seed: game.highlightSeed!,
      strength: game.strength
    });
    expect(result.score).toEqual(game.score);
    expect(result.seed).toBe(game.finalSeed);
    expect(game.attacks.map(a => a.direction)).toEqual(
      result.attacks.map(a => a.direction)
    );
  });
}

test('a collision holds the kicking sprite during its two beeps before restoring the standing player', () => {
  const reference = cases
    .flatMap(game => game.attacks)
    .find(attack =>
      attack.trace.some(
        (step, index) => index > 0 && step[4] !== attack.trace[index - 1]![4]
      )
    )!;
  const attack = simulateAttack({
    awayInk: 7,
    carry: {
      attackers: positions(reference.initial.attackers),
      defenders: positions(reference.initial.defenders)
    },
    direction: reference.direction as 'left' | 'right',
    homeInk: 0,
    seed: reference.initial.seed
  });
  const collision = attack.frames.findIndex(
    frame => frame.checkpoint === 'collision'
  );
  expect(collision).toBeGreaterThanOrEqual(0);
  const kicking = attack.frames
    .slice(0, collision + 1)
    .flatMap(frame => frame.draws)
    .at(-1)!;
  expect([13, 14]).toContain(kicking.glyph);
  const following = attack.frames.slice(collision + 1);
  const restored = following.findIndex(frame => frame.draws.length > 0);
  expect(following.slice(0, restored).flatMap(frame => frame.tones)).toEqual([
    { duration: 0.15, pitch: -30 },
    { duration: 0.08, pitch: -40 }
  ]);
  expect(following[restored]!.draws[0]?.glyph).toBe(kicking.glyph);
});
