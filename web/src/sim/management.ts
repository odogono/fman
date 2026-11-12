import type { Club } from './catalogue';
import { emptyAttackCarry, type AttackCarry } from './highlights';
import { add, divide, floor, fromNumber, multiply, toNumber } from './numeric';
import { createRng } from './rng';
import {
  clubSquads,
  gracePeriodWeeks,
  isRuleset,
  presentDay,
  startingClubs,
  startingPlayerNames,
  tiringInjuries,
  type Ruleset
} from './ruleset';
import {
  joinBuyer,
  startingSquads,
  type Position,
  type SquadPlayer
} from './squads';

export type Player = Readonly<{
  energy: number;
  id: number;
  name: string;
  /** The player's position under `clubSquads` (#113); otherwise his id gives it. */
  position?: Position;
  skill: number;
  status: 0 | 1 | 2 | 3;
  value: number;
  /**
   * Weeks an injured player has left out, 1–3, under tiring injuries (#98);
   * absent otherwise. An injured player without it has one week left.
   */
  weeksOut?: number;
}>;

export type LeagueRecord = Readonly<{
  against: number;
  for: number;
  points: number;
  position: number;
}>;

export type Game = Readonly<{
  attackCarry: AttackCarry;
  cash: number;
  club: number;
  clubs: readonly Club[];
  /** The kit chosen at the start, 0 or 7; absent when clubs wear their own. */
  colour?: number;
  cupFinished: boolean;
  cupRound: number;
  debt: number;
  division: number;
  /** Players in no club's squad and outside the 24 places, under `clubSquads` (#113). */
  freeAgents?: readonly SquadPlayer[];
  /**
   * Weeks of bills left to get back under the credit limit, while a grace
   * period runs (#74); absent otherwise. At 0 the period has run out.
   */
  graceWeeks?: number;
  homeGate: number;
  league: readonly LeagueRecord[];
  leagueHome: boolean;
  leagueMatches: number;
  leaguePosition: number;
  level: number;
  manager: string;
  morale: number;
  players: readonly Player[];
  previousNet: number;
  rating: number;
  ratingTotal: number;
  ruleset: Ruleset;
  scheduleCounter: number;
  seasons: number;
  seed: number;
  /** The second random stream that squads draw from, under `clubSquads` (#113). */
  squadSeed?: number;
}>;

const isIntegerIn = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

export const createNewGame = (options: {
  club: number;
  /** Required unless the ruleset's clubs wear their own kits. */
  colour?: number;
  level: number;
  manager: string;
  ruleset?: Ruleset;
  seed: number;
}): Game => {
  const ruleset = options.ruleset ?? 'original';
  if (
    !isRuleset(ruleset) ||
    options.manager.length > 20 ||
    !isIntegerIn(options.club, 1, 64) ||
    !isIntegerIn(options.level, 1, 7) ||
    (presentDay(ruleset)
      ? options.colour !== undefined
      : options.colour === undefined || ![0, 7].includes(options.colour))
  ) {
    throw new RangeError('Invalid game setup');
  }
  const rng = createRng(options.seed);
  const statuses: Player['status'][] = new Array(24).fill(0);
  const chosen: number[] = [];
  for (let picked = 0; picked < 12;) {
    const index = rng.int(1, 24) - 1;
    if (statuses[index] !== 0) {
      continue;
    }
    statuses[index] = picked === 11 ? 1 : 2;
    chosen.push(index);
    picked++;
  }
  const orderedClubs = [...startingClubs(ruleset)];
  [orderedClubs[63], orderedClubs[options.club - 1]] = [
    orderedClubs[options.club - 1]!,
    orderedClubs[63]!
  ];
  const squads = clubSquads(ruleset)
    ? startingSquads(orderedClubs, 64, chosen, options.seed)
    : undefined;
  const places =
    squads?.places ??
    startingPlayerNames(ruleset).map(name => ({ name, position: undefined }));
  const players = places.map(({ name, position }, index): Player => {
    const skill = rng.int(1, 5);
    const energy = rng.int(1, 20);
    return {
      energy,
      id: index + 1,
      name,
      ...(position === undefined ? {} : { position }),
      skill,
      status: statuses[index]!,
      value: 5000 * skill
    };
  });
  return {
    attackCarry: emptyAttackCarry(),
    cash: 100_000,
    club: 64,
    clubs: squads?.clubs ?? orderedClubs,
    ...(options.colour === undefined ? {} : { colour: options.colour }),
    cupFinished: false,
    cupRound: 0,
    debt: 0,
    division: 4,
    ...(squads ? { freeAgents: squads.freeAgents } : {}),
    homeGate: 5000,
    league: Array.from({ length: 16 }, () => ({
      against: 0,
      for: 0,
      points: 0,
      position: 0
    })),
    leagueHome: false,
    leagueMatches: 0,
    leaguePosition: 0,
    level: options.level,
    manager: options.manager,
    morale: 10,
    players,
    previousNet: 0,
    rating: 0,
    ratingTotal: 0,
    ruleset,
    scheduleCounter: 1,
    seasons: 0,
    seed: rng.seed,
    ...(squads ? { squadSeed: squads.squadSeed } : {})
  };
};

