import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { clubName, fixtureTitle, type ClubName } from './home';

/** One side of the next fixture, and where it stands. */
export type FixtureSide = Readonly<{
  club: ClubName;
  /** `3rd in Division 4` in the league; in the cup, the club's division. */
  standing: string;
}>;

/**
 * Modern mode's next fixture, in place of the original's: the
 * competition, both clubs with where each stands, home first, and where the
 * managed club plays. A cup round reveals its draw here, which the Home
 * screen keeps back.
 */
export type ModernFixture = Readonly<{
  away: FixtureSide;
  done: Readonly<{ enabled: boolean; id: string; label: string }>;
  /** A cup round's draw, as `Drawn against Barnet, at home`. */
  draw?: string;
  home: FixtureSide;
  title: string;
  venue: 'At home' | 'Away';
}>;

/** A place as an ordinal: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export const ordinal = (n: number) => {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

const divisionOf = (club: number) => Math.floor((club - 1) / 16) + 1;

/** Where `club` stands going into `fixture`. */
const standing = (game: Game, fixture: MatchFixture, club: number) => {
  if (fixture.kind === 'cup') {
    return `Division ${divisionOf(club)}`;
  }
  const position =
    club === game.club
      ? game.leaguePosition
      : (game.league[club - (game.division - 1) * 16 - 1]?.position ?? 0);
  // Before the first league match, no club has a place yet.
  return position > 0
    ? `${ordinal(position)} in Division ${game.division}`
    : `Division ${game.division}`;
};

export const modernFixtureFor = (view: View): ModernFixture | undefined => {
  if (view.screen !== 'fixture') {
    return undefined;
  }
  const { fixture, game } = view;
  const sides = fixtureSides(game, fixture);
  const [homeId, awayId] = fixture.home
    ? [game.club, fixture.opponent]
    : [fixture.opponent, game.club];
  const id = 'fixture.continue';
  return {
    away: {
      club: clubName(sides.away),
      standing: standing(game, fixture, awayId)
    },
    done: {
      enabled: answersFor(view).some(answer => answer.id === id),
      id,
      label: 'Pick team'
    },
    ...(fixture.kind === 'cup'
      ? {
          draw: `Drawn against ${game.clubs[fixture.opponent - 1]!.name.trim()}, ${
            fixture.home ? 'at home' : 'away'
          }`
        }
      : {}),
    home: {
      club: clubName(sides.home),
      standing: standing(game, fixture, homeId)
    },
    title: fixtureTitle(game, fixture),
    venue: fixture.home ? 'At home' : 'Away'
  };
};
