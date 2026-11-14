import { nameBytes } from './names';
import { positions } from './squads';

/** Checks on the shape of a saved value, which comes from outside. */

export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const keys = (v: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(v).every(key => allowed.includes(key));

export const integer = (
  v: unknown,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER
): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;

export const text = (v: unknown, max: number): v is string => {
  if (typeof v !== 'string') {
    return false;
  }
  try {
    return nameBytes(v).length <= max;
  } catch {
    return false;
  }
};

export const array = (
  v: unknown,
  size: number,
  valid: (entry: unknown, index: number) => boolean
) => Array.isArray(v) && v.length === size && v.every(valid);

/** A player outside the 24 places under club squads (#113). */
export const squadPlayer = (v: unknown) =>
  record(v) &&
  keys(v, ['name', 'position', 'skill']) &&
  text(v.name, 8) &&
  positions.includes(v.position as never) &&
  integer(v.skill, 0, 100);

/** Two inks the highlights can tell from the grass and from each other. */
export const kit = (v: unknown) =>
  record(v) &&
  keys(v, ['change', 'home']) &&
  [v.change, v.home].every(ink => integer(ink, 0, 7) && ink !== 6) &&
  v.change !== v.home;
