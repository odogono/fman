import type { Journal } from '../sim/journal';
import { creditLimit, type Game } from '../sim/management';
import type { Effect, View } from '../sim/session';

/** An offered answer whose text is fixed; a continue is an empty one. */
export type ChoiceAnswer = Readonly<{
  id: string;
  kind: 'choice';
  text: string;
}>;
/**
 * Free number entry where the original asks for an amount. Every amount from
 * `min` to `max` is one the original accepts; `start` is where entry begins.
 */
export type AmountAnswer = Readonly<{
  id: string;
  kind: 'amount';
  max: number;
  min: number;
  start: number;
}>;
/** Free text entry where the original asks for a name. */
export type TextAnswer = Readonly<{
  id: string;
  kind: 'text';
  maxLength?: number;
}>;

/** An answer a presentation mode puts within reach of a tap. */
export type OfferedAnswer = ChoiceAnswer | AmountAnswer | TextAnswer;

const choice = (id: string, text: string): ChoiceAnswer => ({
  id,
  kind: 'choice',
  text
});
const proceed = (screen: string) => choice(`${screen}.continue`, '');
const yesNo = (screen: string) => [
  choice(`${screen}.yes`, 'y'),
  choice(`${screen}.no`, 'n')
];
const numbered = (prefix: string, ids: readonly number[]) =>
  ids.map(id => choice(`${prefix}.${id}`, String(id)));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const amount = (id: string, max: number, start = 0): AmountAnswer => {
  const top = Math.max(0, max);
  return { id, kind: 'amount', max: top, min: 0, start: Math.min(start, top) };
};
const playerIds = (game: Game, keep: (status: number) => boolean) =>
  game.players.filter(player => keep(player.status)).map(player => player.id);

/**
 * The offered answers for the prompt on screen: only answers the original
 * accepts, none while a timed pause or a print fault holds input.
 */
export const answersFor = (view: View): readonly OfferedAnswer[] => {
  if (view.paused) {
    return [];
  }
  switch (view.screen) {
    case 'title':
    case 'cleared':
    case 'highlights':
    case 'cup-celebration':
      return [];
    case 'manager':
      return [{ id: 'manager.name', kind: 'text', maxLength: 20 }];
    case 'clubs':
      return [
        ...numbered(
          'clubs.club',
          range((view.page - 1) * 16 + 1, view.page * 16)
        ),
        choice('clubs.next-page', '99')
      ];
    case 'level':
      return numbered('level', range(1, 7));
    case 'colours':
      return [choice('colours.black', '0'), choice('colours.white', '7')];
    case 'menu':
      return [
        choice('menu.status', 's'),
        choice('menu.squad', 'a'),
        choice('menu.borrow', 'l'),
        choice('menu.repay', 'p'),
        choice('menu.level', 'level'),
        choice('menu.play', '99'),
        choice('menu.change', 'change'),
        choice('menu.keep', 'keep')
      ];
    case 'save-question':
    case 'sale':
      return yesNo(view.screen);
    case 'squad':
      return [
        ...numbered(
          'squad.player',
          playerIds(view.game, status => status > 0)
        ),
        choice('squad.back', '99')
      ];
    // A loan stays within the credit limit; a repayment within the debt and
    // the cash; a bid within the cash. Zero leaves, as in the original.
    case 'borrow':
      return [
        amount('borrow.amount', creditLimit(view.game) - view.game.debt),
        choice('borrow.cancel', '0')
      ];
    case 'repay':
      return [
        amount('repay.amount', Math.min(view.game.debt, view.game.cash)),
        choice('repay.cancel', '0')
      ];
    case 'transfer':
      return [
        amount(
          'transfer.bid',
          view.game.cash,
          view.game.players[view.playerId - 1]!.value
        ),
        choice('transfer.decline', '99')
      ];
    case 'team':
      return [choice('team.kick-off', '99'), choice('team.change', '')];
    case 'selection': {
      // Over eleven picked, a number only drops a picked player; otherwise
      // it only adds an available one, and 99 returns to the team.
      const removing = view.pickedCount > 11;
      return [
        ...numbered(
          'selection.player',
          playerIds(view.game, status => status === (removing ? 2 : 1))
        ),
        ...(removing ? [] : [choice('selection.done', '99')])
      ];
    }
    case 'names': {
      const editor = view.nameEditor;
      switch (editor.phase) {
        case 'question':
        case 'more':
          return yesNo('names');
        case 'list': {
          const size = editor.kind === 'club' ? 16 : 8;
          return [
            ...numbered(
              `names.${editor.kind}`,
              range((editor.page - 1) * size + 1, editor.page * size)
            ),
            choice('names.next-page', '99')
          ];
        }
        case 'name':
          return [{ id: 'names.name', kind: 'text' }];
        case 'fault':
          return [];
      }
      break;
    }
    case 'message':
    case 'status':
    case 'fixture':
    case 'result':
    case 'replay':
    case 'cup-result':
    case 'other-matches':
    case 'table':
    case 'bills':
    case 'dismissal':
    case 'end-season':
    case 'season-table':
    case 'season-summary':
    case 'transfer-result':
      return [proceed(view.screen)];
  }
  return [];
};

/**
 * Whether the prompt on screen takes the original's screen copy (`h`). Print
 * is not an offered answer; the game menu offers it instead. Only prompts
 * that offer answers count, so nothing the original refuses becomes reachable.
 */
export const printAccepted = (view: View) =>
  !['manager', 'names', 'save-question'].includes(view.screen) &&
  answersFor(view).length > 0;

/**
 * Submits an offered answer the way a keyboard does: Enter goes down and the
 * answer is submitted (ADR 0006). Enter stays down while the finger does; on
 * release, advance to the moment and call `journal.setKey('')`, as a key-up
 * does. Amount and text answers take the entered text.
 */
export function tapAnswer(
  journal: Journal,
  answer: ChoiceAnswer
): Effect | undefined;
export function tapAnswer(
  journal: Journal,
  answer: AmountAnswer | TextAnswer,
  text: string
): Effect | undefined;
export function tapAnswer(
  journal: Journal,
  answer: OfferedAnswer,
  text?: string
) {
  journal.setKey('Enter');
  return journal.submit(answer.kind === 'choice' ? answer.text : (text ?? ''));
}
