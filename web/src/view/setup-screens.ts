import { levels } from '../sim/catalogue';
import type { View } from '../sim/session';
import { clubName, type ClubName } from './home';

type Choice = Readonly<{ id: string; label: string }>;

/** One of the seven levels, in the original's colours for it. */
export type LevelChoice = Readonly<{
  /** The level the manager plays at now, when changing it. */
  current: boolean;
  id: string;
  /** The original prints each level's name in its own bright ink and paper. */
  ink: number;
  name: string;
  number: number;
  paper: number;
}>;

/**
 * Modern mode's setup screens, which stand in for the original's: the
 * manager's name, the club, the level (at the start or changed from the
 * menu), the colours, and the question after a save.
 */
export type ModernSetup =
  | Readonly<{ kind: 'manager'; maxLength: number }>
  | Readonly<{
      clubs: readonly Readonly<{
        club: ClubName;
        id: string;
        number: number;
      }>[];
      /** Each page of the original's list is one division's clubs. */
      division: number;
      kind: 'clubs';
      next: Choice;
      /** Whichever club is chosen, it starts at the foot of Division 4. */
      note: string;
    }>
  | Readonly<{
      changing: boolean;
      kind: 'level';
      levels: readonly LevelChoice[];
    }>
  | Readonly<{ choices: readonly Choice[]; kind: 'colours' | 'play-on' }>;

/** The longest name the original accepts. */
const nameLength = 20;

export const setupFor = (view: View): ModernSetup | undefined => {
  switch (view.screen) {
    case 'manager':
      return { kind: 'manager', maxLength: nameLength };
    case 'clubs': {
      const from = (view.page - 1) * 16;
      return {
        clubs: view.clubs.slice(from, from + 16).map((club, i) => ({
          club: clubName(club),
          id: `clubs.club.${from + i + 1}`,
          number: from + i + 1
        })),
        division: view.page,
        kind: 'clubs',
        next: {
          id: 'clubs.next-page',
          label: `Next: Division ${(view.page % 4) + 1}`
        },
        note: "You'll start in Division 4"
      };
    }
    case 'level': {
      const current = view.changing ? view.game.level : undefined;
      return {
        changing: view.changing,
        kind: 'level',
        levels: levels.map((name, i) => ({
          current: current === i + 1,
          id: `level.${i + 1}`,
          ink: i + 1,
          name,
          number: i + 1,
          paper: i + 1 > 3 ? 0 : 7
        }))
      };
    }
    case 'colours':
      return {
        choices: [
          { id: 'colours.black', label: 'Black' },
          { id: 'colours.white', label: 'White' }
        ],
        kind: 'colours'
      };
    case 'save-question':
      return {
        choices: [
          { id: 'save-question.yes', label: 'Keep playing' },
          { id: 'save-question.no', label: 'Stop' }
        ],
        kind: 'play-on'
      };
    default:
      return undefined;
  }
};
