import type { View } from '../sim/session';
import { playerCategory } from '../sim/squads';
import { changeAmount, type AmountEntry } from './amount-entry';
import { answersFor } from './answers';

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
 * Modern mode's amount prompts: a loan or repayment (#134), or a transfer
 * bid (#135). Each has the same stepper, chips and keypad.
 */
export type ModernAmount = Readonly<{
  /** Cancel (`0`) for a loan or repayment, Pass (`99`) for a bid. */
  cancel: Action & Readonly<{ label: string }>;
  cash: number;
  debt: number;
  entry: AmountEntry;
  kind: 'borrow' | 'repay' | 'transfer';
  /** The player for sale, on a transfer bid. */
  player?: BidPlayer;
  /** At £0 a loan would only do what Cancel does, and a bid is refused. */
  submit: Action & Readonly<{ label: string }>;
}>;

const submitLabels = {
  borrow: 'Take loan',
  repay: 'Pay off loan',
  transfer: 'Place bid'
} as const;

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
  const offered = new Set(answersFor(view).map(answer => answer.id));
  const action = (id: string) => ({ enabled: offered.has(id), id });
  const kind = view.screen;
  const submit = action(entry.id);
  const transfer = view.screen === 'transfer';
  const player = transfer ? view.game.players[view.playerId - 1] : undefined;
  return {
    cancel: transfer
      ? { ...action('transfer.decline'), label: 'Pass' }
      : { ...action(`${kind}.cancel`), label: 'Cancel' },
    cash: view.game.cash,
    debt: view.game.debt,
    entry,
    kind,
    ...(player
      ? {
          player: {
            category: playerCategory(player),
            energy: player.energy,
            name: player.name.trim(),
            number: player.id,
            skill: player.skill,
            tag:
              player.position === 'GK'
                ? 'G'
                : 'DMA'.charAt(playerCategory(player)),
            value: player.value
          }
        }
      : {}),
    submit: {
      ...submit,
      // A tap while the keypad is open submits what it holds, as in Classic.
      enabled:
        submit.enabled && changeAmount(entry, { type: 'done' }).value > 0,
      label: submitLabels[kind]
    }
  };
};
