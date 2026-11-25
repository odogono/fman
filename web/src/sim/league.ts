import { addResults, formOf, formStrength } from './club-form';
import { payWeeklyBills, type Game, type Player } from './management';
import { scorePrintReport, tablePrintReport } from './name-print-fault';
import {
  countedCategory,
  countedSkill,
  emptyGoalCost,
  goalFilled,
  place
} from './natural-positions';
import { add, divide, floor, fromNumber, multiply, toNumber } from './numeric';
import { createRng } from './rng';
import {
  clubForm,
  evenTable,
  naturalPositions,
  opponentBonus,
  squadStrength
} from './ruleset';
import { rolledAttribute, squadGoals, squadTerms } from './squad-strength';
import type { Position } from './squads';

const clamp = (value: number) => Math.max(1, Math.min(20, value));
export const teamStrength = (game: Game): number[] => {
  const result = [0, game.morale, 0, 0, 0];
  for (const player of game.players) {
    if (player.status !== 2) {
      continue;
    }
    result[0] = result[0]! + player.energy;
    const category = countedCategory(player) + 2;
    result[category] = result[category]! + countedSkill(player);
  }
  result[0] = Math.floor(result[0]! / 11);
  // Under natural positions (#121) defence pays for an empty goal.
  if (naturalPositions(game.ruleset) && !goalFilled(game.players)) {
    result[2] = result[2]! - emptyGoalCost;
  }
  return result.map(clamp);
};

/** The clubs at a fixture: home and away, and the managed club and its opponent. */
export const fixtureSides = (game: Game, fixture: MatchFixture) => {
  const club = game.clubs[game.club - 1]!;
  const opponent = game.clubs[fixture.opponent - 1]!;
  return {
    away: fixture.home ? opponent : club,
    club,
    home: fixture.home ? club : opponent,
    opponent
  };
};

/** How many players are in the picked team. */
export const pickedCount = (game: Game) =>
  game.players.filter(player => player.status === 2).length;

/** Over eleven picked, a pick only drops a player; otherwise it only adds one. */
export const removesOnly = (game: Game) => pickedCount(game) > 11;

export const togglePickedPlayer = (game: Game, id: number): Game => {
  const player = game.players[id - 1];
  if (!player) {
    throw new RangeError('PLAYER NO. OUT OF RANGE');
  }
  const removing = removesOnly(game);
  if (removing && player.status !== 2) {
    throw new RangeError('PLAYER NOT IN TEAM');
  }
  if (!removing && player.status !== 1) {
    throw new RangeError('PLAYER NOT AVAILABLE');
  }
  const players = game.players.map((p): Player =>
    p.id === id ? { ...p, status: removing ? 1 : 2 } : p
  );
  return {
    ...game,
    players:
      naturalPositions(game.ruleset) && !removing ? place(players, id) : players
  };
};

/**
 * Under natural positions (#121), a number and a line letter: puts a picked
 * player in that line, or picks a reserve there. Moving a picked player
 * isn't an add, so it is taken even over eleven picked, when the original
 * only drops.
 */
