import type { MatchFixture } from '../sim/league';
import { startingDivision, type Game } from '../sim/management';
import { matchKits } from './clip-match';
import {
  finalPlan,
  groundPlan,
  type ClubGround,
  type GroundPlan
} from './ground/grounds';
import type { GrassPattern } from './ground/pitch';

// The ground a match's clips are played at (#279), decided once, where the
// fixture is known: which ground it is and which side its crowd favours.
// The painter draws the ground it is handed. Like the clips, it is made up
// for show and changes nothing in the game.

/**
 * The fans in a ground's stands: the kits they wear, each with the share of
 * fans in it. The rest are neutral.
 */
export type Crowd = Readonly<{
  kits: readonly Readonly<{ kit: string; share: number }>[];
}>;

/** A ground as the painter draws it: its plan and its crowd. */
export type MatchGround = Readonly<{ crowd: Crowd; plan: GroundPlan }>;

/** A crowd favouring the side in `kit`: seven in ten, and some in `other`. */
export const favouring = (kit: string, other: string): Crowd => ({
  kits: [
    { kit, share: 0.7 },
    { kit: other, share: 0.15 }
  ]
});

/** A crowd favouring neither side: four in ten in each kit. */
export const evenly = (a: string, b: string): Crowd => ({
  kits: [
    { kit: a, share: 0.4 },
    { kit: b, share: 0.4 }
  ]
});

// The same ground and crowd always give back the same objects, so the
// painter builds the stands and the fans again only for another ground.
const plans = new Map<string, GroundPlan>();
const grounds = new Map<string, MatchGround>();

/**
 * The ground whose plan `make` makes, named `name`, with `crowd` and, for
 * the clip debugger, its grass mown in another pattern: the same objects
 * each time.
 */
const groundOf = (
  name: string,
  make: () => GroundPlan,
  crowd: Crowd,
  grass?: GrassPattern
): MatchGround => {
  const planKey = `${name}|${grass ?? ''}`;
  let plan = plans.get(planKey);
  if (!plan) {
    const made = make();
    plan = grass ? { ...made, grass } : made;
    plans.set(planKey, plan);
  }
  const key = [
    planKey,
    ...crowd.kits.map(({ kit, share }) => `${kit}:${share}`)
  ].join('|');
  let ground = grounds.get(key);
  if (!ground) {
    ground = { crowd, plan };
    grounds.set(key, ground);
  }
  return ground;
};

/**
 * A club's ground, with `crowd` in its stands and, for the clip debugger,
 * its grass mown in another pattern.
 */
export const clubGround = (
  club: ClubGround,
  crowd: Crowd,
  grass?: GrassPattern
): MatchGround =>
  groundOf(
    `club|${club.club}|${club.division}|${club.seats}`,
    () => groundPlan(club),
    crowd,
    grass
  );

/**
 * The final ground (#274), owned by no club, with `crowd` in its stands
 * and, for the clip debugger, its grass mown in another pattern.
 */
export const finalGround = (crowd: Crowd, grass?: GrassPattern): MatchGround =>
  groundOf('final', () => finalPlan, crowd, grass);

/** Whether `fixture` is the F.A. Cup final. */
const isFinal = (game: Game, fixture: MatchFixture) =>
  fixture.kind === 'cup' && game.cupRound === 8;

/** The home side's ground, its seats in the home kit, with `crowd`. */
const homeGround = (
  game: Game,
  fixture: MatchFixture,
  crowd: Crowd,
  grass?: GrassPattern
) => {
  const slot = fixture.home ? game.club : fixture.opponent;
  return clubGround(
    {
      club: game.clubs[slot - 1]!.origin,
      division: startingDivision(game, slot),
      seats: matchKits(game, fixture).home
    },
    crowd,
    grass
  );
};

/**
 * The ground `fixture`'s clips are played at: the home side's, its crowd
 * favouring the home side; or for the F.A. Cup final, the final's, its
 * crowd favouring neither. The clip debugger may mow its grass in another
 * pattern.
 */
export const matchGroundFor = (
  game: Game,
  fixture: MatchFixture,
  grass?: GrassPattern
): MatchGround => {
  const { away, home } = matchKits(game, fixture);
  return isFinal(game, fixture)
    ? finalGround(evenly(home, away), grass)
    : homeGround(game, fixture, favouring(home, away), grass);
};

/**
 * The cup celebration's ground: the one the final was played at, its crowd
 * favouring the winners, the managed club, in the kit they wore in it.
 */
export const celebrationGroundFor = (
  game: Game,
  fixture: MatchFixture
): MatchGround => {
  const { away, home } = matchKits(game, fixture);
  const [winners, losers] = fixture.home ? [home, away] : [away, home];
  return finalGround(favouring(winners, losers));
};
