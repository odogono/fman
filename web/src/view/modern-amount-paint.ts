import {
  amountChips,
  amountStep,
  digitAllowed,
  formatAmount
} from './amount-entry';
import type { LoanCost, ModernAmount } from './modern-amount';
import {
  actionButton,
  amountButton,
  bidPlayer,
  cell,
  moneyRows,
  pounds
} from './paint-parts';

/**
 * What a loan or repayment does to the weekly bills (#97): the interest
 * before and after it, the next bills with it, and their warning.
 */
const loanCost = (cost: LoanCost) => {
  const { after, before } = cost.interest;
  const change = after - before;
  const interest =
    change === 0
      ? pounds(before)
      : `${pounds(before)} → ${pounds(after)} (${change > 0 ? '+' : '−'}${pounds(Math.abs(change))})`;
  const rows = moneyRows([
    ['Weekly interest', interest],
    ...(cost.bills === undefined ? [] : [['Next bills', cost.bills] as const])
  ]);
  rows.className = 'loan-cost';
  rows.setAttribute('aria-live', 'polite');
  const parts: HTMLElement[] = [rows];
  if (cost.warning) {
    const note = document.createElement('p');
    note.className = `home-warning ${cost.warning.level}`;
    note.textContent = cost.warning.text;
    parts.push(note);
  }
  return parts;
};

/**
 * Modern mode's amount prompts, a loan or repayment (#134) or a transfer bid
 * (#135): the player for sale on a bid, then the stepper and chips, or
 * the keypad while an exact amount is typed; then the balance after it.
 */
export const paintAmount = (pane: HTMLElement, amountPrompt: ModernAmount) => {
  const facts = moneyRows([
    ['Cash', amountPrompt.cash],
    ['Loan', amountPrompt.debt]
  ]);
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  const { entry } = amountPrompt;
  const shown = document.createElement('output');
  shown.className = 'amount-value';
  shown.setAttribute('aria-live', 'polite');
  const limit = cell('amount-limit', `Up to ${pounds(entry.max)}`);
  const parts: HTMLElement[] = amountPrompt.player
    ? [bidPlayer(amountPrompt.player), facts]
    : [facts];
  if (entry.typing === undefined) {
    shown.textContent = formatAmount(entry.value);
    const stepper = document.createElement('div');
    stepper.className = 'amount-stepper';
    const minus = amountButton(
      '−',
      { delta: -amountStep, type: 'step' },
      'red',
      entry.value <= entry.min
    );
    minus.setAttribute('aria-label', `Less by ${pounds(amountStep)}`);
    const plus = amountButton(
      '+',
      { delta: amountStep, type: 'step' },
      'red',
      entry.value >= entry.max
    );
    plus.setAttribute('aria-label', `More by ${pounds(amountStep)}`);
    stepper.append(minus, shown, plus);
    const chips = document.createElement('div');
    chips.className = 'amount-chips';
    chips.append(
      ...amountChips.map(chip =>
        amountButton(
          `+£${chip / 1000}k`,
          { delta: chip, type: 'step' },
          'chip',
          entry.value >= entry.max
        )
      ),
      amountButton('Max', { type: 'max' }, 'chip', entry.value >= entry.max)
    );
    parts.push(
      stepper,
      limit,
      ...(amountPrompt.cost ? loanCost(amountPrompt.cost) : []),
      chips,
      amountButton('Enter exact amount', { type: 'keypad' }, 'amount-exact')
    );
  } else {
    shown.textContent = `£${entry.typing}_`;
    const keypad = document.createElement('div');
    keypad.className = 'amount-keypad';
    keypad.append(
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit =>
        amountButton(
          String(digit),
          { digit, type: 'digit' },
          'chip',
          !digitAllowed(entry, digit)
        )
      ),
      amountButton('Del', { type: 'back' }, 'chip', !entry.typing),
      amountButton(
        '0',
        { digit: 0, type: 'digit' },
        'chip',
        !digitAllowed(entry, 0)
      ),
      amountButton('Done', { type: 'done' }, 'chip')
    );
    parts.push(
      shown,
      limit,
      ...(amountPrompt.cost ? loanCost(amountPrompt.cost) : []),
      keypad
    );
  }
  const submit = actionButton(
    amountPrompt.submit.label,
    amountPrompt.submit.id,
    'choice',
    amountPrompt.submit.enabled
  );
  const cancel = actionButton(
    amountPrompt.cancel.label,
    amountPrompt.cancel.id,
    'choice',
    amountPrompt.cancel.enabled
  );
  cancel.className = 'red';
  actions.append(submit, cancel);
  parts.push(actions);
  pane.replaceChildren(...parts);
};
