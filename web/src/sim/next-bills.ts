import { lowestCupGate } from './cup';
import { leagueGate, previewFixture } from './league';
import { creditLimit, weeklyCharges, type Game } from './management';
import { gracePeriodWeeks } from './ruleset';

/**
 * What the next bills will do, as the menu stands: covered by the cash and
 * gate, a loan to pay them, a loan over the credit limit under a grace
 * period, or a dismissal.
 */
export type NextBillsOutcome = 'borrow' | 'covered' | 'grace' | 'sacked';

/**
 * The weekly bills after the next fixture (#97), at the club's current
 * squad, cash and loan, changing nothing. A league match's gate is known,
 * so the forecast is exact. A cup round's draw is not, so it counts the
 * least the round can pay at the gate, and a draw pays no bills at all.
 */
export type NextBills = Readonly<{
  /** What the bills will borrow when the cash and gate fall short. */
  borrow: number;
  charges: ReturnType<typeof weeklyCharges>;
  debtAfter: number;
  /** Whether the gate, and so all of the forecast, is known. */
  exact: boolean;
  gate: number;
  outcome: NextBillsOutcome;
  /** How far over the credit limit the loan will be, when it is. */
  over?: number;
  /** Under a grace period, whether this week starts it. */
  starts?: boolean;
  total: number;
  /** Under a grace period, the weeks left to clear the loan after this one. */
  weeksLeft?: number;
}>;

export const nextBills = (game: Game): NextBills | undefined => {
  const preview = previewFixture(game);
  if (!preview) {
    return undefined;
  }
  const exact = preview.kind === 'league';
  const gate = exact
    ? leagueGate(game, preview.opponent, preview.home)
    : lowestCupGate(game);
  const charges = weeklyCharges(game);
  const total = charges.wages + charges.rent + charges.interest;
  const borrow = Math.max(0, total - game.cash - gate);
  const debtAfter = game.debt + borrow;
  const limit = creditLimit(game);
  const base = { borrow, charges, debtAfter, exact, gate, total };
  if (debtAfter <= limit) {
    return { ...base, outcome: borrow > 0 ? 'borrow' : 'covered' };
  }
  const over = debtAfter - limit;
  const weeks = gracePeriodWeeks(game.ruleset);
  const weeksLeft =
    weeks === undefined
      ? 0
      : game.graceWeeks === undefined
        ? weeks
        : game.graceWeeks - 1;
  return weeksLeft > 0
    ? {
        ...base,
        outcome: 'grace',
        over,
        starts: game.graceWeeks === undefined,
        weeksLeft
      }
    : { ...base, outcome: 'sacked', over };
};
