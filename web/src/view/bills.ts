import type { View } from '../sim/session';
import type { Paint } from './grid';

export const paintBills = (
  view: Extract<View, { screen: 'bills' | 'dismissal' }>,
  put: Paint
) => {
  const bill = view.bills;
  put(0, 0, '****WEEKLY BILLS****', { ink: 2, inverse: true });
  put(2, 0, `Wage Bill = £${bill.wages}`);
  put(3, 0, `Ground rent = £${bill.rent}`);
  put(4, 0, `Loan Interest = £${bill.interest}`);
  put(5, 0, `Weekly Balance = £${bill.balance}`, {
    ink: bill.balance < 0 ? 2 : 0
  });
  if (bill.loanIncreased) {
    put(6, 0, 'LOAN INCREASED TO PAY BILLS', { inverse: true });
  }
  // A grace period running (#74, Enhanced rules only): ADR 0010.
  const weeks = view.game.graceWeeks;
  if (weeks !== undefined && weeks > 0) {
    const warning = { ink: 2, inverse: true };
    put(8, 0, 'OVER YOUR CREDIT LIMIT', warning);
    put(
      9,
      0,
      weeks === 1
        ? 'LAST WEEK TO CLEAR YOUR DEBT'
        : `${weeks} WEEKS TO CLEAR IT`,
      warning
    );
  }
};

export const paintDismissal = (
  view: Extract<View, { screen: 'dismissal' }>,
  put: Paint
) => {
  paintBills(view, put);
  const row = view.bills.loanIncreased ? 7 : 6;
  const green = { ink: 4, inverse: true };
  const black = { ink: 0, inverse: true };
  put(row, 0, '+'.repeat(164), green);
  put(row + 5, 4, `YOU OWE OVER £${view.creditLimit}`, black);
  put(row + 6, 0, '++++', green);
  put(row + 6, 4, "YOU'VE BEEN SACKED BY THE ", black);
  put(row + 6, 30, '+'.repeat(27), green);
  put(row + 7, 25, 'CLUB!', black);
  put(row + 7, 30, '+'.repeat(162), green);
  put(21, 24, '(h=copy)');
  return {
    label: 'Acknowledge dismissal',
    numeric: false,
    prompt: 'Hit ENTER to continue'
  };
};
