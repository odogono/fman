import { createRng } from './rng';

export type Position = Readonly<{ x: number; y: number }>;
export type AttackCarry = Readonly<{
  attackers: readonly Position[];
  defenders: readonly Position[];
}>;
export type SpriteDraw = Position & Readonly<{ glyph: number; ink: number }>;
export type HighlightFrame = Readonly<{
  draws: readonly SpriteDraw[];
  duration: number;
  kind: 'draw' | 'goal' | 'miss' | 'pause';
  tones: readonly { duration: number; pitch: number }[];
}>;
export type Attack = Readonly<{
  carry: AttackCarry;
  direction: 'left' | 'right';
  frames: readonly HighlightFrame[];
  goal: boolean;
  seed: number;
  trace: readonly number[][];
}>;

export const emptyAttackCarry = (): AttackCarry => ({
  attackers: Array.from({ length: 3 }, () => ({ x: 0, y: 0 })),
  defenders: Array.from({ length: 3 }, () => ({ x: 0, y: 0 }))
});

export const simulateAttack = (input: {
  awayInk: number;
  carry: AttackCarry;
  direction: 'left' | 'right';
  homeInk: number;
  seed: number;
}): Attack => {
  const right = input.direction === 'right';
  const direction = right ? 1 : -1;
  const attackInk = right ? input.homeInk : input.awayInk;
  const defendInk = right ? input.awayInk : input.homeInk;
  const rng = createRng(input.seed);
  const roll = (n: number) => rng.int(1, n);
  // Rows in not-yet-overwritten slots participate in rejection sampling.
  const f = input.carry.attackers.map(p => ({ ...p }));
  const g = input.carry.defenders.map(p => ({ ...p }));
  const attributes = new Uint8Array(24 * 32).fill(102);
  attributes.fill(56, 22 * 32);
  const frames: HighlightFrame[] = [];
  const trace: number[][] = [];
  let draws: SpriteDraw[] = [];
  const glyphs = right
    ? [6, 7, 8, 9, 4, 14, 12, 1]
    : [0, 1, 2, 3, 4, 13, 11, 7];
  const ballGlyph = right ? 10 : 5;
  const keeperGlyphs = right ? [12, 1] : [11, 7];
  const attr = (x: number, y: number) => {
    // ATTR uses the ROM's absolute byte conversion and XOR address mapping;
    // it does not clamp columns to the visible 0..31 range.
    const row = Math.abs(y) & 255;
    const column = Math.abs(x) & 255;
    const low = ((row & 7) * 32) ^ column;
    const high = ((row >> 3) & 3) ^ 88;
    return attributes[(high - 88) * 256 + low] ?? 56;
  };
  const print = (p: Position, glyph: number, ink: number) => {
    attr(p.x, p.y);
    if (ink < 0 || ink > 7) {
      throw new RangeError('Invalid highlight INK');
    }
    attributes[p.y * 32 + p.x] = 96 + ink;
    draws.push({ ...p, glyph, ink });
  };
  const foot = (p: Position, index: number, ink: number) =>
    print(p, glyphs[index - 1]!, ink);
  const frame = (
    duration: number,
    tones: HighlightFrame['tones'] = [],
    kind: HighlightFrame['kind'] = 'draw'
  ) => {
    frames.push({ draws, duration, kind, tones });
    draws = [];
  };
  let attempts = 0;
  const retry = () => {
    if (++attempts > 10_000) {
      throw new Error('Highlight placement did not converge');
    }
  };
  f[0]!.y = 3 + roll(18);
  f[0]!.x = right ? 6 - roll(6) : 25 + roll(6);
  const ball = { dx: direction, dy: 0, x: f[0]!.x + direction, y: f[0]!.y };
  let keeperFrame = 1;
  let keeperX = right
    ? 20 - roll(2) - 2 * Number(f[0]!.y < 11) + 2 * Number(f[0]!.y > 10)
    : 11 + roll(2) + 2 * Number(f[0]!.y < 11) - 2 * Number(f[0]!.y > 10);
  let keeperY = right ? keeperX - 8 : 23 - keeperX;
  for (let i = 1; i < 3; i++) {
    do {
      retry();
      f[i]!.x = right ? 21 - roll(20) : 10 + roll(20);
      f[i]!.y = roll(21);
    } while (
      (right
        ? f[i]!.x - f[i]!.y > 6 || f[i]!.x < f[0]!.x + 4
        : f[i]!.x + f[i]!.y < 25 || f[i]!.x > f[0]!.x - 4) ||
      f.some((p, j) => j !== i && p.y === f[i]!.y)
    );
  }
  for (let i = 0; i < 3; i++) {
    do {
      retry();
      g[i]!.x = right ? 21 - roll(10) : 10 + roll(10);
      g[i]!.y = roll(18);
    } while (
      (right
        ? g[i]!.x - g[i]!.y > 7 || g[i]!.x < f[0]!.x + 4
        : g[i]!.x + g[i]!.y < 24 || g[i]!.x > f[0]!.x - 4) ||
      f.some(p => p.y === g[i]!.y) ||
      g.some((p, j) => j !== i && p.y === g[i]!.y)
    );
  }
  foot(f[0]!, 1, attackInk);
  for (let i = 1; i < 3; i++) {
    foot(f[i]!, 1 + 2 * Number(f[i]!.y < 10), attackInk);
  }
  for (const p of g) {
    foot(p, 2 + 2 * Number(p.y < 10), defendInk);
  }
  print(ball, ballGlyph, 1);
  print({ x: keeperX, y: keeperY }, keeperGlyphs[0]!, defendInk);
  frame(1);
  let wm = 1;
  let wm1 = 1;
  const dribbles = roll(3) * 2 - 1;
  for (let i = 0; i < dribbles; i++) {
    wm1 = wm;
    wm = 3 - wm;
    print(ball, ballGlyph, 6);
    ball.x += direction;
    print(ball, ballGlyph, 1);
    foot(f[0]!, wm1, 6);
    f[0]!.x += direction;
    foot(f[0]!, wm, attackInk);
    for (const [players, start, ink, old, next, threshold] of [
      [f, 1, attackInk, wm1, wm, right ? 7 : 24],
      [g, 0, defendInk, wm, wm1, right ? 8 : 23]
    ] as const) {
      for (let j = start; j < 3; j++) {
        const p = players[j]!;
        const y = p.y + Number(p.y < 10) - Number(p.y > 9);
        const x = p.x + direction;
        const move =
          attr(x, y) === 102 && (right ? x - y < threshold : x + y > threshold);
        foot(p, old + 2 * Number(p.y < 10), 6);
        if (move) {
          p.x = x;
          p.y = y;
        }
        foot(p, next + 2 * Number(p.y < 10), ink);
      }
    }
    frame(30);
  }
  for (const p of g) {
    foot(p, wm1 + 2 * Number(p.y < 10), 6);
    foot(p, 5, defendInk);
  }
  for (let i = 1; i < 3; i++) {
    foot(f[i]!, wm + 2 * Number(f[i]!.y < 10), 6);
    foot(f[i]!, 5, attackInk);
  }
  foot(f[0]!, 2, 6);
  foot(f[0]!, 1, attackInk);
  // Sinclair's arithmetic boolean expressions evaluate random operands eagerly.
  ball.dy =
    Number(ball.y < 8) -
    Number(ball.y > 15) +
    Number(ball.y > 12 && ball.y < 16) * (roll(2) - 2);
  ball.dx = direction * 2;
  frame(8, [{ duration: 0.15, pitch: -40 }]);
  let was = 6;
  let out = false;
  const stepBall = () => {
    const x = ball.x + ball.dx;
    const y = ball.y + ball.dy;
    const des = attr(x, y);
    const diagonal = right ? x - y : x + y;
    if (
      (right
        ? diagonal >= 4 && diagonal <= 7
        : diagonal >= 24 && diagonal <= 27) &&
      y > 7 &&
      y < 14
    ) {
      print({ x: keeperX, y: keeperY }, keeperGlyphs[keeperFrame - 1]!, 6);
      keeperFrame = 3 - keeperFrame;
      const delta =
        Number(ball.y > keeperY + Number(ball.dy !== 0)) -
        Number(ball.y < keeperY - Number(ball.dy !== 0));
      keeperY += delta;
      keeperX = right ? keeperY + 8 : 23 - keeperY;
      print(
        { x: keeperX, y: keeperY },
        keeperGlyphs[keeperFrame - 1]!,
        defendInk
      );
    }
    const outside =
      (right ? x - y > 9 || x < 0 : x + y < 22 || x > 31) || y < 0 || y > 21;
    let duration = 18;
    print(ball, ballGlyph, was);
    if (outside) {
      out = true;
      ball.x = x;
      ball.y = y;
      if (
        (right ? x - y > 9 : x + y < 22) &&
        y >= 0 &&
        y <= 21 &&
        x >= 0 &&
        x <= 31
      ) {
        print(ball, ballGlyph, 1);
      }
    } else if (des !== 102) {
      ball.dx =
        (des === 96 + input.homeInk ? 2 : 0) +
        (des === 96 + input.awayInk ? -2 : 0);
      // Both random draws occur, even when one term's multiplier is zero.
      ball.dy =
        Number(ball.dx === direction * 2) * (roll(2) - 2) +
        Number(ball.dx === -direction * 2) * (roll(3) - 2);
      const destination = { x, y };
      print(destination, ballGlyph, des - 96);
      const keeperCell = right ? x - y === 8 : x + y === 23;
      const standing = keeperCell ? 6 + keeperFrame : 5;
      foot(destination, standing, des - 96);
      foot(destination, 6, des - 96);
      frame(11.5, [
        { duration: 0.15, pitch: -30 },
        { duration: 0.08, pitch: -40 }
      ]);
      foot(destination, 6, des - 96);
      foot(destination, standing, des - 96);
      ball.x = x;
      ball.y = y;
      duration = 28.5;
    } else {
      print({ x, y }, ballGlyph, 1);
      ball.x = x;
      ball.y = y;
    }
    was = des - 96;
    trace.push([ball.x, ball.y, ball.dx, ball.dy, rng.seed]);
    frame(duration);
  };
  stepBall();
  stepBall();
  stepBall();
  foot(f[0]!, 1, attackInk);
  foot(f[0]!, 5, attackInk);
  let steps = 3;
  while (!out) {
    if (++steps > 10_000) {
      throw new Error('Highlight ball did not leave play');
    }
    stepBall();
  }
  const goal = right
    ? ball.x - ball.y > 9 &&
      ball.y < 14 &&
      ball.y > 4 &&
      ball.x > 16 &&
      ball.x < 25 &&
      !(ball.x === 24 && ball.y === 13 && ball.dy < 0)
    : ball.x + ball.y < 22 &&
      ball.y < 14 &&
      ball.y > 4 &&
      ball.x < 15 &&
      ball.x > 6 &&
      !(ball.x === 7 && ball.y === 13 && ball.dy < 0);
  if (goal) {
    const count = 5 + roll(5);
    const tones = Array.from({ length: count }, () => ({
      duration: 0.05,
      pitch: roll(36)
    }));
    frame(count * 2.5, tones, 'goal');
  } else {
    frame(12.5, [{ duration: 0.25, pitch: -50 }], 'miss');
  }
  frame(200, [], 'pause');
  return {
    carry: { attackers: f, defenders: g },
    direction: input.direction,
    frames,
    goal,
    seed: rng.seed,
    trace
  };
};

