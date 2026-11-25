import { removesOnly } from '../../web/src/sim/league';
import {
  largestRepayment,
  loanRoom,
  weeklyCharges,
  type Game,
  type Player
} from '../../web/src/sim/management';
import { emptyGoalCost } from '../../web/src/sim/natural-positions';
import { naturalPositions } from '../../web/src/sim/ruleset';
import type { View } from '../../web/src/sim/session';
import { playerCategory } from '../../web/src/sim/squads';
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

const owned = (game: Game) => game.players.filter(p => p.status > 0);
const picked = (game: Game) => game.players.filter(p => p.status === 2);
/** Players who can be picked: owned and not injured. */
const available = (game: Game) =>
  game.players.filter(p => p.status === 1 || p.status === 2);
const clamp = (value: number) => Math.max(1, Math.min(20, value));

/** One week's wages, rent and interest at the current squad and debt. */
export const weeklyBills = (game: Game) => {
  const { interest, rent, wages } = weeklyCharges(game);
  return wages + rent + interest;
};

const sameIds = (a: readonly Player[], b: ReadonlySet<number>) =>
  a.length === b.size && a.every(p => b.has(p.id));

/**
 * The eleven (or fewer) available players with the best scores. Under
 * natural positions (#121) that is the best goalkeeper and the ten best
 * outfielders, since a second goalkeeper counts 1 outfield and an empty
 * goal costs defence; other goalkeepers only make up the numbers.
 */
export const topEleven = (game: Game, score: (p: Player) => number) => {
  const ranked = [...available(game)].sort(
    (a, b) => score(b) - score(a) || a.id - b.id
  );
  if (!naturalPositions(game.ruleset)) {
    return new Set(ranked.slice(0, 11).map(p => p.id));
  }
  const [keeper, ...spare] = ranked.filter(p => p.position === 'GK');
  const outfield = ranked.filter(p => p.position !== 'GK');
  // Spare goalkeepers make up the eleven when outfielders run out.
  return new Set(
    [...(keeper ? [keeper] : []), ...outfield, ...spare]
      .slice(0, 11)
      .map(p => p.id)
  );
};

/**
 * Under natural positions (#121), the best picked goalkeeper when he isn't
 * the one in goal: the bots never play anyone else out of position.
 */
const keeperOutOfGoal = (game: Game) => {
  if (!naturalPositions(game.ruleset)) {
    return undefined;
  }
  const best = picked(game)
    .filter(p => p.position === 'GK')
    .sort((a, b) => b.skill - a.skill || a.id - b.id)[0];
  return best && best.plays !== 'GK' ? best : undefined;
};

/**
 * The available team with the highest total strength, by exhaustive search.
 *
 * Total strength is the sum of the five team-strength attributes a picked
 * team would have, as the original computes them: average energy over
 * eleven, and skill summed per playing category (by position under club
 * squads, otherwise players 1-8, 9-16, 17-24), each 1 to 20. Ties go to the
 * higher skill × 20 + energy, then to the first team in id order. The sums are kept as the search goes, so a
 * candidate team costs a few additions rather than a pass over its players.
 */
