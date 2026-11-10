import type { Session } from '../sim/session';
import type { Paint } from './management-layouts';

export const paintBills = (session: Session, put: Paint) => {
  const bill = session.bills!;
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
};

export const paintDismissal = (session: Session, put: Paint) => {
  paintBills(session, put);
  const row = session.bills!.loanIncreased ? 7 : 6;
  const green = { ink: 4, inverse: true };
  const black = { ink: 0, inverse: true };
  put(row, 0, '+'.repeat(164), green);
  put(
    row + 5,
    4,
    `YOU OWE OVER £${250_000 * (5 - session.game!.division)}`,
    black
  );
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
