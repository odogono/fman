import type { ModernBills } from './modern-bills';
import { cell, continueRow, moneyRows, pounds } from './paint-parts';

/** A signed amount of money, as `+£12,000` or `−£4,500`. */
const signedPounds = (value: number) =>
  value < 0 ? `−${pounds(-value)}` : `+${pounds(value)}`;

/**
 * Modern mode's weekly bills: each charge and their total, the weekly
 * balance, any loan taken to pay them, the grace period, then the cash and
 * the loan against the credit limit. A dismissal ends with the sacking.
 */
export const paintBills = (pane: HTMLElement, bills: ModernBills) => {
  const charges = moneyRows([...bills.rows, ['Total', bills.total]]);
  charges.className = 'bills-charges';
  const balance = document.createElement('div');
  balance.className = `bills-balance ${bills.balance < 0 ? 'down' : 'up'}`;
  balance.append(
    cell('bills-balance-label', 'Weekly balance'),
    cell('bills-balance-value', signedPounds(bills.balance)),
    cell('bills-balance-note', 'Change in cash less loan since last week')
  );
  const parts: HTMLElement[] = [charges, balance];
  if (bills.borrowed !== undefined) {
    parts.push(
      cell(
        'bills-alert',
        `Loan increased by ${pounds(bills.borrowed)} to pay the bills`
      )
    );
  }
  if (bills.grace) {
    const { over, weeks } = bills.grace;
    parts.push(
      cell(
        'bills-alert',
        `${pounds(over)} over your credit limit – ${
          weeks === 1 ? 'last week' : `${weeks} weeks`
        } to clear it`
      )
    );
  }
  const standing = moneyRows([
    ['Cash', bills.cash],
    ['Loan', `${pounds(bills.debt)} of ${pounds(bills.limit)}`]
  ]);
  parts.push(standing);
  if (bills.dismissal) {
    parts.push(
      cell(
        'bills-sacked',
        `Sacked – you owe over ${pounds(bills.dismissal.limit)}, the club's credit limit`
      )
    );
  }
  parts.push(continueRow(bills.done));
  pane.replaceChildren(...parts);
};
