import { framePeriod, validateFrames } from './frame-clock';
import type { Game } from './management';
import { nameBytes } from './names';
import {
  clubSquads,
  gracePeriodWeeks,
  isRuleset,
  presentDay,
  tiringInjuries,
  type Ruleset
} from './ruleset';
import { positions } from './squads';

// Room for a journal's 5000 inputs on top of a game: about 8 KB, or 50 KB
// under club squads (#113), whose 872 players outside the places are saved too.
export const saveLimit = 200_000;
/** The version every save is written with. */
export const saveVersion = 11;
/** The first save version whose games name their ruleset. */
export const rulesetSaveVersion = 6;
/** The first save version whose title-screen journals name their ruleset. */
export const titleRulesetSaveVersion = 7;
/** A version `keep` has written: the first contract, or one naming the ruleset. */
export const keptVersion = (version: unknown) =>
  version === 1 ||
  (typeof version === 'number' &&
    Number.isInteger(version) &&
    version >= rulesetSaveVersion &&
    version <= saveVersion);
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

/** A player outside the 24 places under club squads (#113). */
const squadPlayer = (v: unknown) =>
  record(v) &&
  keys(v, ['name', 'position', 'skill']) &&
  text(v.name, 8) &&
  positions.includes(v.position as never) &&
  integer(v.skill, 0, 100);

/** Two inks the highlights can tell from the grass and from each other. */
const kit = (v: unknown) =>
  record(v) &&
  keys(v, ['change', 'home']) &&
  [v.change, v.home].every(ink => integer(ink, 0, 7) && ink !== 6) &&
  v.change !== v.home;

export const validGame = (v: unknown): v is Game => {
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
      'freeAgents',
      'graceWeeks',
      'league',
      'leagueHome',
      'leagueMatches',
      'leaguePosition',
      'level',
      'manager',
      'morale',
      'players',
      'ruleset',
      'seed',
      'squadSeed'
    ]) &&
    isRuleset(v.ruleset) &&
    (clubSquads(v.ruleset)
      ? integer(v.squadSeed, 0, 65_535) &&
        Array.isArray(v.freeAgents) &&
        v.freeAgents.every(squadPlayer)
      : v.squadSeed === undefined && v.freeAgents === undefined) &&
    (v.graceWeeks === undefined ||
      integer(v.graceWeeks, 0, gracePeriodWeeks(v.ruleset) ?? -1)) &&
    numeric.every(key => integer(v[key])) &&
    integer(v.club, 1, 64) &&
    integer(v.division, 1, 4) &&
    Math.ceil(v.club / 16) === v.division &&
    integer(v.level, 1, 7) &&
    (presentDay(v.ruleset)
      ? v.colour === undefined
      : v.colour === 0 || v.colour === 7) &&
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
      (c, i) =>
        record(c) &&
        keys(c, ['ink', 'kit', 'name', 'paper', 'squad', 'width']) &&
        // Every club but the managed one keeps its squad outside the places.
        (clubSquads(v.ruleset as Ruleset) && i + 1 !== v.club
          ? Array.isArray(c.squad) && c.squad.every(squadPlayer)
          : c.squad === undefined) &&
        text(c.name, c.ink === null ? 12 : 10) &&
        (c.ink === null || integer(c.ink, 0, 7)) &&
        (c.paper === undefined || integer(c.paper, 0, 7)) &&
        (presentDay(v.ruleset as Ruleset)
          ? kit(c.kit)
          : c.kit === undefined && c.paper === undefined) &&
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
        keys(p, [
          'energy',
          'id',
          'name',
          'position',
          'skill',
          'status',
          'value',
          'weeksOut'
        ]) &&
        p.id === i + 1 &&
        (p.weeksOut === undefined ||
          (tiringInjuries(v.ruleset as Ruleset) &&
            p.status === 3 &&
            integer(p.weeksOut, 1, 3))) &&
        (clubSquads(v.ruleset as Ruleset)
          ? positions.includes(p.position as never)
          : p.position === undefined) &&
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

/**
 * Reads the game from a save of the given version. Saves before version 6
 * predate rulesets, so their games play the original rules.
 */
export const savedGame = (v: unknown, version: number): Game | undefined => {
  // Grace periods (#74) arrived in version 8.
  if (version < 8 && record(v) && 'graceWeeks' in v) {
    return undefined;
  }
  // Weeks out (#98) arrived in version 10.
  if (
    version < 10 &&
    record(v) &&
    Array.isArray(v.players) &&
    v.players.some(p => record(p) && 'weeksOut' in p)
  ) {
    return undefined;
  }
  // Club squads (#113) arrived in version 11; a ruleset with them rejects
  // any earlier save, since none was written without them.
  if (
    version < 11 &&
    record(v) &&
    isRuleset(v.ruleset) &&
    clubSquads(v.ruleset)
  ) {
    return undefined;
  }
  if (version >= rulesetSaveVersion) {
    return validGame(v) ? v : undefined;
  }
  if (!record(v) || 'ruleset' in v) {
    return undefined;
  }
  const game = { ...v, ruleset: 'original' };
  return validGame(game) ? game : undefined;
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
    !keptVersion(value.version) ||
    !integer(value.frames, 0, framePeriod - 1)
  ) {
    throw invalid();
  }
  const game = savedGame(value.game, value.version as number);
  if (!game) {
    throw invalid();
  }
  return { frames: value.frames, game };
};

export const encodeSave = (game: Game, frames: number): string => {
  validateFrames(frames);
  const data = JSON.stringify({
    format: 'fman-web',
    frames,
    game,
    version: saveVersion
  });
  decodeSave(data);
  return data;
};
