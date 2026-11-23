import { cupRoundName } from '../sim/cup';
import { fixtureSides } from '../sim/league';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { celebrationSidesFor } from './clip-match';
import type { CelebrationProgress, CelebrationSides } from './cup-celebration';
import { clubName, fixtureTitle, type ClubName } from './home';
import { celebrationGroundFor, type MatchGround } from './match-ground';

type Done = Readonly<{ enabled: boolean; id: string }>;

/** Modern mode's replay notice: the drawn round, replayed at the other ground. */
export type CupReplay = Readonly<{
  away: ClubName;
  done: Done;
  home: ClubName;
  title: string;
}>;

/**
 * The cup celebration as it stands: how far the original's timed
 * celebration has got, the frames since it began, which keep the scene
 * moving once it holds, both sides in the final's kits, and the ground the
 * final was played at.
 */
export type CupCelebration = Readonly<{
  clock: number;
  ground: MatchGround;
  progress: CelebrationProgress;
  sides: CelebrationSides;
}>;

/**
 * Modern mode's cup result: through to the next round, out of the cup, or
 * the cup won, with the tie that decided it. Winning the final plays the
 * celebration first, which takes no answer.
 */
export type CupResult = Readonly<{
  celebration?: CupCelebration;
  done: Done;
  headline: string;
  outcome: 'out' | 'through' | 'won';
  /** The deciding tie, as `Beat Barnet 2–1`. */
  tie: string;
  title: string;
}>;

/** The trophy's cells, the title's characters and the stars, as the original prints them. */
const trophyCells = 10 * 32;
const titleLength = 64;
const starCells = 9 * 32;

const doneFor = (view: View, id: string): Done => ({
  enabled: answersFor(view).some(answer => answer.id === id),
  id
});

/** The round after `round`, as the result names it. */
const nextRound = (round: number) => {
  const name = cupRoundName(round);
  return /^\d/.test(name) ? `Round ${name}` : `the ${name}`;
};

export const cupReplayFor = (view: View): CupReplay | undefined => {
  if (view.screen !== 'replay') {
    return undefined;
  }
  const { fixture, game } = view;
  const replay = { ...fixture, home: !fixture.home };
  const sides = fixtureSides(game, replay);
  return {
    away: clubName(sides.away),
    done: doneFor(view, 'replay.continue'),
    home: clubName(sides.home),
    title: fixtureTitle(game, fixture)
  };
};

export const cupResultFor = (view: View): CupResult | undefined => {
  if (view.screen !== 'cup-result' && view.screen !== 'cup-celebration') {
    return undefined;
  }
  const { fixture, game, score } = view;
  const ours = score[fixture.home ? 0 : 1]!;
  const theirs = score[fixture.home ? 1 : 0]!;
  const opponent = game.clubs[fixture.opponent - 1]!.name.trim();
  const won = view.celebration !== undefined;
  const outcome = won ? 'won' : game.cupFinished ? 'out' : 'through';
  const progress = view.celebrationProgress;
  return {
    ...(won
      ? {
          celebration: {
            clock: view.ulaFrames ?? view.frames,
            ground: celebrationGroundFor(game, fixture),
            progress: progress
              ? {
                  stars: progress.stars / starCells,
                  text: progress.text / titleLength,
                  trophy: progress.trophy / trophyCells
                }
              : { stars: 1, text: 1, trophy: 1 },
            sides: celebrationSidesFor(game, fixture)
          }
        }
      : {}),
    done: doneFor(view, 'cup-result.continue'),
    headline:
      outcome === 'won'
        ? "You've won the F.A. Cup"
        : outcome === 'out'
          ? 'Out of the F.A. Cup'
          : `Through to ${nextRound(game.cupRound + 1)}`,
    outcome,
    tie: `${ours > theirs ? 'Beat' : 'Lost to'} ${opponent} ${ours}–${theirs}${
      won ? ' in the Final' : ''
    }`,
    title: fixtureTitle(game, fixture)
  };
};
