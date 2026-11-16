import { levels, type Club } from '../sim/catalogue';
import { cupRoundName } from '../sim/cup';
import { previewFixture, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import { clubInk } from '../sim/names';
import { nextBills, type NextBills } from '../sim/next-bills';
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

/**
 * A warning about the next bills (#97): a loan to pay them, a loan over the
 * credit limit under a grace period, or a dismissal.
 */
export type NextBillsWarning = Readonly<{
  level: 'borrow' | 'grace' | 'sacked';
  text: string;
}>;

/** The Home screen (#43): the club summary, the next fixture and the menu's choices. */
export type Home = Readonly<{
  /**
   * The next bills, and a warning when they need one; only while the menu
   * waits, the one place the manager can still act on them, and absent
   * once the season's matches are all played.
   */
  bills?: Readonly<{ total: number; warning?: NextBillsWarning }>;
  cash: number;
  choices: readonly HomeChoice[];
  club: ClubName;
  debt: number;
  division: number;
  /**
   * The match being played or, between matches, the next one. Absent once
   * the season's matches are all played.
   */
  fixture?: Readonly<{
    /**
     * The opponent and venue. A cup round's draw shows only once its
     * matchday has drawn it.
     */
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

export const clubName = (club: Club): ClubName => ({
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

const cupTitle = (round: number) => {
  const name = cupRoundName(round);
  return `F.A. Cup – ${/^\d/.test(name) ? `Round ${name}` : name}`;
};

const sides = (game: Game, opponent: number, home: boolean) => {
  const club = clubName(game.clubs[game.club - 1]!);
  const other = clubName(game.clubs[opponent - 1]!);
  return home ? { away: other, home: club } : { away: club, home: other };
};

const leagueTitle = (game: Game) => `League match – Division ${game.division}`;

/** The competition a matchday's own fixture belongs to, as the Home screen words it. */
export const fixtureTitle = (game: Game, fixture: MatchFixture) =>
  fixture.kind === 'cup' ? cupTitle(game.cupRound) : leagueTitle(game);

/**
 * A matchday prepares its fixture as it starts, which moves the schedule on:
 * the game then previews the match after it. So while one is in progress
 * the Home screen shows the matchday's own fixture.
 */
const fixtureFor = (game: Game, current?: MatchFixture): Home['fixture'] => {
  if (current) {
    return {
      ...sides(game, current.opponent, current.home),
      title: fixtureTitle(game, current)
    };
  }
  const preview = previewFixture(game);
  if (!preview) {
    return undefined;
  }
  if (preview.kind === 'cup') {
    return { title: cupTitle(preview.round) };
  }
  return {
    ...sides(game, preview.opponent, preview.home),
    title: leagueTitle(game)
  };
};

const pounds = (value: number) => `£${value.toLocaleString('en-GB')}`;

/**
 * The warning for the next bills, if any. A league match's gate is known,
 * so its warning is exact; a cup round's counts the least its draw can pay,
 * so it words the worst case.
 */
export const nextBillsWarning = (
  bills: NextBills
): NextBillsWarning | undefined => {
  const upTo = bills.exact ? '' : 'up to ';
  switch (bills.outcome) {
    case 'covered':
      return undefined;
    case 'borrow':
      return {
        level: 'borrow',
        text: bills.exact
          ? `Cash won't cover next week's bills – you'll borrow ${pounds(bills.borrow)}.`
          : `Cash may not cover next week's bills – you could borrow up to ${pounds(bills.borrow)}.`
      };
    case 'grace': {
      const weeks = bills.weeksLeft!;
      const then = bills.starts
        ? `a ${weeks}-week grace period starts`
        : `${weeks} ${weeks === 1 ? 'week' : 'weeks'} left to clear it`;
      return {
        level: 'grace',
        text: `Next week's bills ${bills.exact ? 'take' : 'could take'} your loan ${upTo}${pounds(bills.over!)} over the credit limit – ${then}.`
      };
    }
    case 'sacked':
      return {
        level: 'sacked',
        text: `Next week's bills ${bills.exact ? 'will' : 'could'} get you sacked unless you find ${upTo}${pounds(bills.over!)}.`
      };
  }
};

export const homeFor = (view: View & { game: Game }): Home => {
  const { game } = view;
  const offered = new Set(answersFor(view).map(answer => answer.id));
  const fixture = fixtureFor(
    game,
    'fixture' in view ? view.fixture : undefined
  );
  const bills = offered.has('menu.play') ? nextBills(game) : undefined;
  const warning = bills && nextBillsWarning(bills);
  return {
    ...(bills
      ? { bills: { total: bills.total, ...(warning ? { warning } : {}) } }
      : {}),
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
