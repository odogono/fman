import { creditLimit } from '../sim/management';
import type { View } from '../sim/session';
import { answersFor } from './answers';

/**
 * Modern mode's weekly bills: each charge and their total, the weekly
 * balance, then the cash and the loan against the credit limit. Over the
 * limit under a grace period it says how far and for how long; a dismissal
 * ends the screen with the sacking.
 */
export type ModernBills = Readonly<{
  /** How much the cash less the loan changed since the last bills. */
  balance: number;
  /** What was borrowed to pay the bills, when the cash ran out. */
  borrowed?: number;
  cash: number;
  debt: number;
  dismissal?: Readonly<{ limit: number }>;
  done: Readonly<{ enabled: boolean; id: string; label: string }>;
  grace?: Readonly<{ over: number; weeks: number }>;
  limit: number;
  rows: readonly (readonly [label: string, amount: number])[];
  total: number;
}>;

export const billsFor = (view: View): ModernBills | undefined => {
  if (view.screen !== 'bills' && view.screen !== 'dismissal') {
    return undefined;
  }
  const { bills, game } = view;
  const limit = creditLimit(game);
  const dismissed = view.screen === 'dismissal';
  const id = `${view.screen}.continue`;
  const weeks = game.graceWeeks;
  return {
    balance: bills.balance,
    ...(bills.borrowed > 0 ? { borrowed: bills.borrowed } : {}),
    cash: game.cash,
    debt: game.debt,
    ...(dismissed ? { dismissal: { limit: view.creditLimit } } : {}),
    done: {
      enabled: answersFor(view).some(answer => answer.id === id),
      id,
      label: dismissed ? 'Leave the club' : 'Continue'
    },
    ...(!dismissed && weeks !== undefined && weeks > 0
      ? { grace: { over: game.debt - limit, weeks } }
      : {}),
    limit,
    rows: [
      ['Wages', bills.wages],
      ['Ground rent', bills.rent],
      ['Loan interest', bills.interest]
    ],
    total: bills.wages + bills.rent + bills.interest
  };
};
