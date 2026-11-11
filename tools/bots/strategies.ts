import type { Game, Player } from '../../web/src/sim/management';
import type { View } from '../../web/src/sim/session';
import type { HarnessRng } from './random';

/** The screens on which a strategy decides; the runner answers the rest. */
export type DecisionView = Extract<
  View,
  {
    screen:
      | 'menu'
      | 'borrow'
      | 'repay'
      | 'squad'
      | 'sale'
      | 'team'
      | 'selection'
      | 'transfer';
  }
>;
export const decisionScreens: ReadonlySet<View['screen']> = new Set([
  'menu',
  'borrow',
  'repay',
  'squad',
  'sale',
  'team',
  'selection',
  'transfer'
]);

/**
 * A fixed way of managing a club in a run. `create` starts one run's
 * decision-maker; it answers only with offered answers and never changes
 * the difficulty level.
 */
export type Strategy = Readonly<{
  create: (rng: HarnessRng) => (view: DecisionView) => string;
  description: string;
  name: string;
}>;

/** The most a club in this division may owe; owing more is dismissal. */
export const creditLimit = (game: Game) => 250_000 * (5 - game.division);

const owned = (game: Game) => game.players.filter(p => p.status > 0);
const picked = (game: Game) => game.players.filter(p => p.status === 2);
/** Players who can be picked: owned and not injured. */
const available = (game: Game) =>
  game.players.filter(p => p.status === 1 || p.status === 2);
const clamp = (value: number) => Math.max(1, Math.min(20, value));

/** One week's wages, rent and interest at the current squad and debt. */
export const weeklyBills = (game: Game) => {
  const factor = 5 - game.division;
  const wages = owned(game).reduce((sum, p) => sum + p.skill * 100 * factor, 0);
  return wages + 500 * factor + Math.floor(game.debt / 100);
};

const sameIds = (a: readonly Player[], b: ReadonlySet<number>) =>
  a.length === b.size && a.every(p => b.has(p.id));

/** The eleven (or fewer) available players with the best scores. */
export const topEleven = (game: Game, score: (p: Player) => number) =>
  new Set(
    [...available(game)]
      .sort((a, b) => score(b) - score(a) || a.id - b.id)
      .slice(0, 11)
      .map(p => p.id)
  );

/**
 * The sum of the five team-strength attributes a picked team would have,
 * as the original computes them: average energy over eleven, and skill
 * summed per playing category (players 1-8, 9-16, 17-24), each 1 to 20.
 */
const strengthTotal = (team: readonly Player[]) => {
  let energy = 0;
  const skill = [0, 0, 0];
  for (const p of team) {
    energy += p.energy;
    skill[Math.floor((p.id - 1) / 8)]! += p.skill;
  }
  return (
    clamp(Math.floor(energy / 11)) +
    clamp(skill[0]!) +
    clamp(skill[1]!) +
    clamp(skill[2]!)
  );
};

/** The available team with the highest total strength, by exhaustive search. */
export const strongestTeam = (game: Game) => {
  const pool = [...available(game)].sort((a, b) => a.id - b.id);
  const size = Math.min(11, pool.length);
  let best: Player[] = [];
  let bestScore = -1;
  let bestRaw = -1;
  const chosen: Player[] = [];
  const search = (from: number) => {
    if (chosen.length === size) {
      const score = strengthTotal(chosen);
      const raw = chosen.reduce((sum, p) => sum + p.skill * 20 + p.energy, 0);
      if (score > bestScore || (score === bestScore && raw > bestRaw)) {
        best = [...chosen];
        bestScore = score;
        bestRaw = raw;
      }
      return;
    }
    for (let i = from; i <= pool.length - (size - chosen.length); i++) {
      chosen.push(pool[i]!);
      search(i + 1);
      chosen.pop();
    }
  };
  search(0);
  return new Set(best.map(p => p.id));
};

/**
 * Moves the picked team one answer toward `wanted`. With more than eleven
 * picked the original only removes; otherwise it only adds, so dropping a
 * player means adding a wanted one first.
 */
const pickToward = (
  view: Extract<DecisionView, { screen: 'team' | 'selection' }>,
  wanted: ReadonlySet<number>
) => {
  const team = picked(view.game);
  if (view.screen === 'team') {
    return sameIds(team, wanted) ? '99' : 'c';
  }
  if (team.length > 11) {
    return String((team.find(p => !wanted.has(p.id)) ?? team[0]!).id);
  }
  const add = view.game.players.find(p => p.status === 1 && wanted.has(p.id));
  return add ? String(add.id) : '99';
};

