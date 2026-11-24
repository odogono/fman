import { removesOnly } from './league';
import {
  largestRepayment,
  levels,
  loanRoom,
  longestManagerName,
  type Game
} from './management';
import type { Screen, View } from './session';

/** An offered answer whose text is fixed; a continue is an empty one. */
export type ChoiceAnswer = Readonly<{
  id: string;
  kind: 'choice';
  text: string;
}>;
/**
 * Free number entry where the original asks for an amount. The original
 * accepts every amount from `min` to `max`; `start` is where entry begins.
 * An amount whose text is also a choice's, such as a bid of 99, selects that
 * choice instead.
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
  minLength?: number;
}>;

/** An answer a prompt offers; every one is an answer the original accepts. */
export type OfferedAnswer = ChoiceAnswer | AmountAnswer | TextAnswer;

/** Whether the answer is a command, typed in lower or upper case. */
export const isCommand = (text: string, command: string) =>
  text === command || text === command.toUpperCase();

/** The number an answer reads as, as the original's `VAL` would; empty is 0. */
export const numericInput = (text: string) =>
  /^\d*$/.test(text) && Number.isSafeInteger(Number(`0${text}`))
    ? Number(`0${text}`)
    : undefined;

const isYes = (text: string) => isCommand(text, 'yes') || isCommand(text, 'y');

/** The club numbers listed on one page of the club list. */
export const clubsOnPage = (page: number) => ({
  first: (page - 1) * 16 + 1,
  last: page * 16
});

/**
 * Whether `h` at the screen's prompt copies the screen. The name editor
 * reads `h` itself, and the manager's name and the save question take it as
 * an answer.
 */
export const takesPrint = (screen: Screen) =>
  screen !== 'manager' && screen !== 'names' && screen !== 'save-question';

/** The key that asks for the original's screen copy. */
export const isPrintKey = (text: string) => text === 'h' || text === 'H';

/**
 * A prompt's offered answers, and how it reads a typed answer: as the text
 * of the choice it selects, or as the number or name it enters.
 */
type Prompt = Readonly<{
  answers: readonly OfferedAnswer[];
  read: (text: string) => string | undefined;
}>;

const choice = (id: string, text: string): ChoiceAnswer => ({
  id,
  kind: 'choice',
  text
});
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

/** Reads any answer as the one continue. */
const asContinue = () => '';
/** Reads an answer as a number, or not at all. */
const asNumber = (text: string) => {
  const number = numericInput(text);
  return number === undefined ? undefined : String(number);
};
/** Reads `y` or `yes`, in either case, as yes and anything else as no. */
const asYesNo = (text: string) => (isYes(text) ? 'y' : 'n');
const asName = (text: string) => text;

const none: Prompt = { answers: [], read: () => undefined };

const menuCommands = ['s', 'a', 'l', 'p', 'level', 'change', 'keep'];

