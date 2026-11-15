import { parseArgs } from 'node:util';

import {
  clearanceOutcomes,
  finishes,
  missOutcomes,
  restarts,
  saveOutcomes
} from '../../web/src/view/clips';

/**
 * The clip debugger's settings a recording sets, as `clipDebug.set` takes
 * them. Anything left out is drawn from the seed.
 */
export type ClipSettings = {
  finish?: string;
  kind?: string;
  minute?: number;
  outcome?: string;
  rebound?: 'no' | 'yes';
  restart?: string;
  seedBase?: number;
  side?: 'away' | 'home';
};

export type Scenario = { name: string; settings: ClipSettings };

/**
 * One clip of each kind of chance, recorded when no scenario is named. The
 * seeds give clips whose moment comes by about 10 s.
 */
export const defaultScenarios: readonly Scenario[] = [
  {
    name: 'shot',
    settings: {
      finish: 'shot',
      kind: 'goal',
      restart: 'open-play',
      seedBase: 18
    }
  },
  {
    name: 'corner-header',
    settings: { kind: 'goal', restart: 'corner', seedBase: 1 }
  },
  {
    name: 'cross-header',
    settings: {
      finish: 'header',
      kind: 'save',
      restart: 'open-play',
      seedBase: 4
    }
  },
  {
    name: 'long-range',
    settings: {
      finish: 'long-range',
      kind: 'goal',
      restart: 'open-play',
      seedBase: 13
    }
  },
  {
    name: 'one-on-one',
    settings: {
      finish: 'one-on-one',
      kind: 'save',
      restart: 'open-play',
      seedBase: 2
    }
  },
  {
    name: 'rebound',
    settings: {
      finish: 'shot',
      kind: 'goal',
      rebound: 'yes',
      restart: 'open-play',
      seedBase: 18
    }
  },
  { name: 'clearance', settings: { kind: 'clearance', seedBase: 4 } },
  { name: 'near-miss', settings: { kind: 'near-miss', seedBase: 23 } },
  // After half-time the home side attacks down the screen.
  {
    name: 'goal-attacking-down',
    settings: { kind: 'goal', minute: 60, seedBase: 12 }
  }
].map(scenario => ({
  ...scenario,
  // A rebound only where it's the point, so each seed's clip stays put.
  settings: { rebound: 'no', ...scenario.settings } as ClipSettings
}));

const kinds = ['goal', 'save', 'clearance', 'near-miss'];
const outcomes: Record<string, readonly string[]> = {
  clearance: clearanceOutcomes,
  goal: ['goal'],
  'near-miss': missOutcomes,
  save: [...saveOutcomes, 'claim']
};

export const usage = `Usage:
  bun run clips:record                     one clip of each kind of chance
  bun run clips:record --only shot,rebound some of those (names below)
  bun run clips:record --kind goal --finish header --seeds 1-5
                                           your own clip, once per seed

Clip options (anything left out comes from the seed):
  --kind      ${kinds.join(', ')}  (default goal)
  --outcome   goal; dive, hold, parry, claim; ${clearanceOutcomes.join(', ')}; ${missOutcomes.join(', ')}
  --restart   ${restarts.join(', ')}
  --finish    ${finishes.join(', ')}
  --rebound   yes, no
  --minute    1 to 90 (default 30; after 45 the home side attacks down the screen)
  --side      home, away: the side that has the chance (default home)
  --seeds     a seed, a list (3,7,9) or a range (1-5); default 1
  --name      the files' name (default from the options)

Output:
  --out       the folder for the videos (default build/clips)
  --step      record every nth frame (default 2, so the video plays at 25 fps)
  --frames    keep each clip's JPEG frames beside its video
  --url       record from a running clip debugger, such as
              http://localhost:3147/clips, instead of starting one

Named scenarios: ${defaultScenarios.map(s => s.name).join(', ')}`;

export type Options = {
  frames: boolean;
  out: string;
  scenarios: Scenario[];
  step: number;
  url?: string;
};

const oneOf = (name: string, value: string, allowed: readonly string[]) => {
  if (!allowed.includes(value)) {
    throw new RangeError(`--${name} must be one of: ${allowed.join(', ')}`);
  }
  return value;
};

