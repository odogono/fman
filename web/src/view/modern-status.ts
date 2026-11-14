import { colourNames, levels } from '../sim/catalogue';
import type { Game } from '../sim/management';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { clubName, type ClubName } from './home';

/**
 * Modern mode's status screen (#133): the original's status facts, and on
 * the status prompt its Done button.
 */
export type ModernStatus = Readonly<{
  cash: number;
  club: ClubName;
  /** The colours the club plays in, as `Red`. */
  colours: string;
  debt: number;
  /**
   * The status prompt's Done button. Absent beside the Home screen, where
   * the status is shown while the menu waits.
   */
  done?: Readonly<{ enabled: boolean; id: string }>;
  leagueMatches: number;
  /** Absent before the first league match, as on the Home screen. */
  leaguePosition?: number;
  /** In the original's colours for that level. */
  level: Readonly<{ ink: number; name: string; paper: number }>;
  manager: string;
  morale: number;
  /** The managerial rating, out of 100. */
  rating: number;
  seasons: number;
}>;

/** The status facts alone, as shown beside the Home screen. */
export const statusOf = (game: Game): ModernStatus => {
  const club = game.clubs[game.club - 1]!;
  return {
    cash: game.cash,
    club: clubName(club),
    colours: colourNames[game.colour ?? club.kit!.home]!,
    debt: game.debt,
    leagueMatches: game.leagueMatches,
    ...(game.leaguePosition > 0 ? { leaguePosition: game.leaguePosition } : {}),
    level: {
      ink: game.level,
      name: levels[game.level - 1]!,
      paper: game.level > 3 ? 0 : 7
    },
    manager: game.manager,
    morale: game.morale,
    rating: game.rating,
    seasons: game.seasons
  };
};

/** The status prompt on show, with its Done button. */
export const statusFor = (view: View): ModernStatus | undefined => {
  if (view.screen !== 'status' || !view.game) {
    return undefined;
  }
  const id = 'status.continue';
  return {
    ...statusOf(view.game),
    done: { enabled: answersFor(view).some(answer => answer.id === id), id }
  };
};
