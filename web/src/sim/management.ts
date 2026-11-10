import { clubs, playerNames, type Club } from './catalogue';
import { add, divide, floor, fromNumber, multiply, toNumber } from './numeric';
import { createRng } from './rng';

export type Player = Readonly<{
  energy: number;
  id: number;
  name: string;
  skill: number;
  status: 0 | 1 | 2 | 3;
  value: number;
}>;

export type LeagueRecord = Readonly<{
  against: number;
  for: number;
  points: number;
  position: number;
}>;

export type Game = Readonly<{
  cash: number;
  club: number;
  clubs: readonly Club[];
  colour: number;
  debt: number;
  division: number;
  homeGate: number;
  league: readonly LeagueRecord[];
  leagueMatches: number;
  leaguePosition: number;
  level: number;
  manager: string;
  morale: number;
  players: readonly Player[];
  previousNet: number;
  rating: number;
  seasons: number;
  seed: number;
}>;

const isIntegerIn = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

export const createNewGame = (options: {
  club: number;
  colour: number;
  level: number;
  manager: string;
  seed: number;
}): Game => {
  if (
    options.manager.length > 20 ||
    !isIntegerIn(options.club, 1, 64) ||
    !isIntegerIn(options.level, 1, 7) ||
    ![0, 7].includes(options.colour)
  ) {
    throw new RangeError('Invalid game setup');
  }
  const rng = createRng(options.seed);
  const statuses: Player['status'][] = new Array(24).fill(0);
  for (let picked = 0; picked < 12;) {
    const index = rng.int(1, 24) - 1;
    if (statuses[index] !== 0) {
      continue;
    }
    statuses[index] = picked === 11 ? 1 : 2;
    picked++;
  }
  const players = playerNames.map((name, index): Player => {
    const skill = rng.int(1, 5);
    const energy = rng.int(1, 20);
    return {
      energy,
      id: index + 1,
      name,
      skill,
      status: statuses[index]!,
      value: 5000 * skill
    };
  });
  const orderedClubs = [...clubs];
  [orderedClubs[63], orderedClubs[options.club - 1]] = [
    orderedClubs[options.club - 1]!,
    orderedClubs[63]!
  ];
  return {
    cash: 100_000,
    club: 64,
    clubs: orderedClubs,
    colour: options.colour,
    debt: 0,
    division: 4,
    homeGate: 5000,
    league: Array.from({ length: 16 }, () => ({
      against: 0,
      for: 0,
      points: 0,
      position: 0
    })),
    leagueMatches: 0,
    leaguePosition: 0,
    level: options.level,
    manager: options.manager,
    morale: 10,
    players,
    previousNet: 0,
    rating: 0,
    seasons: 0,
    seed: rng.seed
  };
};

const validateAmount = (amount: number) => {
  if (!isIntegerIn(amount, 0, Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Amount must be a nonnegative integer');
  }
};

export const borrow = (game: Game, amount: number): Game => {
  validateAmount(amount);
  if (game.debt + amount > 250_000 * (5 - game.division)) {
    throw new RangeError(
      `Sorry, your credit limit is £ ${250_000 * (5 - game.division)}`
    );
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
  const buyer = game.clubs[rng.int(1, 64) - 1]!.name;
  return { amount, buyer, game: { ...game, seed: rng.seed }, playerId };
};

export const respondToSale = (
  game: Game,
  offer: SaleOffer,
  accepted: boolean
): Game => {
  const rng = createRng(game.seed);
  const injured = !accepted && rng.int(1, 3) !== 1;
  return {
    ...game,
    cash: game.cash + (accepted ? offer.amount : 0),
    players: game.players.map(player =>
      player.id === offer.playerId
        ? { ...player, status: accepted ? 0 : injured ? 3 : player.status }
        : player
    ),
    seed: rng.seed
  };
};
