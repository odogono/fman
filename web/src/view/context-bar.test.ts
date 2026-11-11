import { expect, test } from 'bun:test';

import type { OfferedAnswer } from './answers';
import { barFor } from './context-bar';

const choice = (id: string, text: string): OfferedAnswer => ({
  id,
  kind: 'choice',
  text
});

const shown = (answers: OfferedAnswer[]) =>
  barFor(answers).map(b => `${b.label}:${b.tone}${b.wide ? ':wide' : ''}`);

test('numbers come first as a grid, then pairs, then the primary action', () => {
  expect(
    shown([
      choice('squad.player.4', '4'),
      choice('squad.player.12', '12'),
      choice('squad.back', '99')
    ])
  ).toEqual(['4:number', '12:number', 'Back (99):red:wide']);
  expect(
    shown([choice('save-question.yes', 'y'), choice('save-question.no', 'n')])
  ).toEqual(['No (n):red:wide', 'Yes (y):primary:wide']);
  expect(
    shown([choice('team.kick-off', '99'), choice('team.change', '')])
  ).toEqual(['Change team:red:wide', 'Kick off (99):primary:wide']);
});

test('menu choices alternate red and blue in pairs', () => {
  expect(
    shown([
      choice('menu.status', 's'),
      choice('menu.squad', 'a'),
      choice('menu.borrow', 'l'),
      choice('menu.play', '99')
    ])
  ).toEqual([
    'Score etc (s):red',
    'Sell/list players (a):blue',
    'Loan (l):red:wide',
    'Continue (99):primary:wide'
  ]);
});

test('typed answers open the keyboard from a labelled button', () => {
  expect(
    shown([
      { id: 'transfer.bid', kind: 'amount' },
      choice('transfer.decline', '99')
    ])
  ).toEqual(['Type bid:red', 'No bid (99):blue']);
  expect(shown([{ id: 'names.name', kind: 'text' }])).toEqual([
    'Type name:red:wide'
  ]);
});

test('an answer without a label is a mistake, not a blank button', () => {
  expect(() => barFor([choice('menu.unknown', 'x')])).toThrow(
    'No label for menu.unknown'
  );
});
