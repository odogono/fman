import type { MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';

/** The word that opens each kind of moment's line. */
const kindWords: Record<Moment['kind'], string> = {
  goal: 'GOAL!',
  'near-miss': 'POST!',
  save: 'SAVED:'
};

/** One ticker line in Classic mode's 32 columns and capitals. */
export type TickerLine = Readonly<{
  kind: Moment['kind'];
  /** The minute, right-aligned in three columns, as ` 9'` or `34'`. */
  minute: string;
  /** The player or club, cut to fit the line. */
  name: string;
  /** For a goal, the score after it, home first. */
  score?: string;
  /** The kind's word, as `GOAL!`. */
  word: string;
}>;

const width = 32;

/** Who a moment names: the player who shot, or else the club. */
const named = (game: Game, fixture: MatchFixture, moment: Moment) => {
  if (moment.side === 'club' && moment.player !== undefined) {
    const player = game.players.find(p => p.id === moment.player);
    if (player) {
      return player.name;
    }
  }
  const club = moment.side === 'club' ? game.club : fixture.opponent;
  return game.clubs[club - 1]!.name;
};

/**
 * The ticker's lines (#108), newest first. Each opens with the minute and
 * the kind, then names the player or club; a goal ends with the score after
 * it. A name too long for the line is cut, keeping the minute and score.
 */
export const tickerLines = (
  game: Game,
  fixture: MatchFixture,
  shown: readonly Moment[]
): TickerLine[] => {
  const score = [0, 0];
  const lines = shown.map((moment): TickerLine => {
    const minute = `${moment.minute}'`.padStart(3);
    const word = kindWords[moment.kind];
    let goals: string | undefined;
    if (moment.kind === 'goal') {
      const homeSide = fixture.home ? 'club' : 'opponent';
      const side = moment.side === homeSide ? 0 : 1;
      score[side]!++;
      goals = `${score[0]}-${score[1]}`;
    }
    const room =
      width - minute.length - word.length - 2 - (goals ? goals.length + 1 : 0);
    const name = named(game, fixture, moment)
      .trim()
      .toUpperCase()
      .slice(0, room);
    return {
      kind: moment.kind,
      minute,
      name,
      ...(goals ? { score: goals } : {}),
      word
    };
  });
  return lines.reverse();
};

/** A ticker line as plain text, for screen readers. */
export const tickerText = (line: TickerLine) =>
  [line.minute.trim(), line.word, line.name, line.score]
    .filter(Boolean)
    .join(' ');
