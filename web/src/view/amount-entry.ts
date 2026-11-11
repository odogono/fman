import type { AmountAnswer } from './answers';

/**
 * Touch entry of an amount: a stepper with chips, or a keypad for an exact
 * value. It never leaves the answer's range, so every amount it reaches is
 * one the original accepts.
 */
export type AmountEntry = Readonly<{
  id: string;
  max: number;
  min: number;
  /** Digits typed on the keypad so far, or `undefined` when it is closed. */
  typing: string | undefined;
  value: number;
}>;

/** One change a player can make to an amount. */
export type AmountAction =
  | { delta: number; type: 'step' }
  | { type: 'max' }
  | { type: 'keypad' }
  | { digit: number; type: 'digit' }
  | { type: 'back' }
  | { type: 'done' };

/** The −/+ step, in pounds. */
export const amountStep = 1000;
/** The chips under the stepper, before Max. */
export const amountChips = [10_000, 50_000, 100_000] as const;

export const startAmount = (answer: AmountAnswer): AmountEntry => ({
  id: answer.id,
  max: answer.max,
  min: answer.min,
  typing: undefined,
  value: Math.min(answer.max, Math.max(answer.min, answer.start))
});

const clamp = (entry: AmountEntry, value: number) =>
  Math.min(entry.max, Math.max(entry.min, value));

const typed = (typing: string) => Number(typing || '0');

/** Whether pressing `digit` on the keypad keeps the amount within range. */
export const digitAllowed = (entry: AmountEntry, digit: number) =>
  entry.typing !== undefined && typed(entry.typing + digit) <= entry.max;

export const changeAmount = (
  entry: AmountEntry,
  action: AmountAction
): AmountEntry => {
  switch (action.type) {
    case 'step':
      return { ...entry, value: clamp(entry, entry.value + action.delta) };
    case 'max':
      return { ...entry, value: entry.max };
    case 'keypad':
      return { ...entry, typing: '' };
    case 'digit':
      if (!digitAllowed(entry, action.digit)) {
        return entry;
      }
      return { ...entry, typing: String(typed(entry.typing! + action.digit)) };
    case 'back':
      return entry.typing
        ? { ...entry, typing: entry.typing.slice(0, -1) }
        : entry;
    case 'done':
      if (entry.typing === undefined) {
        return entry;
      }
      return {
        ...entry,
        typing: undefined,
        value: entry.typing ? clamp(entry, typed(entry.typing)) : entry.value
      };
  }
};

/** An amount as the bar shows it, such as `£45,000`. */
export const formatAmount = (value: number) =>
  `£${value.toLocaleString('en-GB')}`;
