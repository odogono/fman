import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { clubName, fixtureTitle, type ClubName } from './home';
import { strengthsFor, type Strengths } from './pick-team';
import { named } from './ticker-layout';

/** One moment as a line of Modern mode's ticker. */
export type ModernTickerLine = Readonly<{
  kind: Moment['kind'];
  /** The minute with its mark, as `34′`. */
  minute: string;
  name: string;
  /** For a goal, the score after it, home first. */
  score?: string;
  word: string;
}>;

/**
 * Modern mode's highlights screen (#45): a scoreboard over the original
 * pitch and the team strengths, or, under moment highlights, over the ticker.
 */
export type ModernHighlights = Readonly<{
  away: ClubName;
  home: ClubName;
  pitch?: Readonly<{
    /** The club whose attack is on the pitch, if one is. */
    attacking?: ClubName;
    /**
     * The original's keys only shorten its timed pauses, so a hold hurries
     * the highlights only while one runs.
     */
    hurry: boolean;
    /** The attack's outcome once it shows, for screen readers. */
    outcome?: string;
    strengths: Strengths;
  }>;
  score: readonly number[];
  ticker?: Readonly<{
    /** Newest first. */
    lines: readonly ModernTickerLine[];
    /** Skip ends the remaining moments' pauses, as in Classic mode. */
    skip: boolean;
  }>;
  /** The competition, as the Home screen words it. */
  title: string;
}>;

const words: Record<Moment['kind'], string> = {
  goal: 'Goal!',
  'near-miss': 'Post!',
  save: 'Saved'
};

const tickerLines = (
  game: Game,
  fixture: MatchFixture,
  shown: readonly Moment[]
): ModernTickerLine[] => {
  const goals = [0, 0];
  const homeSide = fixture.home ? 'club' : 'opponent';
  return shown
    .map(moment => {
      let score: string | undefined;
      if (moment.kind === 'goal') {
        goals[moment.side === homeSide ? 0 : 1]!++;
        score = `${goals[0]}-${goals[1]}`;
      }
      return {
        kind: moment.kind,
        minute: `${moment.minute}′`,
        name: named(game, fixture, moment).trim(),
        ...(score ? { score } : {}),
        word: words[moment.kind]
      };
    })
    .reverse();
};

export const highlightsFor = (view: View): ModernHighlights | undefined => {
  if (view.screen !== 'highlights') {
    return undefined;
  }
  const { fixture, game } = view;
  const sides = fixtureSides(game, fixture);
  const home = clubName(sides.home);
  const away = clubName(sides.away);
  const title = fixtureTitle(game, fixture);
  if ('ticker' in view) {
    return {
      away,
      home,
      score: view.ticker.score,
      ticker: {
        lines: tickerLines(game, fixture, view.ticker.shown),
        skip: !view.ticker.done
      },
      title
    };
  }
  const { playback } = view;
  const current = playback.current;
  const score = playback.score;
  const decided = current?.attack.frames
    .slice(0, current.index + 1)
    .find(frame => frame.kind === 'goal' || frame.kind === 'miss');
  const outcome =
    decided?.kind === 'goal'
      ? `Goal! ${home.name} ${score[0]}, ${away.name} ${score[1]}`
      : decided
        ? 'No goal'
        : undefined;
  return {
    away,
    home,
    pitch: {
      ...(current
        ? { attacking: current.attack.direction === 'right' ? home : away }
        : {}),
      hurry: current?.frame.kind === 'pause',
      ...(outcome ? { outcome } : {}),
      strengths: strengthsFor(game, fixture)
    },
    score,
    title
  };
};
