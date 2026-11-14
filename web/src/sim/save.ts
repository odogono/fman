import { framePeriod, validateFrames } from './frame-clock';
import type { Game } from './management';
import { ruleData, type RuleData } from './rule-data';
import { isRuleset } from './ruleset';
import { array, integer, keys, record, text } from './save-checks';

// Room for a journal's 5000 inputs on top of a game: about 8 KB, or 50 KB
// under club squads (#113), whose 872 players outside the places are saved too.
export const saveLimit = 200_000;
/** The version every save is written with. */
export const saveVersion = 12;
/** The first save version whose journals carry clip lengths (ADR 0013). */
export const clipsSaveVersion = 12;
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
const position = (v: unknown) =>
  record(v) &&
  keys(v, ['x', 'y']) &&
  integer(v.x, -256, 256) &&
  integer(v.y, -256, 256);
const rules = Object.values(ruleData);
/** The fields every rule owns at one level, allowed beside the shared ones. */
const ruleKeys = (level: 'club' | 'game' | 'player') =>
  rules.flatMap(rule => rule[level]?.keys ?? []);

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
  if (!isRuleset(v.ruleset)) {
    return false;
  }
  const { ruleset } = v;
  const on = rules.map(rule => rule.on(ruleset));
  return (
    keys(v, [
      ...numeric,
      ...ruleKeys('game'),
      'attackCarry',
      'club',
      'clubs',
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
      'ruleset',
      'seed'
    ]) &&
    rules.every((rule, i) => rule.game?.valid(v, on[i]!, ruleset) ?? true) &&
    numeric.every(key => integer(v[key])) &&
    integer(v.club, 1, 64) &&
    integer(v.division, 1, 4) &&
    Math.ceil(v.club / 16) === v.division &&
    integer(v.level, 1, 7) &&
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
        keys(c, [...ruleKeys('club'), 'ink', 'name', 'width']) &&
        rules.every((rule, r) => rule.club?.valid(c, i, v, on[r]!) ?? true) &&
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
        keys(p, [
          ...ruleKeys('player'),
          'energy',
          'id',
          'name',
          'skill',
          'status',
          'value'
        ]) &&
        p.id === i + 1 &&
        rules.every((rule, r) => rule.player?.valid(p, on[r]!) ?? true) &&
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

/** The save holds any of the fields the rule owns, at any level. */
const carries = (v: unknown, rule: RuleData) => {
  if (!record(v)) {
    return false;
  }
  const has = (entries: unknown, owned: readonly string[] = []) =>
    Array.isArray(entries) &&
    entries.some(e => record(e) && owned.some(key => key in e));
  return (
    (rule.game?.keys ?? []).some(key => key in v) ||
    has(v.clubs, rule.club?.keys) ||
    has(v.players, rule.player?.keys)
  );
};

/**
 * Reads the game from a save of the given version. Saves before version 6
 * predate rulesets, so their games play the original rules.
 */
export const savedGame = (v: unknown, version: number): Game | undefined => {
  // A rule's data never appears in a save older than the rule.
  if (
    rules.some(
      rule =>
        rule.since !== undefined && version < rule.since && carries(v, rule)
    )
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
