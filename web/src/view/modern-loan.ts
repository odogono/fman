import type { View } from '../sim/session';
import { changeAmount, type AmountEntry } from './amount-entry';
import { answersFor } from './answers';

type Action = Readonly<{ enabled: boolean; id: string }>;

/**
 * Modern mode's loan and repayment screen (#134), and the balance message
 * that follows either one.
 */
export type ModernLoan =
  | Readonly<{
      /** Cancel submits `0`, borrowing or repaying nothing. */
      cancel: Action;
      cash: number;
      debt: number;
      entry: AmountEntry;
      kind: 'borrow' | 'repay';
      /** Take the loan or pay it off; at £0 it would only do what Cancel does. */
      submit: Action & Readonly<{ label: string }>;
    }>
  | Readonly<{
      cash: number;
      debt: number;
      done: Action;
      kind: 'balance';
    }>;

/** The screen for `view`, given the amount being entered on its prompt. */
export const loanFor = (
  view: View,
  entry: AmountEntry | undefined
): ModernLoan | undefined => {
  const offered = new Set(answersFor(view).map(answer => answer.id));
  const action = (id: string) => ({ enabled: offered.has(id), id });
  if (view.screen === 'message' && view.message.kind === 'balance') {
    return {
      cash: view.message.cash,
      debt: view.message.debt,
      done: action('message.continue'),
      kind: 'balance'
    };
  }
  if ((view.screen !== 'borrow' && view.screen !== 'repay') || !entry) {
    return undefined;
  }
  const kind = view.screen;
  const submit = action(`${kind}.amount`);
  return {
    cancel: action(`${kind}.cancel`),
    cash: view.game.cash,
    debt: view.game.debt,
    entry,
    kind,
    submit: {
      ...submit,
      // A tap while the keypad is open submits what it holds, as in Classic.
      enabled:
        submit.enabled && changeAmount(entry, { type: 'done' }).value > 0,
      label: kind === 'borrow' ? 'Take loan' : 'Pay off loan'
    }
  };
};
