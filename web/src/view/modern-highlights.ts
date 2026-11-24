import { fixtureSides, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import type { View } from '../sim/session';
import { matchLineUps, namedKey, type LineUpPlayer } from './clip-match';
import {
  highlightsControls,
  type HighlightsControl
} from './highlights-controls';
import { clubName, fixtureTitle, type ClubName } from './home';
import { strengthsFor, type Strengths } from './pick-team';
import { lineName } from './ticker-layout';

/** How far the sprite highlights' clips have got, and the drawer. */
export type ClipProgress = Readonly<{
  drawer: boolean;
  full: boolean;
  /**
   * The moments screen readers have heard: each as the match first reaches
   * it, so watching a clip again says none twice.
   */
  heard: number;
  /** The playhead is paused (ADR 0016). */
  paused: boolean;
  /** The clip on show, by its moment's index; absent at kick-off and full time. */
  playing?: number;
  shown: number;
  /** The column's tab on show beside the pitch (#256). */
  tab: HighlightsTab;
  /** A moment has arrived since the Moments tab was last on show. */
  unseen: boolean;
}>;

/** The tabs of the column beside the clips' pitch (#256). */
export type HighlightsTab = 'away' | 'home' | 'moments';

/** One player in a line-up (#256), with the moments reached so far. */
export type LineUpRow = Readonly<{
  /** The minute of each goal they have scored. */
  goals: readonly string[];
  /** The minute they were injured, if they were. */
  injured?: string;
  /** Empty for an opponent that owns no squad: only the position shows. */
  name: string;
  /** The clip on show is their moment. */
  named: boolean;
}>;

/** A side's line-up beside the clips (#256), by position, and its strengths. */
export type ModernLineUp = Readonly<{
  club: ClubName;
  groups: readonly Readonly<{ label: string; rows: readonly LineUpRow[] }>[];
  kit: string;
  strengths: readonly (readonly [string, number])[];
}>;

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
  /**
   * The scoreboard's clock, under moment highlights: with clips, the minute
   * of the clip on show from the clip's start; without, the newest moment's
   * minute. 0′ before the first and FT after the last. The original's
   * attacks have no minutes, so its pitch has no clock.
   */
  clock?: string;
  /**
   * The controls under and beside the moments: none for the original's
   * pitch, which takes keypresses (ADR 0006).
   */
  controls: readonly HighlightsControl[];
  home: ClubName;
  /** Under sprite highlights, both sides' line-ups (#256). */
  lineUps?: Readonly<{ away: ModernLineUp; home: ModernLineUp }>;
  pitch?: Readonly<{
    /** The club whose attack is on the pitch, if one is. */
    attacking?: ClubName;
    /** The attack's outcome once it shows, for screen readers. */
    outcome?: string;
    strengths: Strengths;
  }>;
  score: readonly number[];
  /**
   * The clubs' names in three letters, home first, for a scoreboard too
   * narrow for their full names; absent when the two would read the same.
   */
  short?: readonly [string, string];
  ticker?: Readonly<{
    /** The moments are over: the final hold, or after it. */
    fullTime: boolean;
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
  injury: 'Injury',
  'near-miss': 'Missed',
  save: 'Saved'
};

/** A club's name in three letters, as `LIV`. */
const shortName = (club: ClubName) =>
  club.name
    .replaceAll(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase();

/** Both clubs' short names, unless they would read the same. */
export const shortNames = (home: ClubName, away: ClubName) => {
  const names = [shortName(home), shortName(away)] as const;
  return names[0] === names[1] || names.some(name => name.length < 3)
    ? undefined
    : names;
};

const clockOf = (
  moments: readonly Moment[],
  clip: ClipProgress,
  fullTime: boolean
) =>
  clip.playing !== undefined
    ? `${moments[clip.playing]?.minute ?? 0}′`
    : fullTime
      ? 'FT'
      : '0′';

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
        name: lineName(game, fixture, moment),
        ...(score ? { score } : {}),
        word: moment.penalty
          ? `Penalty ${words[moment.kind].toLowerCase()}`
          : words[moment.kind]
      };
    })
    .reverse();
};

const groupLabels = [
  ['GK', 'Goalkeeper'],
  ['DF', 'Defence'],
  ['MF', 'Midfield'],
  ['FW', 'Attack']
] as const;