export const simulateHighlights = (input: {
  awayInk: number;
  carry?: AttackCarry;
  home: boolean;
  homeInk: number;
  opponent: readonly number[];
  seed: number;
  strength: readonly number[];
}) => {
  let seed = input.seed;
  let carry = input.carry ?? emptyAttackCarry();
  const score = [0, 0];
  const attacks: Attack[] = [];
  const attack = (home: boolean) => {
    const result = simulateAttack({
      ...input,
      carry,
      direction: home ? 'right' : 'left',
      seed
    });
    carry = result.carry;
    seed = result.seed;
    if (result.goal) {
      score[home ? 0 : 1] = score[home ? 0 : 1]! + 1;
    }
    attacks.push(result);
  };
  for (let i = 0; i < 5; i++) {
    for (const user of [true, false]) {
      const rng = createRng(seed);
      const difference =
        (input.strength[i]! - input.opponent[i]!) * (user ? 1 : -1);
      const n = rng.int(1, 100) + difference * 5;
      seed = rng.seed;
      if (n >= 75) {
        attack(user ? input.home : !input.home);
        attack(user ? input.home : !input.home);
      }
    }
  }
  if (score[0]! + score[1]! === 0) {
    attack(true);
    attack(false);
  }
  return { attacks, carry, score, seed };
};