export const placePickedPlayer = (
  game: Game,
  id: number,
  line: Position
): Game => {
  const player = game.players[id - 1];
  if (!player) {
    throw new RangeError('PLAYER NO. OUT OF RANGE');
  }
  if (player.status !== 2) {
    if (removesOnly(game)) {
      throw new RangeError('PLAYER NOT IN TEAM');
    }
    if (player.status !== 1) {
      throw new RangeError('PLAYER NOT AVAILABLE');
    }
  }
  const players = game.players.map(p =>
    p.id === id ? { ...p, status: 2 as const } : p
  );
  return { ...game, players: place(players, id, line) };
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

/** The club the next league match is against: the division's next in turn. */
const leagueOpponent = (game: Game) => {
  const offset = (game.division - 1) * 16;
  const turn = offset + game.leagueMatches + 1;
  return turn === game.club ? offset + 16 : turn;
};

/**
 * The next fixture as the Home screen shows it, drawing nothing. A league
 * match names its opponent and venue, which nothing before kick-off can
 * change. A cup round names only the round: its draw follows a seed that is
 * redrawn each time play returns to the menu.
 */
export type FixturePreview =
  | { home: boolean; kind: 'league'; opponent: number }
  | { kind: 'cup'; round: number };

export const previewFixture = (game: Game): FixturePreview | undefined => {
  switch (nextFixture(game)) {
    case 'season':
      return undefined;
    case 'cup':
      return { kind: 'cup', round: game.cupRound + 1 };
    case 'league':
      return {
        home: !game.leagueHome,
        kind: 'league',
        opponent: leagueOpponent(game)
      };
  }
};

/**
 * A league match's gate receipts: the home gate at home; away, more the
 * higher the opponent stands in the table.
 */
export const leagueGate = (game: Game, opponent: number, home: boolean) =>
  home
    ? game.homeGate
    : (17 - game.league[opponent - (game.division - 1) * 16 - 1]!.position) *
      (5 - game.division) *
      500;

export const prepareLeagueMatch = (game: Game) => {
  if (nextFixture(game) !== 'league') {
    throw new RangeError('The next fixture is not an available league match');
  }
  const offset = (game.division - 1) * 16;
  const leagueMatches = game.leagueMatches + 1;
  const opponent = leagueOpponent(game);
  const rng = createRng(game.seed);
  const pointsPerMatch = divide(
    fromNumber(game.league[opponent - offset - 1]!.points),
    fromNumber(leagueMatches)
  );
  const terms = squadTerms(game, opponent);
  const opponentStrength = Array.from({ length: 5 }, (_, i) =>
    clamp(
      toNumber(
        floor(
          add(
            fromNumber(
              rolledAttribute(rng.int, terms, i, 14) +
                opponentBonus(game.ruleset, game.level) +
                formStrength(game, opponent)
            ),
            pointsPerMatch
          )
        )
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
    gate: leagueGate(game, opponent, home),
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
  /** The managed club's own match, as a result of the week. */
  const match = {
    away: fixture.home ? fixture.opponent : game.club,
    home: fixture.home ? game.club : fixture.opponent,
    score
  };
  /**
   * Each club's league position before this week, by its place in the
   * division; absent before the first week, when positions mean nothing.
   */
  const previous =
    game.leagueMatches > 1
      ? game.league.map(entry => entry.position)
      : undefined;
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
  /**
   * A club's goals in the week's results: its points per match plus up to
   * four, a third of its form under club form (#99), and its share of the
   * squad-strength gap under squad strength (#119), floored.
   */
  const goalsFor = (index: number, other: number, random: number) => {
    const base = add(
      divide(fromNumber(league[index]!.points), fromNumber(game.leagueMatches)),
      multiply(fromNumber(random), fromNumber(4))
    );
    if (!clubForm(game.ruleset)) {
      return toNumber(floor(base));
    }
    // Under an even table (#218), form shapes only the managed club's
    // opponent, not the other clubs' results.
    const form = evenTable(game.ruleset) ? 0 : formOf(game, index + offset + 1);
    const withForm = add(base, divide(fromNumber(form), fromNumber(3)));
    const total = squadStrength(game.ruleset)
      ? add(
          withForm,
          fromNumber(squadGoals(game, index + offset + 1, other + offset + 1))
        )
      : withForm;
    return Math.max(0, toNumber(floor(total)));
  };
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
      goalsFor(home, away, rng.next()),
      goalsFor(away, home, rng.next())
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
        match,
        order: [],
        previous,
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
      return {
        bills: undefined,
        game: retained(),
        match,
        order,
        previous,
        printFault,
        results
      };
    }
    league[index]!.position = rank + 1;
  }
  const settled = retained();
  const billed = payWeeklyBills(
    settled.recentResults
      ? {
          ...settled,
          recentResults: addResults(
            settled.recentResults,
            [match, ...results].map(result => ({
              away: result.away - offset - 1,
              home: result.home - offset - 1,
              score: result.score
            }))
          )
        }
      : settled
  );
  return {
    ...billed,
    match,
    order,
    previous,
    printFault: undefined,
    results
  };
};
export type MatchCompletion = ReturnType<typeof completeLeagueMatch>;