export const payWeeklyBills = (game: Game) => {
  const factor = 5 - game.division;
  const wages = game.players
    .filter(p => p.status > 0)
    .reduce((sum, p) => sum + p.skill * 100 * factor, 0);
  const rent = 500 * factor;
  const interest = Math.floor(game.debt / 100);
  const cash = game.cash - wages - rent - interest;
  return {
    bills: {
      balance: cash - game.debt - game.previousNet,
      interest,
      loanIncreased: cash < 0,
      rent,
      wages
    },
    game: countGraceWeek({
      ...game,
      cash: Math.max(0, cash),
      debt: game.debt + Math.max(0, -cash),
      previousNet: cash - game.debt
    })
  };
};

/** The most a club may owe: the loan limit, and the debt beyond which the manager is dismissed. */
export const creditLimit = (game: Game) => 250_000 * (5 - game.division);

/**
 * After the bills, under a ruleset with a grace period: going over the credit
 * limit starts one, each further week over counts it down, and getting back
 * to the limit ends it. The original's rules leave the game unchanged.
 */
const countGraceWeek = (game: Game): Game => {
  const weeks = gracePeriodWeeks(game.ruleset);
  if (weeks === undefined) {
    return game;
  }
  const { graceWeeks, ...rest } = game;
  if (game.debt <= creditLimit(game)) {
    return rest;
  }
  return {
    ...rest,
    graceWeeks: graceWeeks === undefined ? weeks : graceWeeks - 1
  };
};

/**
 * The club owes more than its credit limit: at once under the original's
 * rules, or once a grace period has run out.
 */
export const isDismissed = (game: Game) =>
  game.debt > creditLimit(game) &&
  (gracePeriodWeeks(game.ruleset) === undefined || game.graceWeeks === 0);

const validateAmount = (amount: number) => {
  if (!isIntegerIn(amount, 0, Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Amount must be a nonnegative integer');
  }
};

export const borrow = (game: Game, amount: number): Game => {
  validateAmount(amount);
  if (game.debt + amount > creditLimit(game)) {
    throw new RangeError(`Sorry, your credit limit is £ ${creditLimit(game)}`);
  }
  return { ...game, cash: game.cash + amount, debt: game.debt + amount };
};

export const repay = (game: Game, amount: number): Game => {
  validateAmount(amount);
  if (amount > game.debt) {
    throw new RangeError("YOU DON'T OWE THAT MUCH!");
  }
  if (amount > game.cash) {
    throw new RangeError("You haven't enough money!");
  }
  return { ...game, cash: game.cash - amount, debt: game.debt - amount };
};

export type SaleOffer = Readonly<{
  amount: number;
  buyer: string;
  buyerId: number;
  game: Game;
  playerId: number;
}>;

export const makeSaleOffer = (game: Game, playerId: number): SaleOffer => {
  const player = game.players.find(player => player.id === playerId);
  if (!player || player.status === 0) {
    throw new RangeError('Player not available');
  }
  if (player.status === 3) {
    throw new RangeError('He is injured- nobody wants him!');
  }
  const rng = createRng(game.seed);
  const factor = add(
    multiply(fromNumber(rng.next()), fromNumber(5)),
    fromNumber(8)
  );
  const amount = toNumber(
    floor(divide(multiply(factor, fromNumber(player.value)), fromNumber(10)))
  );
  const buyerId = rng.int(1, 64);
  const buyer = game.clubs[buyerId - 1]!.name;
  return {
    amount,
    buyer,
    buyerId,
    game: { ...game, seed: rng.seed },
    playerId
  };
};

export const respondToSale = (
  game: Game,
  offer: SaleOffer,
  accepted: boolean
): Game => {
  const rng = createRng(game.seed);
  const injured = !accepted && rng.int(1, 3) !== 1;
  const responded: Game = {
    ...game,
    cash: game.cash + (accepted ? offer.amount : 0),
    players: game.players.map(player =>
      player.id === offer.playerId
        ? injured && tiringInjuries(game.ruleset)
          ? { ...player, status: 3, weeksOut: 1 }
          : { ...player, status: accepted ? 0 : injured ? 3 : player.status }
        : player
    ),
    seed: rng.seed
  };
  if (!accepted || !clubSquads(game.ruleset) || offer.buyerId === game.club) {
    return responded;
  }
  return {
    ...responded,
    ...joinBuyer(
      game.clubs,
      game.freeAgents!,
      responded.players,
      responded.players[offer.playerId - 1]!,
      offer.buyerId,
      5 - game.division,
      game.squadSeed!
    )
  };
};
