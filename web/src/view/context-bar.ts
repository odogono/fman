import type { OfferedAnswer } from './answers';

/**
 * One button in Classic mode's context bar. `number` buttons sit in a grid;
 * `primary` is the yellow full-width action; `entry` buttons open the
 * soft keyboard for a typed answer.
 */
export type BarButton = Readonly<{
  answer: OfferedAnswer;
  label: string;
  tone: 'primary' | 'red' | 'blue' | 'number';
  wide: boolean;
}>;

const labels: Record<string, string> = {
  'borrow.amount': 'Type amount',
  'clubs.next-page': 'Next page (99)',
  'colours.black': 'Black (0)',
  'colours.white': 'White (7)',
  'manager.name': 'Type name',
  'menu.borrow': 'Loan (l)',
  'menu.change': 'Names (change)',
  'menu.keep': 'Save (keep)',
  'menu.level': 'Level',
  'menu.play': 'Continue (99)',
  'menu.repay': 'Pay off (p)',
  'menu.squad': 'Sell/list players (a)',
  'menu.status': 'Score etc (s)',
  'names.name': 'Type name',
  'names.next-page': 'Next page (99)',
  'repay.amount': 'Type amount',
  'selection.done': 'Done (99)',
  'squad.back': 'Back (99)',
  'team.change': 'Change team',
  'team.kick-off': 'Kick off (99)',
  'transfer.bid': 'Type bid',
  'transfer.decline': 'No bid (99)'
};

const primary = new Set([
  'clubs.next-page',
  'menu.play',
  'names.next-page',
  'selection.done',
  'team.kick-off'
]);

const labelFor = (answer: OfferedAnswer) => {
  const label = labels[answer.id];
  if (label) {
    return label;
  }
  const action = answer.id.slice(answer.id.lastIndexOf('.') + 1);
  if (action === 'continue') {
    return 'Continue';
  }
  if (action === 'yes') {
    return 'Yes (y)';
  }
  if (action === 'no') {
    return 'No (n)';
  }
  if (/^\d+$/.test(action)) {
    return action;
  }
  throw new Error(`No label for ${answer.id}`);
};

/**
 * The bar for a prompt's offered answers: numbers first, as a grid, then the
 * other choices in red and blue pairs, then the yellow primary action.
 */
export const barFor = (answers: readonly OfferedAnswer[]): BarButton[] => {
  const numbers: BarButton[] = [];
  const others: OfferedAnswer[] = [];
  const primaries: BarButton[] = [];
  for (const answer of answers) {
    const label = labelFor(answer);
    if (/\.\d+$/.test(answer.id)) {
      numbers.push({ answer, label, tone: 'number', wide: false });
    } else if (
      primary.has(answer.id) ||
      answer.id.endsWith('.continue') ||
      answer.id.endsWith('.yes')
    ) {
      primaries.push({ answer, label, tone: 'primary', wide: true });
    } else {
      others.push(answer);
    }
  }
  const paired = others.map((answer, i): BarButton => ({
    answer,
    label: labelFor(answer),
    tone: i % 2 === 0 ? 'red' : 'blue',
    wide: i === others.length - 1 && i % 2 === 0
  }));
  return [...numbers, ...paired, ...primaries];
};
