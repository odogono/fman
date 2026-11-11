import { payWeeklyBills, type Game } from './management';
import { scorePrintReport, tablePrintReport } from './name-print-fault';
import { add, divide, floor, fromNumber, multiply, toNumber } from './numeric';
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

/** How many players are in the picked team. */
export const pickedCount = (game: Game) =>
  game.players.filter(player => player.status === 2).length;

export const togglePickedPlayer = (game: Game, id: number): Game => {
  const player = game.players[id - 1];
  if (!player) {
    throw new RangeError('PLAYER NO. OUT OF RANGE');
  }
  const removing = pickedCount(game) > 11;
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

/** The season ends once fifteen league matches are played and the cup is over. */
export const seasonOver = (game: Game) =>
  game.leagueMatches >= 15 && game.cupFinished;

export const nextFixture = (game: Game) => {
  if (seasonOver(game)) {
    return 'season';
  }
  if ((game.scheduleCounter + 1) % 3 === 0 && !game.cupFinished) {
    return 'cup';
  }
  return game.leagueMatches >= 15 ? 'season' : 'league';
};

export const prepareLeagueMatch = (game: Game) => {
  if (nextFixture(game) !== 'league') {
    throw new RangeError('The next fixture is not an available league match');
  }
  const offset = (game.division - 1) * 16;
  const leagueMatches = game.leagueMatches + 1;
  const opponent =
    offset + leagueMatches === game.club ? offset + 16 : offset + leagueMatches;
  const rng = createRng(game.seed);
  const pointsPerMatch = divide(
    fromNumber(game.league[opponent - offset - 1]!.points),
    fromNumber(leagueMatches)
  );
  const opponentStrength = Array.from({ length: 5 }, () =>
    clamp(
      toNumber(
        floor(add(fromNumber(rng.int(1, 14) + game.level), pointsPerMatch))
      )
    )
  );
  const home = !game.leagueHome;
  return {
    game: {
      ...game,
      leagueHome: home,
      leagueMatches,
      scheduleCounter: (game.scheduleCounter + 1) % 3,
      seed: rng.seed
    },
    gate: home
      ? game.homeGate
      : (17 - game.league[opponent - offset - 1]!.position) *
        (5 - game.division) *
        500,
    home,
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

export const completeLeagueMatch = (
  game: Game,
  fixture: MatchFixture,
  score: readonly number[]
) => {
  if (
    game.leagueMatches < 1 ||
    game.leagueMatches > 15 ||
    fixture.kind !== 'league'
  ) {
    throw new RangeError('Expected a league match in the current season');
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
  record(fixture.home ? user : opponent, fixture.home ? opponent : user, score);
  const ownGoals = score[fixture.home ? 0 : 1]!;
  const opposingGoals = score[fixture.home ? 1 : 0]!;
  const win = ownGoals > opposingGoals;
  const loss = ownGoals < opposingGoals;
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
  const retained = (): Game => ({
    ...game,
    cash: game.cash + fixture.gate,
    homeGate,
    league,
    leaguePosition: league[user]!.position,
    morale,
    seed: rng.seed
  });
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
      toNumber(
        floor(
          add(
            divide(
              fromNumber(league[home]!.points),
              fromNumber(game.leagueMatches)
            ),
            multiply(fromNumber(rng.next()), fromNumber(4))
          )
        )
      ),
      toNumber(
        floor(
          add(
            divide(
              fromNumber(league[away]!.points),
              fromNumber(game.leagueMatches)
            ),
            multiply(fromNumber(rng.next()), fromNumber(4))
          )
        )
      )
    ];
    results.push({
      away: away + offset + 1,
      home: home + offset + 1,
      score: goals
    });
    const printFault = scorePrintReport(
      game,
      home + offset + 1,
      away + offset + 1,
      goals,
      7630
    );
    if (printFault) {
      // BASIC reuses t() for pairing flags; this PRINT precedes the score
      // updates, sorting and weekly bills, even for the failing pairing.
      league.forEach((entry, index) => {
        entry.position = Number(used.has(index));
      });
      return {
        bills: undefined,
        game: retained(),
        order: [],
        printFault,
        results
      };
    }
    record(home, away, goals);
  }
  const order = Array.from({ length: 16 }, (_, i) => i);
  if (game.leagueMatches > 1) {
    order.sort((a, b) => game.league[a]!.position - game.league[b]!.position);
  }
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
  league.forEach(entry => {
    entry.position = 1;
  });
  for (const [rank, index] of order.entries()) {
    const printFault = tablePrintReport(retained(), index);
    if (printFault) {
      return { bills: undefined, game: retained(), order, printFault, results };
    }
    league[index]!.position = rank + 1;
  }
  const billed = payWeeklyBills(retained());
  return { ...billed, order, printFault: undefined, results };
};
export type MatchCompletion = ReturnType<typeof completeLeagueMatch>;