/**
 * Both line-ups as the playhead has the match: each goal and injury marked
 * once its clip reaches it, and the player the clip on show names.
 */
const lineUpsFor = (
  game: Game,
  fixture: MatchFixture,
  moments: readonly Moment[],
  clip: ClipProgress,
  clubs: Readonly<{ away: ClubName; home: ClubName }>
) => {
  const goals = new Map<string, string[]>();
  const injuries = new Map<string, string>();
  for (const moment of moments.slice(0, clip.shown)) {
    const minute = `${moment.minute}′`;
    const key = namedKey(
      moment.side,
      moment.side === 'club' ? moment.player : moment.squadPlayer
    );
    if (key && moment.kind === 'goal') {
      goals.set(key, [...(goals.get(key) ?? []), minute]);
    }
    if (key && moment.kind === 'injury') {
      injuries.set(key, minute);
    }
  }
  const playing =
    clip.playing === undefined ? undefined : moments[clip.playing];
  const named =
    playing &&
    namedKey(
      playing.side,
      playing.side === 'club' ? playing.player : playing.squadPlayer
    );
  const sides = matchLineUps(game, fixture, moments);
  const strengths = strengthsFor(game, fixture);
  const clubHome = fixture.home;
  const lineUp = (
    side: Readonly<{ kit: string; players: readonly LineUpPlayer[] }>,
    club: ClubName,
    ours: boolean
  ): ModernLineUp => ({
    club,
    groups: groupLabels.flatMap(([position, label]) => {
      const rows = side.players
        .filter(p => p.position === position)
        .map(p => {
          const injured = injuries.get(p.key);
          return {
            goals: goals.get(p.key) ?? [],
            ...(injured ? { injured } : {}),
            name: p.name,
            named: p.key === named
          };
        });
      return rows.length > 0 ? [{ label, rows }] : [];
    }),
    kit: side.kit,
    strengths: strengths.rows.map(
      ([name, club, opponent]) => [name, ours ? club : opponent] as const
    )
  });
  return {
    away: lineUp(sides.away, clubs.away, !clubHome),
    home: lineUp(sides.home, clubs.home, clubHome)
  };
};

/**
 * `clips`: under sprite highlights, how far the clips have got and the
 * score after them, which the ticker alone can't tell, since a clip shows
 * its moment partway through.
 */
export const highlightsFor = (
  view: View,
  clips?: Readonly<{ progress: ClipProgress; score: readonly number[] }>
): ModernHighlights | undefined => {
  if (view.screen !== 'highlights') {
    return undefined;
  }
  const { fixture, game } = view;
  const sides = fixtureSides(game, fixture);
  const home = clubName(sides.home);
  const away = clubName(sides.away);
  const title = fixtureTitle(game, fixture);
  const { highlights } = view;
  const short = shortNames(home, away);
  if (highlights.kind === 'moments') {
    const ticker = highlights.timeline;
    const shown = clips
      ? ticker.moments.slice(0, clips.progress.shown)
      : ticker.shown;
    const fullTime = ticker.stage.kind === 'full-time';
    const newest = shown.at(-1);
    const skip = !ticker.done;
    return {
      away,
      ...(clips
        ? {
            clip: clips.progress,
            lineUps: lineUpsFor(game, fixture, ticker.moments, clips.progress, {
              away,
              home
            })
          }
        : {}),
      // Without clips, the ticker's clock is the newest moment's minute.
      clock: clips
        ? clockOf(ticker.moments, clips.progress, fullTime)
        : fullTime
          ? 'FT'
          : `${newest?.minute ?? 0}′`,
      controls: highlightsControls({
        ...(clips ? { clip: clips.progress } : {}),
        clubs: { away: away.name, home: home.name },
        ticker: { fullTime, lines: shown.length, skip }
      }),
      home,
      score: clips?.score ?? ticker.score,
      ...(short ? { short } : {}),
      ticker: {
        fullTime,
        lines: tickerLines(game, fixture, shown),
        skip
      },
      title
    };
  }
  const playback = highlights.timeline;
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
    controls: [],
    home,
    pitch: {
      ...(current
        ? { attacking: current.attack.direction === 'right' ? home : away }
        : {}),
      ...(outcome ? { outcome } : {}),
      strengths: strengthsFor(game, fixture)
    },
    score,
    ...(short ? { short } : {}),
    title
  };
};