/** Uniform among the offered answers on every decision screen. */
const random: Strategy = {
  create: rng => view => {
    const { game } = view;
    switch (view.screen) {
      case 'menu':
        // After a relegation the debt can exceed the new, lower limit until
        // the next bills dismiss the manager; no loan is then accepted.
        return rng.pick(
          game.debt > creditLimit(game)
            ? ['s', 'a', 'p', '99']
            : ['s', 'a', 'l', 'p', '99']
        );
      case 'borrow':
        return String(rng.int(0, creditLimit(game) - game.debt));
      case 'repay':
        return String(rng.int(0, Math.min(game.debt, game.cash)));
      case 'squad':
        return rng.pick(['99', ...available(game).map(p => String(p.id))]);
      case 'sale':
        return rng.pick(['yes', 'no']);
      case 'team':
        return rng.pick(['99', 'c']);
      case 'selection': {
        const team = picked(game);
        const toggles =
          team.length > 11 ? team : game.players.filter(p => p.status === 1);
        return rng.pick([
          ...(team.length <= 11 ? ['99'] : []),
          ...toggles.map(p => String(p.id))
        ]);
      }
      case 'transfer': {
        if (rng.next() < 0.5 || game.cash === 0) {
          return '99';
        }
        // 99 declines, so a random bid of exactly 99 is moved to 100.
        const bid = rng.int(0, game.cash);
        return String(bid === 99 && game.cash >= 100 ? 100 : bid);
      }
    }
  },
  description: 'Picks uniformly among the offered answers on each screen.',
  name: 'random'
};

/** Keeps the starting squad and money; fields the freshest players. */
const passiveAnswer = (view: DecisionView) => {
  switch (view.screen) {
    case 'team':
    case 'selection':
      return pickToward(
        view,
        topEleven(view.game, p => p.energy)
      );
    case 'menu':
    case 'transfer':
      return '99';
    default:
      throw new Error(`Passive never reaches ${view.screen}`);
  }
};

const passive: Strategy = {
  create: () => passiveAnswer,
  description:
    'Never buys, sells or borrows; picks the fittest available players.',
  name: 'passive'
};

/**
 * Picks by skill × energy, keeps four weeks of bills in hand, buys good
 * players it can afford out of that surplus, sells its weakest reserve
 * above fourteen players, and pays debt off with the rest. Borrowing never
 * delays dismissal (a loan adds to the debt it is judged on), so it never
 * borrows.
 */
const balanced: Strategy = {
  create: () => {
    let bidFor: number | undefined;
    return view => {
      const { game } = view;
      const buffer = weeklyBills(game) * 4;
      const weakestReserve = [...game.players]
        .filter(p => p.status === 1)
        .sort((a, b) => a.skill - b.skill || a.energy - b.energy)[0];
      switch (view.screen) {
        case 'menu':
          bidFor = undefined;
          if (game.debt > 0 && game.cash > buffer) {
            return 'p';
          }
          if (owned(game).length > 14 && weakestReserve) {
            return 'a';
          }
          return '99';
        case 'repay':
          return String(Math.min(game.debt, game.cash - buffer));
        case 'squad':
          return String(weakestReserve!.id);
        case 'sale':
          // Turning an offer down risks injuring the player.
          return 'yes';
        case 'team':
        case 'selection':
          return pickToward(
            view,
            topEleven(game, p => p.skill * p.energy)
          );
        case 'transfer': {
          const player = game.players[view.playerId - 1]!;
          const retry = bidFor === view.playerId;
          bidFor = view.playerId;
          if (
            retry ||
            player.skill < 3 ||
            game.cash - player.value < buffer ||
            player.value === 99
          ) {
            return '99';
          }
          return String(player.value);
        }
        default:
          throw new Error(`Balanced never reaches ${view.screen}`);
      }
    };
  },
  description:
    'Picks by skill × energy, buys good players from spare cash, sells surplus reserves and repays debt; never borrows.',
  name: 'balanced'
};

/**
 * Borrows to the credit limit, bids twice a player's value for anyone of
 * skill 3 or more (up to three bids), never sells, and fields the team with
 * the highest total strength.
 */
const aggressive: Strategy = {
  create: () => {
    let bidFor: number | undefined;
    let bids = 0;
    return view => {
      const { game } = view;
      switch (view.screen) {
        case 'menu':
          bidFor = undefined;
          return creditLimit(game) - game.debt >= 1000 ? 'l' : '99';
        case 'borrow':
          return String(creditLimit(game) - game.debt);
        case 'team':
        case 'selection':
          return pickToward(view, strongestTeam(game));
        case 'transfer': {
          const player = game.players[view.playerId - 1]!;
          bids = bidFor === view.playerId ? bids + 1 : 1;
          bidFor = view.playerId;
          const bid = Math.min(game.cash, player.value * 2);
          if (bids > 3 || player.skill < 3 || bid === 99 || bid === 0) {
            return '99';
          }
          return String(bid);
        }
        default:
          throw new Error(`Aggressive never reaches ${view.screen}`);
      }
    };
  },
  description:
    'Borrows to the credit limit, overbids for good players and fields the strongest team.',
  name: 'aggressive'
};

export const strategies: readonly Strategy[] = [
  random,
  passive,
  balanced,
  aggressive
];

export const strategyNamed = (name: string) => {
  const found = strategies.find(s => s.name === name);
  if (!found) {
    throw new RangeError(
      `Unknown strategy ${name}; expected one of ${strategies.map(s => s.name).join(', ')}`
    );
  }
  return found;
};