const integer = (name: string, text: string, min: number, max: number) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(
      `--${name} must be a whole number from ${min} to ${max}`
    );
  }
  return value;
};

/** `7`, `3,7,9` or `1-5`. */
export const parseSeeds = (text: string): number[] =>
  text.split(',').flatMap(part => {
    const [from, to] = part.split('-');
    const start = integer('seeds', from ?? '', 0, 999_999);
    if (to === undefined) {
      return [start];
    }
    const end = integer('seeds', to, start, Math.min(999_999, start + 99));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

/** Reads the command line; throws a RangeError with the problem. */
export const parseOptions = (args: readonly string[]): Options => {
  const { values } = parseArgs({
    args: [...args],
    options: {
      finish: { type: 'string' },
      frames: { type: 'boolean' },
      kind: { type: 'string' },
      minute: { type: 'string' },
      name: { type: 'string' },
      only: { type: 'string' },
      out: { type: 'string' },
      outcome: { type: 'string' },
      rebound: { type: 'string' },
      restart: { type: 'string' },
      seeds: { type: 'string' },
      side: { type: 'string' },
      step: { type: 'string' },
      url: { type: 'string' }
    },
    strict: true
  });
  const own = [
    'finish',
    'kind',
    'minute',
    'name',
    'outcome',
    'rebound',
    'restart',
    'seeds',
    'side'
  ] as const;
  const custom = own.some(key => values[key] !== undefined);
  if (custom && values.only !== undefined) {
    throw new RangeError(
      '--only names built-in scenarios; leave out the clip options'
    );
  }
  const options: Options = {
    frames: values.frames ?? false,
    out: values.out ?? 'build/clips',
    scenarios: [],
    step: values.step ? integer('step', values.step, 1, 50) : 2,
    ...(values.url ? { url: values.url } : {})
  };
  if (!custom) {
    const names = values.only?.split(',').filter(Boolean);
    options.scenarios = names
      ? names.map(name => {
          const found = defaultScenarios.find(s => s.name === name);
          if (!found) {
            throw new RangeError(
              `no scenario "${name}"; there are: ${defaultScenarios.map(s => s.name).join(', ')}`
            );
          }
          return found;
        })
      : [...defaultScenarios];
    return options;
  }
  const kind = oneOf('kind', values.kind ?? 'goal', kinds);
  const settings: ClipSettings = {
    kind,
    ...(values.outcome
      ? { outcome: oneOf('outcome', values.outcome, outcomes[kind]!) }
      : {}),
    ...(values.restart
      ? { restart: oneOf('restart', values.restart, restarts) }
      : {}),
    ...(values.finish
      ? { finish: oneOf('finish', values.finish, finishes) }
      : {}),
    ...(values.rebound
      ? {
          rebound: oneOf('rebound', values.rebound, ['yes', 'no']) as
            'no' | 'yes'
        }
      : {}),
    ...(values.minute
      ? { minute: integer('minute', values.minute, 1, 90) }
      : {}),
    ...(values.side
      ? {
          side: oneOf('side', values.side, ['home', 'away']) as 'away' | 'home'
        }
      : {})
  };
  const name =
    values.name ??
    [
      settings.kind,
      settings.outcome,
      settings.restart,
      settings.finish,
      settings.rebound === 'yes' ? 'rebound' : undefined,
      settings.minute === undefined ? undefined : `min${settings.minute}`,
      settings.side === 'away' ? 'away' : undefined
    ]
      .filter(Boolean)
      .join('-');
  const seeds = parseSeeds(values.seeds ?? '1');
  options.scenarios = seeds.map(seedBase => ({
    name: `${name}-seed${seedBase}`,
    settings: { ...settings, seedBase }
  }));
  return options;
};

/**
 * Every setting a scenario leaves out goes back to the seed, so one
 * recording's settings never carry into the next.
 */
export const withDefaults = (settings: ClipSettings) => ({
  finish: 'seed',
  kind: 'goal',
  minute: 30,
  outcome: 'seed',
  rebound: 'seed',
  restart: 'seed',
  seedBase: 1,
  side: 'home',
  ...settings
});
