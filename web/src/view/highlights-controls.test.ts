import { expect, test } from 'bun:test';

import {
  controlForKey,
  effectOf,
  highlightsControls,
  takesKeys,
  type ControlsInput,
  type HighlightsAction,
  type HighlightsControl
} from './highlights-controls';
import type { ClipProgress } from './modern-highlights';

const clip = (progress: Partial<ClipProgress> = {}): ClipProgress => ({
  drawer: false,
  full: false,
  heard: 0,
  paused: false,
  shown: 0,
  tab: 'moments',
  unseen: false,
  ...progress
});

const clubs = { away: 'Arsenal', home: 'Leeds' };
const running = { fullTime: false, lines: 2, skip: true };
const over = { fullTime: true, lines: 3, skip: false };

/**
 * A control as one line: its id, its label where the id doesn't say it,
 * `-` when disabled, and its keys.
 */
const row = (control: HighlightsControl) =>
  [
    control.id,
    control.action.kind === 'play' || control.action.kind === 'drawer'
      ? `(${control.label})`
      : '',
    control.enabled ? '' : '-',
    control.keys.map(key => (key === ' ' ? 'Space' : key)).join(' ')
  ]
    .filter(Boolean)
    .join(' ');

const tabs = ['clips.tab.moments', 'clips.tab.home', 'clips.tab.away'];

const points: readonly (readonly [string, ControlsInput, readonly string[]])[] =
  [
    [
      'kick-off',
      { clip: clip(), clubs, ticker: { ...running, lines: 0 } },
      [
        'clips.rewind ArrowLeft',
        'clips.play (Pause) Space',
        'clips.next ArrowRight Enter',
        'ticker.skip',
        ...tabs
      ]
    ],
    [
      'during a clip, with the drawer open',
      { clip: clip({ drawer: true, playing: 1 }), clubs, ticker: running },
      [
        'moments.latest (All moments (2))',
        'clips.rewind ArrowLeft',
        'clips.play (Pause) Space',
        'clips.next ArrowRight Enter',
        'ticker.skip',
        'moments.close (Close)',
        ...tabs
      ]
    ],
    [
      'paused',
      { clip: clip({ paused: true, playing: 1 }), clubs, ticker: running },
      [
        'moments.latest (All moments (2))',
        'clips.rewind ArrowLeft',
        'clips.play (Play) Space',
        'clips.next ArrowRight Enter',
        'ticker.skip',
        ...tabs
      ]
    ],
    [
      'watching the last clip again at full time',
      { clip: clip({ playing: 2 }), clubs, ticker: over },
      [
        'moments.latest (All moments (3))',
        'clips.rewind ArrowLeft',
        'clips.play (Pause) Space',
        'clips.next ArrowRight Enter',
        'ticker.continue',
        ...tabs
      ]
    ],
    [
      'full time',
      { clip: clip(), clubs, ticker: over },
      [
        'moments.latest (All moments (3))',
        'clips.rewind ArrowLeft',
        'clips.play (Pause) - Space',
        'clips.next - ArrowRight Enter',
        'ticker.continue ArrowRight Enter',
        ...tabs
      ]
    ],
    [
      'full time with no moments',
      { clip: clip(), clubs, ticker: { ...over, lines: 0 } },
      [
        'clips.rewind ArrowLeft',
        'clips.play (Pause) - Space',
        'clips.next - ArrowRight Enter',
        'ticker.continue ArrowRight Enter',
        ...tabs
      ]
    ],
    [
      'after Skip all, the ticker still running',
      { clip: clip({ full: true }), clubs, ticker: running },
      ['ticker.skip', ...tabs]
    ],
    [
      'after Skip all, at full time',
      { clip: clip({ full: true }), clubs, ticker: over },
      ['ticker.continue', ...tabs]
    ],
    ['without clips', { clubs, ticker: running }, ['ticker.skip']],
    [
      'without clips, at full time',
      { clubs, ticker: over },
      ['ticker.continue']
    ]
  ];

test.each(points)('the controls at %s', (_, input, expected) => {
  expect(highlightsControls(input).map(row)).toEqual([...expected]);
});

test.each(points)(
  'at %s, no two enabled controls own a key, and only the playhead takes them',
  (_, input) => {
    const controls = highlightsControls(input);
    const owned = controls
      .filter(control => control.enabled)
      .flatMap(control => control.keys);
    expect(new Set(owned).size).toBe(owned.length);
    expect(takesKeys(controls)).toBe(
      input.clip !== undefined && !input.clip.full
    );
    // Each key acts as its button would.
    for (const key of owned) {
      expect(controlForKey(controls, key)?.keys).toContain(key);
    }
  }
);

test('a disabled control’s key does nothing', () => {
  const controls = highlightsControls({ clip: clip(), clubs, ticker: over });
  expect(controlForKey(controls, ' ')).toBeUndefined();
  expect(controlForKey(controls, 'Enter')?.action.kind).toBe('continue');
});

test('only Next and Continue press a key into the match, and Skip all ends its pauses', () => {
  const actions: readonly HighlightsAction[] = [
    { kind: 'continue' },
    { kind: 'drawer', open: true },
    { kind: 'next' },
    { kind: 'play' },
    { kind: 'rewind' },
    { kind: 'skip' },
    { kind: 'tab', tab: 'home' }
  ];
  expect(
    Object.fromEntries(actions.map(action => [action.kind, effectOf(action)]))
  ).toEqual({
    continue: 'presses-enter',
    drawer: 'none',
    next: 'presses-enter',
    play: 'none',
    rewind: 'none',
    skip: 'skips-pauses',
    tab: 'none'
  });
});

/** The latest moment's button, which opens and closes the drawer. */
const latest = (drawer: boolean) =>
  highlightsControls({
    clip: clip({ drawer, playing: 1 }),
    clubs,
    ticker: running
  }).find(control => control.id === 'moments.latest');

test('the drawer’s button opens it, then closes it', () => {
  expect(latest(false)).toMatchObject({
    action: { open: true },
    state: { expanded: false }
  });
  expect(latest(true)).toMatchObject({
    action: { open: false },
    state: { expanded: true }
  });
});

test('the line-up tabs are named for the clubs, and the one on show is selected', () => {
  const controls = highlightsControls({
    clip: clip({ tab: 'away' }),
    clubs,
    ticker: running
  }).filter(control => control.action.kind === 'tab');
  expect(
    controls.map(control => [control.label, control.state?.selected])
  ).toEqual([
    ['Moments', false],
    ['Leeds', false],
    ['Arsenal', true]
  ]);
});
