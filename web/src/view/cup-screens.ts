import { cupRoundName } from '../sim/cup';
import { fixtureSides } from '../sim/league';
import { flashPhase, type View } from '../sim/session';
import { answersFor } from './answers';
import { clubName, fixtureTitle, type ClubName } from './home';

type Done = Readonly<{ enabled: boolean; id: string }>;

/** Modern mode's replay notice: the drawn round, replayed at the other ground. */
export type CupReplay = Readonly<{
  away: ClubName;
  done: Done;
  home: ClubName;
  title: string;
}>;

/**
 * How far the cup winners' celebration has got, as the original draws it:
 * the share of the trophy and of the title shown, the rows of stars, and
 * whether they flash inverted.
 */
export type CupCelebration = Readonly<{
  flash: boolean;
  stars: number;
  text: number;
  trophy: number;
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

/** The trophy's cells and the title's characters, as the original prints them. */
const trophyCells = 10 * 32;
const titleLength = 64;

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
            flash: flashPhase(view),
            stars: view.celebration!,
            text: progress ? progress.text / titleLength : 1,
            trophy: progress ? progress.trophy / trophyCells : 1
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
