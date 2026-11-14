import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { clubName, fixtureTitle, type ClubName } from './home';
import { strengthsFor, type Strengths } from './pick-team';
import { named } from './ticker-layout';

/** How far the sprite highlights' clips have got, and the drawer. */
export type ClipProgress = Readonly<{
  drawer: boolean;
  full: boolean;
  shown: number;
}>;

/** The moments drawer's buttons (#145), which press no key. */
export const drawerIds = {
  close: 'moments.close',
  open: 'moments.open'
} as const;

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
  /**
   * Under sprite highlights (#144), the moments play as clips on a pitch of
   * their own. `shown`: the moments whose clips have reached the moment.
   * `full`: after Skip, the whole ticker shows over the pitch. `drawer`: on
   * a phone, the moments drawer (#145) is open over the pitch.
   */
  clip?: ClipProgress;
  home: ClubName;
  pitch?: Readonly<{
    /** The club whose attack is on the pitch, if one is. */
    attacking?: ClubName;
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
  clearance: 'Cleared',
  goal: 'Goal!',
  'near-miss': 'Missed',
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

/** The score after `shown`, home first, as the ticker keeps it. */
const scoreAfter = (fixture: MatchFixture, shown: readonly Moment[]) => {
  const goals = (side: Moment['side']) =>
    shown.filter(m => m.kind === 'goal' && m.side === side).length;
  const club = goals('club');
  const opponent = goals('opponent');
  return fixture.home ? [club, opponent] : [opponent, club];
};

/**
 * `clip`: under sprite highlights, how far the clips have got, which the
 * ticker alone can't tell, since a clip shows its moment partway through.
 */
export const highlightsFor = (
  view: View,
  clip?: ClipProgress
): ModernHighlights | undefined => {
  if (view.screen !== 'highlights') {
    return undefined;
  }
  const { fixture, game } = view;
  const sides = fixtureSides(game, fixture);
  const home = clubName(sides.home);
  const away = clubName(sides.away);
  const title = fixtureTitle(game, fixture);
  if ('ticker' in view) {
    const shown = clip
      ? view.ticker.moments.slice(0, clip.shown)
      : view.ticker.shown;
    return {
      away,
      ...(clip ? { clip } : {}),
      home,
      score: clip ? scoreAfter(fixture, shown) : view.ticker.score,
      ticker: {
        lines: tickerLines(game, fixture, shown),
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
      ...(outcome ? { outcome } : {}),
      strengths: strengthsFor(game, fixture)
    },
    score,
    title
  };
};
