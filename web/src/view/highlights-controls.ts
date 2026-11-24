import type { SkipControl } from './context-bar';
import type { ClipProgress, HighlightsTab } from './modern-highlights';

/** The tabs of the column beside the clips' pitch (#256), in order. */
export const highlightsTabs: readonly HighlightsTab[] = [
  'moments',
  'home',
  'away'
];

/** What a highlights control does when pressed. */
export type HighlightsAction =
  | Readonly<{ kind: 'continue' }>
  /** Opens or closes the moments drawer (#145). */
  | Readonly<{ kind: 'drawer'; open: boolean }>
  | Readonly<{ kind: 'next' }>
  | Readonly<{ kind: 'play' }>
  | Readonly<{ kind: 'rewind' }>
  | Readonly<{ kind: 'skip' }>
  | Readonly<{ kind: 'tab'; tab: HighlightsTab }>;

/**
 * What pressing a control does to the match:
 * - `none`: nothing. It is a view control, and Enter or Space on it presses
 *   no key into the match.
 * - `presses-enter`: it may end the pause the match is on with a brief
 *   Enter, as the original's keypress ends a ticker pause (ADR 0006).
 * - `skips-pauses`: it ends the ticker's remaining pauses at once,
 *   without pressing a key.
 */
export type MatchEffect = 'none' | 'presses-enter' | 'skips-pauses';

const effects: Readonly<Record<HighlightsAction['kind'], MatchEffect>> = {
  continue: 'presses-enter',
  drawer: 'none',
  next: 'presses-enter',
  play: 'none',
  rewind: 'none',
  skip: 'skips-pauses',
  tab: 'none'
};

export const effectOf = (action: HighlightsAction): MatchEffect =>
  effects[action.kind];

/**
 * One control on Modern mode's highlights screen. `keys` are the
 * `KeyboardEvent.key` values it owns while the playhead takes the keys;
 * none otherwise.
 */
export type HighlightsControl = Readonly<{
  action: HighlightsAction;
  enabled: boolean;
  id: string;
  keys: readonly string[];
  label: string;
  state?: Readonly<{ expanded?: boolean; selected?: boolean }>;
}>;

export const controlIds = {
  close: 'moments.close',
  continue: 'ticker.continue',
  latest: 'moments.latest',
  next: 'clips.next',
  play: 'clips.play',
  rewind: 'clips.rewind',
  skip: 'ticker.skip' satisfies SkipControl['id']
} as const;

/** A tab's button. */
export const tabId = (tab: HighlightsTab) => `clips.tab.${tab}`;

export type ControlsInput = Readonly<{
  /** How far the clips have got; absent when the match plays without clips. */
  clip?: ClipProgress;
  /** The clubs' names, for their line-up tabs. */
  clubs: Readonly<{ away: string; home: string }>;
  ticker: Readonly<{
    /** The ticker's moments are over: the final hold, or after it. */
    fullTime: boolean;
    /** The moments shown so far. */
    lines: number;
    /** The ticker still has pauses for Skip all to end. */
    skip: boolean;
  }>;
}>;

/**
 * The highlights' controls for the match on show: which exist, whether
 * each is enabled, its label and state, and the keys it owns.
 *
 * Under clips, until Skip all, the playhead takes the keys (ADR 0016).
 * Without clips, or after Skip all, no control owns a key, and keys reach
 * the match as keypresses (ADR 0006).
 */
export const highlightsControls = ({
  clip,
  clubs,
  ticker
}: ControlsInput): HighlightsControl[] => {
  const controls: HighlightsControl[] = [];
  const playing = clip !== undefined && !clip.full;
  // At full time: the ticker's moments are over and no clip is on show,
  // not even the last one watched again.
  const fullTime = ticker.fullTime && clip?.playing === undefined;
  if (playing && ticker.lines > 0) {
    controls.push({
      action: { kind: 'drawer', open: !clip.drawer },
      enabled: true,
      id: controlIds.latest,
      keys: [],
      label: `All moments (${ticker.lines})`,
      state: { expanded: clip.drawer }
    });
  }
  if (playing) {
    controls.push(
      {
        action: { kind: 'rewind' },
        enabled: true,
        id: controlIds.rewind,
        keys: ['ArrowLeft'],
        label: 'Rewind'
      },
      {
        action: { kind: 'play' },
        enabled: !fullTime,
        id: controlIds.play,
        keys: [' '],
        label: clip.paused ? 'Play' : 'Pause'
      },
      {
        action: { kind: 'next' },
        enabled: !fullTime,
        id: controlIds.next,
        keys: ['ArrowRight', 'Enter'],
        label: 'Next'
      }
    );
  }
  controls.push(
    ticker.fullTime
      ? {
          action: { kind: 'continue' },
          enabled: true,
          id: controlIds.continue,
          // While the last clip is watched again, those keys are Next's.
          keys: playing && fullTime ? ['ArrowRight', 'Enter'] : [],
          label: 'Continue'
        }
      : {
          action: { kind: 'skip' },
          enabled: ticker.skip,
          id: controlIds.skip,
          keys: [],
          label: 'Skip all'
        }
  );
  if (playing && clip.drawer) {
    controls.push({
      action: { kind: 'drawer', open: false },
      enabled: true,
      id: controlIds.close,
      keys: [],
      label: 'Close'
    });
  }
  if (clip) {
    for (const tab of highlightsTabs) {
      controls.push({
        action: { kind: 'tab', tab },
        enabled: true,
        id: tabId(tab),
        keys: [],
        label: tab === 'moments' ? 'Moments' : clubs[tab],
        state: { selected: tab === clip.tab }
      });
    }
  }
  return controls;
};

/** Whether the playhead takes the keys, so a key no control owns does nothing. */
export const takesKeys = (controls: readonly HighlightsControl[]) =>
  controls.some(control => control.keys.length > 0);

/** The enabled control that owns `key`, if one does. */
export const controlForKey = (
  controls: readonly HighlightsControl[],
  key: string
) => controls.find(control => control.enabled && control.keys.includes(key));
