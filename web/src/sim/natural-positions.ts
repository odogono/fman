import type { Player } from './management';
import { playerCategory, positionCategory, type Position } from './squads';

// Natural positions (#121), under `naturalPositions`: a picked player plays
// where the manager puts him, in goal or in one of the three playing
// categories, and counts less the further that is from his position. Where
// he plays is kept on him while he's picked: it is set each time he is
// picked, so a stale one on a player who isn't picked is never read.

/** The letter an answer adds to a player's number to put him in a line. */
export const lineLetters = {
  A: 'FW',
  D: 'DF',
  G: 'GK',
  M: 'MF'
} as const satisfies Record<string, Position>;

export type LineLetter = keyof typeof lineLetters;

/** The line letters in the order screens offer them: goal first. */
export const lineOrder: readonly LineLetter[] = ['G', 'D', 'M', 'A'];

/** The letter for each place a player can play, as answers spell it. */
export const letterFor = (position: Position): LineLetter =>
  position === 'GK'
    ? 'G'
    : position === 'DF'
      ? 'D'
      : position === 'MF'
        ? 'M'
        : 'A';

/**
 * A selection answer that puts a player in a line: his number and a line
 * letter, in either case, as `14A` or `9g`.
 */
export const lineAnswer = (text: string) => {
  const match = /^(\d{1,2})([adgm])$/i.exec(text);
  return match
    ? {
        id: Number(match[1]),
        line: lineLetters[match[2]!.toUpperCase() as LineLetter] as Position
      }
    : undefined;
};

/** How much defence loses with nobody in goal. */
export const emptyGoalCost = 3;

/** What a goalkeeper outfield, or an outfielder in goal, counts. */
const wrongEndSkill = 1;

/** Where a picked player plays, or nothing for one who isn't picked or placed. */
export const playsIn = (player: Player): Position | undefined =>
  player.status === 2 ? player.plays : undefined;

/** Whether a picked player plays somewhere other than his position. */
export const outOfPosition = (player: Player) => {
  const plays = playsIn(player);
  return plays !== undefined && plays !== player.position;
};

/** The skill a player would count playing at `plays`. */
export const skillAt = (player: Player, plays: Position) => {
  const position = player.position!;
  if (plays === 'GK' || position === 'GK') {
    return plays === position ? player.skill : wrongEndSkill;
  }
  const lines = Math.abs(positionCategory(position) - positionCategory(plays));
  return Math.max(0, player.skill - lines);
};

/** The skill a picked player counts where he plays. */
export const countedSkill = (player: Player) => {
  const plays = playsIn(player);
  return plays === undefined ? player.skill : skillAt(player, plays);
};

/** The playing category a picked player counts towards: goal is defence's. */
export const countedCategory = (player: Player) => {
  const plays = playsIn(player);
  return plays === undefined ? playerCategory(player) : positionCategory(plays);
};

/** Whether anyone picked plays in goal. */
export const goalFilled = (players: readonly Player[]) =>
  players.some(p => playsIn(p) === 'GK');

/**
 * Where a player picked by his number alone plays: his position, except a
 * goalkeeper when goal is already filled, who plays in defence.
 */
const ownPlace = (players: readonly Player[], player: Player): Position =>
  player.position === 'GK' && goalFilled(players) ? 'DF' : player.position!;

/**
 * Puts a picked player in `line`, or his own place when there is none.
 * Whoever was in goal makes way for a new one: back to his position, or to
 * defence for a goalkeeper.
 */
export const place = (
  players: readonly Player[],
  id: number,
  line?: Position
): Player[] => {
  const player = players.find(p => p.id === id)!;
  const others = players.filter(p => p.id !== id);
  const plays = line ?? ownPlace(others, player);
  return players.map(p => {
    if (p.id === id) {
      return { ...p, plays };
    }
    if (plays === 'GK' && playsIn(p) === 'GK') {
      return { ...p, plays: p.position === 'GK' ? 'DF' : p.position! };
    }
    return p;
  });
};

/**
 * Places every picked player in his own place, in number order, so the
 * first goalkeeper picked goes in goal: a new game's picked team.
 */
export const placeAll = (players: readonly Player[]): Player[] =>
  players.reduce<Player[]>(
    (placed, p) => (p.status === 2 ? place(placed, p.id) : placed),
    players.map(p => {
      const { plays: _, ...rest } = p;
      return rest;
    })
  );