export const strongestTeam = (game: Game) => {
  const pool = [...available(game)].sort((a, b) => a.id - b.id);
  const size = Math.min(11, pool.length);
  // Under natural positions (#121) goalkeepers are summed apart: the best
  // plays in goal, any other counts 1 in defence, and none costs defence.
  const natural = naturalPositions(game.ruleset);
  const category = pool.map(p =>
    natural && p.position === 'GK' ? 3 : playerCategory(p)
  );
  const chosen: number[] = [];
  const skill = [0, 0, 0, 0];
  let keepers = 0;
  let bestKeeper = 0;
  let energy = 0;
  let raw = 0;
  let best: number[] = [];
  let bestScore = -1;
  let bestRaw = -1;
  const search = (from: number) => {
    if (chosen.length === size) {
      if (natural) {
        bestKeeper = 0;
        for (const id of chosen) {
          const p = game.players[id - 1]!;
          if (p.position === 'GK') {
            bestKeeper = Math.max(bestKeeper, p.skill);
          }
        }
      }
      const goal = !natural
        ? 0
        : keepers
          ? bestKeeper + keepers - 1
          : -emptyGoalCost;
      const score =
        clamp(Math.floor(energy / 11)) +
        clamp(skill[0]! + goal) +
        clamp(skill[1]!) +
        clamp(skill[2]!);
      if (score > bestScore || (score === bestScore && raw > bestRaw)) {
        best = [...chosen];
        bestScore = score;
        bestRaw = raw;
      }
      return;
    }
    for (let i = from; i <= pool.length - (size - chosen.length); i++) {
      const p = pool[i]!;
      chosen.push(p.id);
      energy += p.energy;
      keepers += Number(category[i] === 3);
      skill[category[i]!]! += p.skill;
      raw += p.skill * 20 + p.energy;
      search(i + 1);
      chosen.pop();
      energy -= p.energy;
      keepers -= Number(category[i] === 3);
      skill[category[i]!]! -= p.skill;
      raw -= p.skill * 20 + p.energy;
    }
  };
  search(0);
  return new Set(best);
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
  const keeper = keeperOutOfGoal(view.game);
  if (view.screen === 'team') {
    return sameIds(team, wanted) && !keeper ? '99' : 'c';
  }
  if (removesOnly(view.game)) {
    return String((team.find(p => !wanted.has(p.id)) ?? team[0]!).id);
  }
  const add = view.game.players.find(p => p.status === 1 && wanted.has(p.id));
  if (add) {
    return String(add.id);
  }
  return keeper ? `${keeper.id}G` : '99';
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
          loanRoom(game) < 0
            ? ['s', 'a', 'p', '99']
            : ['s', 'a', 'l', 'p', '99']
        );
      case 'borrow':
        return String(rng.int(0, loanRoom(game)));
      case 'repay':
        return String(rng.int(0, largestRepayment(game)));
      case 'squad':
        return rng.pick(['99', ...available(game).map(p => String(p.id))]);
      case 'sale':
        return rng.pick(['yes', 'no']);
      case 'team':
        return rng.pick(['99', 'c']);
      case 'selection': {
        const removing = removesOnly(game);
        const toggles = removing
          ? picked(game)
          : game.players.filter(p => p.status === 1);
        return rng.pick([
          ...(removing ? [] : ['99']),
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
 * Balanced's play, with the squad size it sells down to and the energy at
 * or below which a player is rested whenever enough others are available.
 */
const balancedPlay =
  (squadSize: number, restAtOrBelow: number): Strategy['create'] =>
  () => {
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
          if (owned(game).length > squadSize && weakestReserve) {
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
            // A rested player scores below every fit one, by energy.
            topEleven(game, p =>
              p.energy <= restAtOrBelow ? p.energy / 100 : p.skill * p.energy
            )
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
  };

/**
 * Picks by skill × energy, keeps four weeks of bills in hand, buys good
 * players it can afford out of that surplus, sells its weakest reserve
 * above fourteen players, and pays debt off with the rest. Borrowing never
 * delays dismissal (a loan adds to the debt it is judged on), so it never
 * borrows.
 */
const balanced: Strategy = {
  create: balancedPlay(14, 0),
  description:
    'Picks by skill × energy, buys good players from spare cash, sells surplus reserves and repays debt; never borrows.',
  name: 'balanced'
};

/**
 * Plays as balanced does, but keeps a deeper squad, selling only above
 * eighteen players, and rests anyone at energy 8 or below while enough
 * others are available (#98). It measures what lasting injuries offer a
 * manager who rotates.
 */
const rotating: Strategy = {
  create: balancedPlay(18, 8),
  description:
    'Plays as balanced, but keeps up to eighteen players and rests tired ones.',
  name: 'rotating'
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
    // Picking a team takes several answers over an unchanged squad, so the
    // search runs once per squad rather than once per answer.
    let strongest: { squad: string; team: ReadonlySet<number> } | undefined;
    const strongestFor = (game: Game) => {
      const squad = available(game)
        .map(p => `${p.id}:${p.skill}:${p.energy}`)
        .join();
      if (strongest?.squad !== squad) {
        strongest = { squad, team: strongestTeam(game) };
      }
      return strongest.team;
    };
    return view => {
      const { game } = view;
      switch (view.screen) {
        case 'menu':
          bidFor = undefined;
          return loanRoom(game) >= 1000 ? 'l' : '99';
        case 'borrow':
          return String(loanRoom(game));
        case 'team':
        case 'selection':
          return pickToward(view, strongestFor(game));
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

/**
 * Plays as aggressive does until its debt is over the credit limit, as after
 * a relegation or bills it can't cover (#74). Then it stops bidding, repays
 * from whatever cash it has, and sells its weakest reserves (down to eleven
 * players) to raise more, until the debt is back within the limit. It measures
 * what a grace period offers a manager who acts on it.
 */
const recovering: Strategy = {
  create: rng => {
    const play = aggressive.create(rng);
    return view => {
      const { game } = view;
      if (loanRoom(game) >= 0) {
        return play(view);
      }
      const weakestReserve = [...game.players]
        .filter(p => p.status === 1)
        .sort((a, b) => a.skill - b.skill || a.energy - b.energy)[0];
      const canSell = owned(game).length > 11 && weakestReserve;
      switch (view.screen) {
        case 'menu':
          if (game.cash > 0) {
            return 'p';
          }
          return canSell ? 'a' : '99';
        case 'repay':
          return String(largestRepayment(game));
        case 'squad':
          return canSell ? String(weakestReserve.id) : '99';
        case 'sale':
          return 'yes';
        case 'transfer':
          return '99';
        default:
          return play(view);
      }
    };
  },
  description:
    'Plays as aggressive, but when over the credit limit stops buying, repays and sells reserves until back within it.',
  name: 'recovering'
};

export const strategies: readonly Strategy[] = [
  random,
  passive,
  balanced,
  aggressive,
  recovering,
  rotating
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
