import { levels, type Club } from '../sim/catalogue';
import { cupRoundName } from '../sim/cup';
import { previewFixture } from '../sim/league';
import type { Game } from '../sim/management';
import { clubInk } from '../sim/names';
import type { View } from '../sim/session';
import { answersFor } from './answers';

/** A club's name in its name colour: Spectrum ink and paper numbers. */
export type ClubName = Readonly<{ ink: number; name: string; paper: number }>;

/** One of the menu's choices as a Home screen row. */
export type HomeChoice = Readonly<{
  /** Only while the menu prompt waits, the one place the original takes it. */
  enabled: boolean;
  /** The offered answer it submits. */
  id: string;
  label: string;
  tone: 'primary' | 'red' | 'blue';
}>;

/** The Home screen (#43): the club summary, the next fixture and the menu's choices. */
export type Home = Readonly<{
  cash: number;
  choices: readonly HomeChoice[];
  club: ClubName;
  debt: number;
  division: number;
  /** Absent once the season's matches are all played. */
  fixture?: Readonly<{
    /** The opponent and venue of a league match; a cup draw is not shown. */
    away?: ClubName;
    home?: ClubName;
    title: string;
  }>;
  /** The league position, absent before the first league match. */
  leaguePosition?: number;
  level: string;
  manager: string;
  morale: number;
}>;

const clubName = (club: Club): ClubName => ({
  ink: clubInk(club),
  name: club.name.trim(),
  paper: club.paper ?? 7
});

/** The menu's choices in the original's order and wording, after Play next match. */
const choices = [
  ['menu.squad', 'Sell or list your players'],
  ['menu.status', 'Print score etc'],
  ['menu.borrow', 'Obtain a loan'],
  ['menu.repay', 'Pay off loan'],
  ['menu.level', 'Change your skill level'],
  ['menu.change', 'Change team or player names'],
  ['menu.keep', 'Save game']
] as const;

const fixtureFor = (game: Game): Home['fixture'] => {
  const preview = previewFixture(game);
  if (!preview) {
    return undefined;
  }
  if (preview.kind === 'cup') {
    const round = cupRoundName(preview.round);
    return {
      title: `F.A. Cup – ${/^\d/.test(round) ? `Round ${round}` : round}`
    };
  }
  const club = clubName(game.clubs[game.club - 1]!);
  const opponent = clubName(game.clubs[preview.opponent - 1]!);
  return {
    away: preview.home ? opponent : club,
    home: preview.home ? club : opponent,
    title: `League match – Division ${game.division}`
  };
};

export const homeFor = (view: View & { game: Game }): Home => {
  const { game } = view;
  const offered = new Set(answersFor(view).map(answer => answer.id));
  const fixture = fixtureFor(game);
  return {
    cash: game.cash,
    choices: [
      {
        enabled: offered.has('menu.play'),
        id: 'menu.play',
        label: 'Play next match',
        tone: 'primary'
      },
      ...choices.map(([id, label], i): HomeChoice => ({
        enabled: offered.has(id),
        id,
        label,
        tone: i % 2 === 0 ? 'red' : 'blue'
      }))
    ],
    club: clubName(game.clubs[game.club - 1]!),
    debt: game.debt,
    division: game.division,
    ...(fixture ? { fixture } : {}),
    ...(game.leaguePosition > 0 ? { leaguePosition: game.leaguePosition } : {}),
    level: levels[game.level - 1]!,
    manager: game.manager,
    morale: game.morale
  };
};
