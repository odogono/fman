import type { Game } from './management';
import { add, divide, floor, fromNumber, multiply, toNumber } from './numeric';
import { createRng } from './rng';

export const openTransferMarket = (game: Game) => {
  if (game.leagueMatches === 0) {
    return;
  }
  if (!game.players.some(p => p.status === 0)) {
    throw new RangeError('No unowned player in the pool');
  }
  const rng = createRng(game.seed);
  let playerId: number;
  do {
    playerId = rng.int(1, 24);
  } while (game.players[playerId - 1]!.status > 0);
  return {
    fullSquad: game.players.filter(p => p.status > 0).length > 15,
    game: { ...game, seed: rng.seed },
    playerId
  };
};
export type TransferOffer = NonNullable<ReturnType<typeof openTransferMarket>>;

export const bidForPlayer = (
  game: Game,
  playerId: number,
  bid: number
): {
  game: Game;
  outcome: 'declined' | 'unaffordable' | 'refused' | 'joined';
} => {
  if (!Number.isSafeInteger(bid) || bid < 0) {
    throw new RangeError('Bid must be a nonnegative integer');
  }
  const player = game.players[playerId - 1];
  if (!player || player.status !== 0) {
    throw new RangeError('Player not available');
  }
  if (game.players.filter(p => p.status > 0).length >= 16) {
    throw new RangeError('Squad is full');
  }
  if (bid === 99) {
    return { game, outcome: 'declined' };
  }
  if (bid > game.cash) {
    return { game, outcome: 'unaffordable' };
  }
  const rng = createRng(game.seed);
  const ratio = divide(
    multiply(fromNumber(rng.int(1, 10)), fromNumber(bid)),
    fromNumber(player.value)
  );
  const joined = toNumber(ratio) >= 5;
  const value = joined
    ? player.skill * 5000 * (5 - game.division)
    : toNumber(
        floor(
          add(
            fromNumber(player.value),
            divide(fromNumber(player.value), fromNumber(5))
          )
        )
      );
  return {
    game: {
      ...game,
      cash: game.cash - (joined ? bid : 0),
      players: game.players.map(p =>
        p.id === playerId ? { ...p, status: joined ? 1 : 0, value } : p
      ),
      seed: rng.seed
    },
    outcome: joined ? 'joined' : 'refused'
  };
};
