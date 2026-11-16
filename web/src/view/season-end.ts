import { cupRoundName } from '../sim/cup';
import type { View } from '../sim/session';
import { answersFor } from './answers';
import { ordinal } from './modern-fixture';

type Done = Readonly<{ enabled: boolean; id: string; label: string }>;

/** Modern mode's end of the season: where the club finished, and its cup run. */
export type EndOfSeason = Readonly<{
  /** `Out in Round 3`, `Lost in the Final`, `Won the F.A. Cup`. */
  cup: string;
  done: Done;
  /** `Finished 5th in Division 4`. */
  league: string;
}>;

/**
 * Modern mode's season summary: what happened to the club, the league
 * success bonus, the managerial rating, and the division's other moves.
 */
export type SeasonSummary = Readonly<{
  bonus: number;
  /** `for finishing 5th`. */
  bonusFor: string;
  done: Done;
  headline: string;
  outcome: 'champions' | 'promoted' | 'relegated' | 'stayed';
  /** The other clubs of the division promoted, or League Champions. */
  promoted: readonly string[];
  rating: number;
  relegated: readonly string[];
}>;

const doneFor = (view: View, id: string, label: string): Done => ({
  enabled: answersFor(view).some(answer => answer.id === id),
  id,
  label
});

/** Where a cup run ended, as the season end names it. */
const cupRun = (round: number, won: boolean) => {
  if (won) {
    return 'Won the F.A. Cup';
  }
  if (round === 8) {
    return 'Lost in the Final';
  }
  const name = cupRoundName(round);
  return `Out in ${/^\d/.test(name) ? `Round ${name}` : `the ${name}`}`;
};

export const endOfSeasonFor = (view: View): EndOfSeason | undefined => {
  if (view.screen !== 'end-season') {
    return undefined;
  }
  const { game } = view;
  return {
    cup: cupRun(game.cupRound, view.cupWon),
    done: doneFor(view, 'end-season.continue', 'Final table'),
    league: `Finished ${ordinal(game.leaguePosition)} in Division ${game.division}`
  };
};

export const seasonSummaryFor = (view: View): SeasonSummary | undefined => {
  if (view.screen !== 'season-summary') {
    return undefined;
  }
  const { game, season } = view;
  const from = season.previousDivision;
  const to = game.division;
  const outcome =
    from === 1 && season.finalPosition === 1
      ? 'champions'
      : to < from
        ? 'promoted'
        : to > from
          ? 'relegated'
          : 'stayed';
  const headline = {
    champions: 'League Champions',
    promoted: `Promoted to Division ${to}`,
    relegated: `Relegated to Division ${to}`,
    stayed: `Staying in Division ${to}`
  }[outcome];
  const ours = game.clubs[game.club - 1]!.name.trim();
  const others = season.movements.filter(m => m.club.name.trim() !== ours);
  const names = (kind: 'promoted' | 'relegated') =>
    others
      .filter(m =>
        kind === 'promoted' ? m.kind !== 'relegated' : m.kind === kind
      )
      .map(m => m.club.name.trim());
  return {
    bonus: season.bonus,
    bonusFor: `for finishing ${ordinal(season.finalPosition)}`,
    done: doneFor(view, 'season-summary.continue', 'New season'),
    headline,
    outcome,
    promoted: names('promoted'),
    rating: game.rating,
    relegated: names('relegated')
  };
};
