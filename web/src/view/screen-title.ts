import { fixtureSides } from '../sim/league';
import type { Message, View } from '../sim/session';

const gameName = 'Football Manager';

/** A message's title; a text message, often an error, takes the game's name. */
const messageTitle = (message: Message) => {
  switch (message.kind) {
    case 'balance':
      return 'Bank balance';
    case 'skill-level':
      return 'Difficulty level';
    case 'text':
      return gameName;
  }
};

/**
 * The name of the screen on show, for the title above it. The highlights
 * name the clubs playing, home club first.
 */
export const screenTitle = (view: View): string => {
  switch (view.screen) {
    case 'title':
    case 'cleared':
      return gameName;
    case 'manager':
      return 'New manager';
    case 'clubs':
      return 'Choose a club';
    case 'level':
      return 'Difficulty level';
    case 'colours':
      return 'Team colours';
    case 'message':
      return messageTitle(view.message);
    case 'menu':
      return 'Main menu';
    case 'status':
      return 'Club status';
    case 'squad':
      return 'Squad';
    case 'sale':
      return 'Sale offer';
    case 'borrow':
      return 'Loan';
    case 'repay':
      return 'Repay loan';
    case 'names':
      return 'Change names';
    case 'save-question':
      return 'Save game';
    case 'fixture':
      return view.roundName ?? 'League match';
    case 'team':
      return 'Picked team';
    case 'selection':
      return 'Pick team';
    case 'highlights': {
      const { away, home } = fixtureSides(view.game, view.fixture);
      return `${home.name.trim()} v ${away.name.trim()}`;
    }
    case 'result':
      return 'Result';
    case 'replay':
      return 'Cup replay';
    case 'cup-result':
      return 'Cup result';
    case 'cup-celebration':
      return 'Cup winners';
    case 'other-matches':
      return 'Other results';
    case 'table':
      return 'League table';
    case 'bills':
      return 'Bills';
    case 'dismissal':
      return 'Dismissed';
    case 'transfer':
    case 'transfer-result':
      return 'Transfer market';
    case 'end-season':
      return 'End of season';
    case 'season-table':
      return 'Final table';
    case 'season-summary':
      return 'Season summary';
  }
};
