import { payWeeklyBills, type Game } from './management';
import { createRng } from './rng';

const clamp = (value: number) => Math.max(1, Math.min(20, value));
export const teamStrength = (game: Game): number[] => {
  const result = [0, game.morale, 0, 0, 0];
  for (const player of game.players) {
    if (player.status !== 2) {
      continue;
    }
    result[0] = result[0]! + player.energy;
    const category = Math.floor((player.id - 1) / 8) + 2;
    result[category] = result[category]! + player.skill;
  }
  result[0] = Math.floor(result[0]! / 11);
  return result.map(clamp);
};

export const togglePickedPlayer = (game: Game, id: number): Game => {
  const player = game.players[id - 1];
  if (!player) {
    throw new RangeError('PLAYER NO. OUT OF RANGE');
  }
  const removing = game.players.filter(p => p.status === 2).length > 11;
  if (removing && player.status !== 2) {
    throw new RangeError('PLAYER NOT IN TEAM');
  }
  if (!removing && player.status !== 1) {
    throw new RangeError('PLAYER NOT AVAILABLE');
  }
  return {
    ...game,
    players: game.players.map(p =>
      p.id === id ? { ...p, status: removing ? 1 : 2 } : p
    )
  };
};

export const prepareFirstMatch = (game: Game) => {
  if (game.leagueMatches !== 0) {
    throw new RangeError('Only the first league match is available');
  }
  const offset = (game.division - 1) * 16;
  const opponent = game.club === offset + 1 ? offset + 16 : offset + 1;
  const rng = createRng(game.seed);
  const opponentStrength = Array.from({ length: 5 }, () =>
    clamp(rng.int(1, 14) + game.level)
  );
  return {
    game: { ...game, leagueMatches: 1, scheduleCounter: 2, seed: rng.seed },
    gate: game.homeGate,
    home: true,
    kind: 'league' as const,
    opponent,
    opponentStrength
  };
};
export type MatchFixture = {
  game: Game;
  gate: number;
  home: boolean;
  kind: 'league' | 'cup';
  opponent: number;
  opponentStrength: readonly number[];
};

export const completeFirstMatch = (
  game: Game,
  fixture: MatchFixture,
  score: readonly number[]
) => {
  if (game.leagueMatches !== 1) {
    throw new RangeError('Expected the first league match');
  }
  const factor = 5 - game.division;
  const offset = (game.division - 1) * 16;
  const user = game.club - offset - 1;
  const opponent = fixture.opponent - offset - 1;
  const league = game.league.map(record => ({ ...record }));
  const results: { away: number; home: number; score: readonly number[] }[] =
    [];
  const record = (home: number, away: number, goals: readonly number[]) => {
    const a = league[home]!;
    const b = league[away]!;
    a.for += goals[0]!;
    a.against += goals[1]!;
    b.for += goals[1]!;
    b.against += goals[0]!;
    a.points += goals[0]! > goals[1]! ? 3 : goals[0] === goals[1] ? 1 : 0;
    b.points += goals[1]! > goals[0]! ? 3 : goals[0] === goals[1] ? 1 : 0;
  };
  record(user, opponent, score);
  const win = score[0]! > score[1]!;
  const loss = score[0]! < score[1]!;
  const homeGate = loss
    ? Math.max(1000, game.homeGate - Math.floor(game.homeGate / 10))
    : win
      ? game.homeGate + Math.floor((10_000 * factor - game.homeGate) / 10)
      : game.homeGate;
  const morale = clamp(
    win
      ? game.morale + Math.floor((20 - game.morale) / 2)
      : loss
        ? Math.floor(game.morale / 2)
        : game.morale
  );
  const rng = createRng(game.seed);
  const used = new Set([user, opponent]);
  for (let i = 0; i < 7; i++) {
    let home: number;
    let away: number;
    do {
      home = rng.int(1, 16) - 1;
    } while (used.has(home));
    used.add(home);
    do {
      away = rng.int(1, 16) - 1;
    } while (used.has(away));
    used.add(away);
    const goals = [
      Math.floor(league[home]!.points + rng.next() * 4),
      Math.floor(league[away]!.points + rng.next() * 4)
    ];
    record(home, away, goals);
    results.push({
      away: away + offset + 1,
      home: home + offset + 1,
      score: goals
    });
  }
  const order = Array.from({ length: 16 }, (_, i) => i);
  for (let pass = 1; pass <= 16; pass++) {
    let changed = false;
    for (let i = 0; i < 16 - pass; i++) {
      const a = league[order[i]!]!;
      const b = league[order[i + 1]!]!;
      if (
        a.points > b.points ||
        (a.points === b.points &&
          (a.for - a.against > b.for - b.against ||
            (a.for - a.against === b.for - b.against && a.for > b.for)))
      ) {
        continue;
      }
      [order[i], order[i + 1]] = [order[i + 1]!, order[i]!];
      changed = true;
    }
    if (!changed) {
      break;
    }
  }
  order.forEach((index, rank) => {
    league[index]!.position = rank + 1;
  });
  const billed = payWeeklyBills({
    ...game,
    cash: game.cash + fixture.gate,
    homeGate,
    league,
    leaguePosition: league[user]!.position,
    morale,
    seed: rng.seed
  });
  return { ...billed, order, results };
};
export type MatchCompletion = ReturnType<typeof completeFirstMatch>;
