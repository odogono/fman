import { framePeriod, validateFrames } from './frame-clock';
import type { Game } from './management';
import { nameBytes } from './names';

export const saveLimit = 100_000;
const invalid = () => new RangeError('Invalid Football Manager web save');
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(v).every(key => allowed.includes(key));
const integer = (
  v: unknown,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => {
  if (typeof v !== 'string') {
    return false;
  }
  try {
    return nameBytes(v).length <= max;
  } catch {
    return false;
  }
};
const array = (
  v: unknown,
  size: number,
  valid: (entry: unknown, index: number) => boolean
) => Array.isArray(v) && v.length === size && v.every(valid);
const position = (v: unknown) =>
  record(v) &&
  keys(v, ['x', 'y']) &&
  integer(v.x, -256, 256) &&
  integer(v.y, -256, 256);

const validGame = (v: unknown): v is Game => {
  if (!record(v)) {
    return false;
  }
  const numeric = [
    'cash',
    'debt',
    'homeGate',
    'previousNet',
    'rating',
    'ratingTotal',
    'seasons',
    'scheduleCounter'
  ];
  return (
    keys(v, [
      ...numeric,
      'attackCarry',
      'club',
      'clubs',
      'colour',
      'cupFinished',
      'cupRound',
      'division',
      'league',
      'leagueHome',
      'leagueMatches',
      'leaguePosition',
      'level',
      'manager',
      'morale',
      'players',
      'seed'
    ]) &&
    numeric.every(key => integer(v[key])) &&
    integer(v.club, 1, 64) &&
    integer(v.division, 1, 4) &&
    Math.ceil(v.club / 16) === v.division &&
    integer(v.level, 1, 7) &&
    (v.colour === 0 || v.colour === 7) &&
    typeof v.manager === 'string' &&
    v.manager.length <= 20 &&
    integer(v.seed, 0, 65_535) &&
    integer(v.morale, 0, 20) &&
    integer(v.cupRound, 0, 8) &&
    typeof v.cupFinished === 'boolean' &&
    integer(v.leagueMatches, 0, 15) &&
    integer(v.leaguePosition, 0, 16) &&
    typeof v.leagueHome === 'boolean' &&
    array(
      v.clubs,
      64,
      c =>
        record(c) &&
        keys(c, ['ink', 'name', 'width']) &&
        text(c.name, c.ink === null ? 12 : 10) &&
        (c.ink === null || integer(c.ink, 0, 7)) &&
        (c.width === undefined ||
          c.width === 8 ||
          c.width === 10 ||
          c.width === 12)
    ) &&
    array(
      v.players,
      24,
      (p, i) =>
        record(p) &&
        keys(p, ['energy', 'id', 'name', 'skill', 'status', 'value']) &&
        p.id === i + 1 &&
        text(p.name, 8) &&
        integer(p.status, 0, 3) &&
        integer(p.skill, 0, 100) &&
        integer(p.energy, 0, 100) &&
        integer(p.value, 0)
    ) &&
    array(
      v.league,
      16,
      r =>
        record(r) &&
        keys(r, ['against', 'for', 'points', 'position']) &&
        ['against', 'for', 'points'].every(k => integer(r[k], 0)) &&
        integer(r.position, 0, 16)
    ) &&
    record(v.attackCarry) &&
    keys(v.attackCarry, ['attackers', 'defenders']) &&
    array(v.attackCarry.attackers, 3, position) &&
    array(v.attackCarry.defenders, 3, position)
  );
};

export const decodeSave = (data: string): { frames: number; game: Game } => {
  if (data.length > saveLimit) {
    throw invalid();
  }
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalid();
  }
  if (
    !record(value) ||
    !keys(value, ['format', 'frames', 'game', 'version']) ||
    value.format !== 'fman-web' ||
    value.version !== 1 ||
    !integer(value.frames, 0, framePeriod - 1) ||
    !validGame(value.game)
  ) {
    throw invalid();
  }
  return { frames: value.frames, game: value.game };
};

export const encodeSave = (game: Game, frames: number): string => {
  validateFrames(frames);
  const data = JSON.stringify({ format: 'fman-web', frames, game, version: 1 });
  decodeSave(data);
  return data;
};
