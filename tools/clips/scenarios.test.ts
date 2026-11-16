import { describe, expect, test } from 'bun:test';

import { browserCandidates } from './browser';
import {
  defaultScenarios,
  inMatchOrder,
  parseOptions,
  parseSeeds,
  withDefaults
} from './scenarios';

describe('parseOptions', () => {
  test('records every named scenario by default', () => {
    const options = parseOptions([]);
    expect(options.scenarios).toEqual([...defaultScenarios]);
    expect(options.out).toBe('build/clips');
    expect(options.step).toBe(2);
    expect(options.frames).toBe(false);
  });

  test('--only picks named scenarios, in the order given', () => {
    const names = parseOptions(['--only', 'rebound,shot']).scenarios.map(
      s => s.name
    );
    expect(names).toEqual(['rebound', 'shot']);
    expect(() => parseOptions(['--only', 'bicycle-kick'])).toThrow(
      'no scenario "bicycle-kick"'
    );
  });

  test('clip options make one scenario per seed, named from the options', () => {
    const { scenarios } = parseOptions([
      '--kind',
      'save',
      '--outcome',
      'parry',
      '--finish',
      'header',
      '--rebound',
      'yes',
      '--minute',
      '70',
      '--seeds',
      '4-5'
    ]);
    expect(scenarios).toEqual(
      [4, 5].map(seedBase => ({
        name: `save-parry-header-rebound-min70-seed${seedBase}`,
        settings: {
          finish: 'header',
          kind: 'save',
          minute: 70,
          outcome: 'parry',
          rebound: 'yes',
          seedBase
        }
      }))
    );
  });

  test('a clip option alone defaults to a goal from seed 1', () => {
    expect(parseOptions(['--restart', 'corner']).scenarios).toEqual([
      {
        name: 'goal-corner-seed1',
        settings: { kind: 'goal', restart: 'corner', seedBase: 1 }
      }
    ]);
    expect(
      parseOptions(['--seeds', '9', '--name', 'mine']).scenarios[0]!.name
    ).toBe('mine-seed9');
  });

  test('rejects what the debugger has no setting for', () => {
    expect(() => parseOptions(['--kind', 'penalty'])).toThrow('--kind');
    // A goal's only outcome is the goal.
    expect(() => parseOptions(['--outcome', 'parry'])).toThrow('--outcome');
    expect(() => parseOptions(['--finish', 'volley'])).toThrow('--finish');
    expect(() => parseOptions(['--minute', '91'])).toThrow('--minute');
    expect(() => parseOptions(['--step', '0'])).toThrow('--step');
    expect(() => parseOptions(['--only', 'shot', '--kind', 'goal'])).toThrow(
      '--only'
    );
    expect(() => parseOptions(['--bogus'])).toThrow();
  });
});

test('parseSeeds reads a seed, a list or a range', () => {
  expect(parseSeeds('7')).toEqual([7]);
  expect(parseSeeds('3,7,9')).toEqual([3, 7, 9]);
  expect(parseSeeds('1-3,10')).toEqual([1, 2, 3, 10]);
  expect(() => parseSeeds('5-2')).toThrow();
  expect(() => parseSeeds('1-500')).toThrow();
  expect(() => parseSeeds('x')).toThrow();
});

test('withDefaults puts back every setting a scenario leaves out', () => {
  expect(withDefaults({ kind: 'save', seedBase: 4 })).toEqual({
    finish: 'seed',
    foul: 'no',
    kind: 'save',
    minute: 30,
    outcome: 'seed',
    penalty: 'no',
    rebound: 'seed',
    restart: 'seed',
    seedBase: 4,
    side: 'home',
    tackled: 'yes'
  });
});

test('an injury clip can be tackled or pulling up', () => {
  const [scenario] = parseOptions([
    '--kind',
    'injury',
    '--tackled',
    'no'
  ]).scenarios;
  expect(scenario!.name).toBe('injury-pulled-up-seed1');
  expect(scenario!.settings).toMatchObject({ kind: 'injury', tackled: 'no' });
});

test('a clip can be a penalty, or an injury from a foul in the box', () => {
  const [penalty] = parseOptions([
    '--kind',
    'save',
    '--penalty',
    'yes'
  ]).scenarios;
  expect(penalty!.name).toBe('save-penalty-seed1');
  expect(penalty!.settings).toMatchObject({ kind: 'save', penalty: 'yes' });
  const [foul] = parseOptions(['--kind', 'injury', '--foul', 'yes']).scenarios;
  expect(foul!.name).toBe('injury-foul-seed1');
  expect(foul!.settings).toMatchObject({ foul: 'yes', kind: 'injury' });
  expect(() => parseOptions(['--penalty', 'maybe'])).toThrow(
    '--penalty must be one of'
  );
});

test('browserCandidates tries the newest Playwright headless shell first', () => {
  const candidates = browserCandidates(
    [
      'chromium-1250',
      'chromium_headless_shell-1217',
      'chromium_headless_shell-1254',
      'ffmpeg-1011',
      'firefox-1555'
    ],
    '/cache'
  );
  expect(candidates[0]).toStartWith('/cache/chromium_headless_shell-1254/');
  expect(candidates.findIndex(c => c.includes('-1217/'))).toBeLessThan(
    candidates.findIndex(c => c.includes('chromium-1250/'))
  );
  expect(candidates.some(c => c.includes('firefox'))).toBe(false);
});

describe('inMatchOrder', () => {
  test('--sequence plays the clips in minute order, spreading those without one', () => {
    expect(parseOptions(['--sequence']).sequence).toBe(true);
    expect(parseOptions([]).sequence).toBe(false);
    const ordered = inMatchOrder([
      { name: 'a', settings: {} },
      { name: 'b', settings: { minute: 10 } },
      { name: 'c', settings: {} }
    ]);
    expect(ordered.map(s => [s.name, s.settings.minute])).toEqual([
      ['b', 10],
      ['a', 23],
      ['c', 68]
    ]);
  });
});
