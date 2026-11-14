import { levels } from '../sim/catalogue';
import { clubInk } from '../sim/names';
import type { Paint } from './grid';
import type { Layouts } from './layout';

/** The seven skill levels, numbered, in their own colours. */
const paintLevels = (row: number, put: Paint) =>
  levels.forEach((name, index) => {
    put(row + index, 0, String(index + 1));
    put(row + index, 16, name.padEnd(16), {
      bright: true,
      ink: index + 1,
      paper: index + 1 > 3 ? 0 : 7
    });
  });

/** The screens before and around a game: the title, a new game, clearing. */
export const setupLayouts: Layouts<
  | 'title'
  | 'manager'
  | 'clubs'
  | 'level'
  | 'colours'
  | 'cleared'
  | 'save-question'
> = {
  cleared: (_view, put) => {
    put(23, 0, '© 1982 Sinclair Research Ltd');
  },
  clubs: (view, put) => {
    put(0, 0, 'CHOOSE TEAM TO MANAGE -', {
      bright: true,
      ink: 1,
      inverse: true
    });
    put(1, 0, 'NUMBER          NAME', { ink: 1 });
    const offset = (view.page - 1) * 16;
    view.clubs.slice(offset, offset + 16).forEach((club, index) => {
      put(index + 2, 0, String(offset + index + 1));
      put(
        index + 2,
        16,
        club.paper === undefined ? club.name : club.name.padEnd(10),
        {
          ink: clubInk(club),
          ...(club.paper === undefined ? {} : { paper: club.paper })
        }
      );
    });
    put(
      18,
      0,
      'Type team number of the team youwant to manage (or 99 for more  choice)',
      { paper: 6 }
    );
    return {
      copy: true,
      label: 'Club number, or 99 for more choices',
      numeric: true
    };
  },
  colours: (_view, put) => {
    put(0, 0, 'Enter your team colours (0=Blackor 7=White)');
    return {
      copy: true,
      label: 'Team colours, 0 for black or 7 for white',
      numeric: true
    };
  },
  level: (view, put) => {
    if (view.changing) {
      const { level } = view.game;
      put(0, 0, 'Your present skill level is -');
      put(1, 0, `Level ${level}         ${levels[level - 1]}`);
      put(4, 0, 'The choices are -');
      paintLevels(6, put);
      put(14, 0, 'Enter your chosen level number');
    } else {
      paintLevels(0, put);
      put(7, 0, 'Type your level (1-7)', { ink: 1 });
    }
    return { copy: true, label: 'Difficulty level, 1 to 7', numeric: true };
  },
  manager: () => ({ label: 'Manager name', prompt: 'Type your name ' }),
  'save-question': () => ({
    label: 'Continue playing, y or n',
    prompt: 'Do you want to play some more?'
  }),
  title: (view, put) => {
    put(0, 0, 'FOOTBALL MANAGER'.slice(0, view.printed ?? Infinity));
    put(
      1,
      0,
      '© Copyright K. J. Toms 1982'.slice(
        0,
        Math.max(0, (view.printed ?? Infinity) - 15)
      )
    );
  }
};
