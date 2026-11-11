import type { Club } from './catalogue';
import type { Game } from './management';

export const decodeName = (bytes: readonly number[]) =>
  bytes
    .map(b =>
      b === 96
        ? '£'
        : b === 127
          ? '©'
          : String.fromCharCode(b >= 128 ? 0xe0_00 + b : b)
    )
    .join('');
const characterByte = (code: number) => {
  if (code === 0xa3) {
    return 96; // £
  }
  if (code === 0xa9) {
    return 127; // ©
  }
  if (code <= 127) {
    return code;
  }
  if (code >= 0xe0_80 && code <= 0xe0_ff) {
    return code - 0xe0_00;
  }
  throw new RangeError('Unsupported Spectrum character');
};
// A plain loop: this runs for every name on screen each time a view is read.
export const nameBytes = (text: string) => {
  const bytes: number[] = [];
  for (const character of text) {
    bytes.push(characterByte(character.codePointAt(0)!));
  }
  return bytes;
};
export const clubInk = (club: Club, inherited = 0) => club.ink ?? inherited;
export const clubText = (club: Club) =>
  club.name.padEnd(club.width ?? (club.ink === null ? 12 : 10));
export const encodeClubName = (club: Club) =>
  club.ink === null
    ? nameBytes(clubText(club))
    : club.paper !== undefined
      ? // A name on its own paper hands what follows back to the screen's
        // colours (INK 8 and PAPER 8 leave each cell's own), so a white name
        // on black doesn't turn the rest of the line white on black.
        [
          17,
          club.paper,
          16,
          club.ink,
          ...nameBytes(clubText(club)),
          17,
          8,
          16,
          8
        ]
      : [
          ...(club.width === 8 ? [16, club.ink, 16, club.ink] : [16, club.ink]),
          ...nameBytes(clubText(club))
        ];
export const encodePlayerName = (name: string) => nameBytes(name.padEnd(8));

export class NameRuntimeError extends Error {
  constructor(line: number) {
    super(`3 Subscript wrong, ${line}:1`);
  }
}

export const renameClub = (game: Game, id: number, text: string): Game => {
  if (!game.clubs[id - 1]) {
    throw new RangeError('TEAM NUMBER OUT OF RANGE');
  }
  const bytes = nameBytes(text);
  if (bytes.length === 0) {
    return game;
  }
  let ink: number | null = null;
  let start = 0;
  if (bytes[0] === 16) {
    if (bytes.length < 2) {
      throw new NameRuntimeError(9472);
    }
    ink = bytes[1]!;
    if (ink > 4) {
      throw new RangeError('INVALID COLOUR');
    }
    if (bytes.length < 3) {
      throw new NameRuntimeError(9473);
    }
    start = 2;
  }
  if (bytes[start]! < 65 || bytes[start]! > 122) {
    throw new RangeError('INVALID TEAM NAME');
  }
  if (bytes.length > (start === 2 ? 12 : 10)) {
    throw new RangeError('TEAM NAME TOO LONG- max 10 chars');
  }
  // A renamed club keeps its kit; its name colour is the editor's, as in the
  // original, so any paper goes.
  const kit = game.clubs[id - 1]!.kit;
  const club = {
    ink,
    ...(kit ? { kit } : {}),
    name: decodeName(bytes.slice(start)).replace(/ +$/, ''),
    width: ink === null ? 12 : 10
  };
  return {
    ...game,
    clubs: game.clubs.map((c, i) => (i + 1 === id ? club : c))
  };
};

export const renamePlayer = (game: Game, id: number, text: string): Game => {
  if (!game.players[id - 1]) {
    throw new RangeError('PLAYER NO. OUT OF RANGE');
  }
  const bytes = nameBytes(text);
  if (bytes.length === 0) {
    return game;
  }
  if (bytes[0]! < 65 || bytes[0]! > 122) {
    throw new RangeError('INVALID PLAYER NAME');
  }
  if (bytes.length > 8) {
    throw new RangeError('PLAYER NAME TOO LONG-max 8 chars');
  }
  return {
    ...game,
    players: game.players.map(p =>
      p.id === id ? { ...p, name: decodeName(bytes).replace(/ +$/, '') } : p
    )
  };
};