/** The prompt on screen, whether or not a pause holds input. */
const promptOn = (view: View): Prompt => {
  switch (view.screen) {
    case 'title':
    case 'cleared':
    case 'highlights':
    case 'cup-celebration':
      return none;
    case 'manager':
      return {
        answers: [
          { id: 'manager.name', kind: 'text', maxLength: longestManagerName }
        ],
        read: asName
      };
    case 'clubs': {
      const { first, last } = clubsOnPage(view.page);
      return {
        answers: [
          ...numbered('clubs.club', range(first, last)),
          choice('clubs.next-page', '99')
        ],
        read: asNumber
      };
    }
    case 'level':
      return {
        answers: numbered('level', range(levels.lowest, levels.highest)),
        read: asNumber
      };
    case 'colours':
      return {
        answers: [choice('colours.black', '0'), choice('colours.white', '7')],
        read: asNumber
      };
    case 'menu':
      return {
        answers: [
          choice('menu.status', 's'),
          choice('menu.squad', 'a'),
          choice('menu.borrow', 'l'),
          choice('menu.repay', 'p'),
          choice('menu.level', 'level'),
          choice('menu.play', '99'),
          choice('menu.change', 'change'),
          choice('menu.keep', 'keep')
        ],
        read: text =>
          text === '99'
            ? text
            : menuCommands.find(command => isCommand(text, command))
      };
    case 'save-question':
    case 'sale':
      return { answers: yesNo(view.screen), read: asYesNo };
    case 'squad':
      return {
        answers: [
          ...numbered(
            'squad.player',
            playerIds(view.game, status => status > 0)
          ),
          choice('squad.back', '99')
        ],
        read: asNumber
      };
    // Zero leaves, as in the original.
    case 'borrow':
      return {
        answers: [
          amount('borrow.amount', loanRoom(view.game)),
          choice('borrow.cancel', '0')
        ],
        read: asNumber
      };
    case 'repay':
      return {
        answers: [
          amount('repay.amount', largestRepayment(view.game)),
          choice('repay.cancel', '0')
        ],
        read: asNumber
      };
    case 'transfer':
      return {
        answers: [
          amount(
            'transfer.bid',
            view.game.cash,
            view.game.players[view.playerId - 1]!.value
          ),
          choice('transfer.decline', '99')
        ],
        read: asNumber
      };
    case 'team':
      return {
        answers: [choice('team.kick-off', '99'), choice('team.change', '')],
        read: text => (text === '99' ? text : '')
      };
    case 'selection': {
      // 99 returns to the team unless a pick must drop a player first.
      const removing = removesOnly(view.game);
      return {
        answers: [
          ...numbered(
            'selection.player',
            playerIds(view.game, status => status === (removing ? 2 : 1))
          ),
          ...(removing ? [] : [choice('selection.done', '99')])
        ],
        read: asNumber
      };
    }
    case 'names': {
      const editor = view.nameEditor;
      switch (editor.phase) {
        case 'question':
        case 'more':
          return { answers: yesNo('names'), read: asYesNo };
        case 'list': {
          const size = editor.kind === 'club' ? 16 : 8;
          return {
            answers: [
              ...numbered(
                `names.${editor.kind}`,
                range((editor.page - 1) * size + 1, editor.page * size)
              ),
              choice('names.next-page', '99')
            ],
            read: asNumber
          };
        }
        case 'name':
          return {
            answers: [{ id: 'names.name', kind: 'text', minLength: 1 }],
            read: asName
          };
        case 'fault':
          return none;
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
      return {
        answers: [choice(`${view.screen}.continue`, '')],
        read: asContinue
      };
  }
  return none;
};

/**
 * The answers the prompt on screen will take once nothing holds input, so a
 * screen can show them, disabled, during a pause.
 */
export const promptAnswers = (view: View): readonly OfferedAnswer[] =>
  promptOn(view).answers;

/**
 * The offered answers for the prompt on screen: only answers the original
 * accepts, none while a timed pause or a print fault holds input.
 */
export const offeredAnswers = (view: View): readonly OfferedAnswer[] =>
  view.paused ? [] : promptAnswers(view);

/** Whether `h` at the prompt copies the screen instead of answering. */
const copiesOn = (view: View) =>
  takesPrint(view.screen) ||
  (view.screen === 'names' && view.nameEditor.phase !== 'question');

const fits = (answer: OfferedAnswer, meant: string) => {
  switch (answer.kind) {
    case 'choice':
      return false;
    case 'amount': {
      const number = /^\d+$/.test(meant) ? Number(meant) : undefined;
      return (
        number !== undefined && number >= answer.min && number <= answer.max
      );
    }
    case 'text':
      return (
        meant.length >= (answer.minLength ?? 0) &&
        meant.length <= (answer.maxLength ?? Infinity)
      );
  }
};

/**
 * The offered answer a typed answer selects, by what it does rather than
 * its text: `yes` selects the offered `y`, and any text but 99 changes the
 * team. Nothing when the prompt doesn't offer it, or while input is held.
 */
export const offeredAnswerFor = (
  view: View,
  text: string
): OfferedAnswer | undefined => {
  if (view.paused || (isPrintKey(text) && copiesOn(view))) {
    return undefined;
  }
  const { answers, read } = promptOn(view);
  const meant = read(text);
  if (meant === undefined) {
    return undefined;
  }
  return (
    answers.find(a => a.kind === 'choice' && a.text === meant) ??
    answers.find(a => fits(a, meant))
  );
};

/**
 * Whether the prompt on screen takes the original's screen copy (`h`). Print
 * is not an offered answer; the game menu offers it instead. Only prompts
 * that offer answers count, so nothing the original refuses becomes reachable.
 */
export const printAccepted = (view: View) =>
  takesPrint(view.screen) && offeredAnswers(view).length > 0;
