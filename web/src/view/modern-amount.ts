import {
  borrow,
  repay,
  weeklyCharges,
  type Game,
  type Player
} from '../sim/management';
import { nextBills } from '../sim/next-bills';
import { offeredAnswers } from '../sim/offers';
import type { View } from '../sim/session';
import { playerCategory } from '../sim/squads';
import { changeAmount, type AmountEntry } from './amount-entry';
import { nextBillsWarning, type NextBillsWarning } from './home';

type Action = Readonly<{ enabled: boolean; id: string }>;

/** The player a transfer bid is for. */
export type BidPlayer = Readonly<{
  /** Defence 0, midfield 1, attack 2: the bar's ink. */
  category: number;
  energy: number;
  name: string;
  number: number;
  skill: number;
  /** D, M or A by category, G for a goalkeeper. */
  tag: string;
  value: number;
}>;

/**
 * What a loan or repayment does to the weekly bills (#97): the interest
 * before and after it, and the next bills with it, and their warning when
 * they need one, as the Home screen gives them.
 */
export type LoanCost = Readonly<{
  /** Absent once the season's matches are all played. */
  bills?: number;
  interest: Readonly<{ after: number; before: number }>;
  warning?: NextBillsWarning;
}>;

/**
 * Modern mode's amount prompts: a loan or repayment (#134), or a transfer
 * bid (#135). Each has the same stepper, chips and keypad.
 */
export type ModernAmount = Readonly<{
  /** Cancel (`0`) for a loan or repayment, Pass (`99`) for a bid. */
  cancel: Action & Readonly<{ label: string }>;
  cash: number;
  /** For a loan or repayment, what it does to the weekly bills. */
  cost?: LoanCost;
  debt: number;
  entry: AmountEntry;
  kind: 'borrow' | 'repay' | 'transfer';
  /** The player for sale, on a transfer bid. */
  player?: BidPlayer;
  /** At £0 a loan would only do what Cancel does, and a bid is refused. */
  submit: Action & Readonly<{ label: string }>;
}>;

/** A player as a bid or a sale offer shows him. */
export const bidPlayerOf = (player: Player): BidPlayer => ({
  category: playerCategory(player),
  energy: player.energy,
  name: player.name.trim(),
  number: player.id,
  skill: player.skill,
  tag: player.position === 'GK' ? 'G' : 'DMA'.charAt(playerCategory(player)),
  value: player.value
});

const submitLabels = {
  borrow: 'Take loan',
  repay: 'Pay off loan',
  transfer: 'Place bid'
} as const;

/**
 * The cost of a loan or repayment of `amount`, the game changed as the
 * original would change it. An amount it would refuse costs nothing.
 */
const costOf = (
  game: Game,
  kind: 'borrow' | 'repay',
  amount: number
): LoanCost => {
  let after = game;
  try {
    after = kind === 'borrow' ? borrow(game, amount) : repay(game, amount);
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }
  }
  const bills = nextBills(after);
  const warning = bills && nextBillsWarning(bills);
  return {
    ...(bills ? { bills: bills.total } : {}),
    interest: {
      after: weeklyCharges(after).interest,
      before: weeklyCharges(game).interest
    },
    ...(warning ? { warning } : {})
  };
};

/** The prompt on show, given the amount being entered on it. */
export const amountPromptFor = (
  view: View,
  entry: AmountEntry | undefined
): ModernAmount | undefined => {
  if (
    (view.screen !== 'borrow' &&
      view.screen !== 'repay' &&
      view.screen !== 'transfer') ||
    !entry
  ) {
    return undefined;
  }
  const offered = new Set(offeredAnswers(view).map(answer => answer.id));
  const action = (id: string) => ({ enabled: offered.has(id), id });
  const kind = view.screen;
  const submit = action(entry.id);
  const transfer = view.screen === 'transfer';
  const player = transfer ? view.game.players[view.playerId - 1] : undefined;
  // What a tap on submit would send, the keypad's digits included.
  const amount = changeAmount(entry, { type: 'done' }).value;
  return {
    cancel: transfer
      ? { ...action('transfer.decline'), label: 'Pass' }
      : { ...action(`${kind}.cancel`), label: 'Cancel' },
    cash: view.game.cash,
    ...(kind === 'transfer' ? {} : { cost: costOf(view.game, kind, amount) }),
    debt: view.game.debt,
    entry,
    kind,
    ...(player ? { player: bidPlayerOf(player) } : {}),
    submit: {
      ...submit,
      // A tap while the keypad is open submits what it holds, as in Classic.
      enabled: submit.enabled && amount > 0,
      label: submitLabels[kind]
    }
  };
};
