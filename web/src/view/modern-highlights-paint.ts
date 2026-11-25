import {
  controlIds,
  effectOf,
  type HighlightsAction,
  type HighlightsControl
} from './highlights-controls';
import type {
  ModernHighlights,
  ModernLineUp,
  ModernTickerLine
} from './modern-highlights';
import { appendScoreboard, cell, strengthsTable } from './paint-parts';

/**
 * Whether Enter and Space on `element` click it, reaching nothing else: a
 * view control, or any highlights control (#297).
 */
export const clicksOnEnter = (element: Element | null | undefined) =>
  !!element?.closest('[data-view-control], [data-clicks-on-enter]');

/**
 * A control's button. Enter or Space on any of them clicks it, and never
 * reaches the playhead or the match as a keypress. A control that does
 * nothing to the match is a view control too: focus stays on it across
 * rebuilds.
 */
const controlButton = (control: HighlightsControl, className?: string) => {
  const button = document.createElement('button');
  button.type = 'button';
  if (className) {
    button.className = className;
  }
  button.disabled = !control.enabled;
  button.dataset.id = control.id;
  button.dataset.clicksOnEnter = '';
  if (effectOf(control.action) === 'none') {
    button.dataset.viewControl = control.id;
  }
  if (control.state?.expanded !== undefined) {
    button.setAttribute('aria-expanded', String(control.state.expanded));
  }
  if (control.state?.selected !== undefined) {
    button.setAttribute('aria-selected', String(control.state.selected));
  }
  return button;
};

/** The control that does `kind`, if the highlights have one. */
const controlFor = (
  controls: readonly HighlightsControl[],
  kind: HighlightsAction['kind']
) => controls.find(control => control.action.kind === kind);

/**
 * Modern mode's highlights scoreboard: one strip with the game menu, both
 * clubs, the score and the clock. Names too long for a phone's strip give
 * way to their three letters.
 */
const stripScoreboard = (highlights: ModernHighlights) => {
  const board = document.createElement('section');
  board.className = 'scoreboard strip-scoreboard';
  board.setAttribute('aria-label', `Score: ${highlights.title}`);
  const menu = document.createElement('button');
  menu.type = 'button';
  menu.className = 'menu-button scoreboard-menu';
  menu.setAttribute('aria-haspopup', 'dialog');
  menu.setAttribute('aria-label', 'Game menu');
  menu.title = 'Game menu';
  menu.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" /></svg>';
  board.append(menu);
  appendScoreboard(board, highlights);
  return board;
};

/** One ticker line's cells: minute, word, name and score. */
const tickerCells = (line: ModernTickerLine) => [
  cell('ticker-minute', line.minute),
  cell('ticker-word', line.word),
  cell('ticker-name', line.name),
  cell('ticker-score', line.score ?? '')
];

/** Modern mode's ticker (#108, #45): newest on top, with Skip below. */
const tickerList = (ticker: NonNullable<ModernHighlights['ticker']>) => {
  const list = document.createElement('ol');
  list.className = 'modern-ticker';
  list.setAttribute('aria-label', 'Match moments');
  list.append(
    ...ticker.lines.map(line => {
      const item = document.createElement('li');
      item.className = line.kind;
      item.append(...tickerCells(line));
      return item;
    })
  );
  return list;
};

/**
 * Under the clip's pitch on a phone (#145): the latest moment's line, as the
 * button that opens the moments drawer; empty, at the same height, until the
 * first clip reaches its moment or after Skip.
 */
const latestMoment = (
  lines: readonly ModernTickerLine[],
  control: HighlightsControl | undefined,
  full: boolean
) => {
  const latest = lines[0];
  if (!latest || !control) {
    const empty = document.createElement('div');
    empty.className = 'latest-moment';
    empty.textContent = full ? 'Full time' : 'Kick-off';
    return empty;
  }
  // A second tap closes the drawer it opened.
  const button = controlButton(control, `latest-moment ${latest.kind}`);
  button.setAttribute('aria-controls', 'moments-drawer');
  button.append(
    ...tickerCells(latest),
    cell('latest-all', `☰ ${lines.length}`)
  );
  button.setAttribute('aria-label', control.label);
  return button;
};

/** The phone's moments drawer (#145): every line so far, over the pitch. */
const momentsDrawer = (
  ticker: NonNullable<ModernHighlights['ticker']>,
  closeControl: HighlightsControl
) => {
  const drawer = document.createElement('section');
  drawer.className = 'moments-drawer';
  drawer.id = 'moments-drawer';
  drawer.setAttribute('aria-label', 'All moments');
  const header = document.createElement('div');
  header.className = 'moments-header';
  const title = document.createElement('h3');
  title.textContent = 'All moments';
  const close = controlButton(closeControl);
  close.textContent = closeControl.label;
  header.append(title, close);
  drawer.append(header, tickerList(ticker));
  return drawer;
};

/** The wide window's moments panel (#145), beside the clip's pitch. */
const momentsPanel = (ticker: NonNullable<ModernHighlights['ticker']>) => {
  const panel = document.createElement('section');
  panel.className = 'moments-panel';
  panel.setAttribute('aria-label', 'Moments');
  const title = document.createElement('h3');
  title.textContent = 'Moments';
  panel.append(title, tickerList(ticker));
  return panel;
};

/** A side's line-up (#256): its players by position, then its strengths. */
const lineUpPanel = (lineUp: ModernLineUp) => {
  const body = document.createElement('div');
  body.className = 'line-up';
  for (const group of lineUp.groups) {
    const heading = document.createElement('h4');
    heading.textContent = group.label;
    const list = document.createElement('ul');
    list.setAttribute('aria-label', group.label);
    for (const row of group.rows) {
      const item = document.createElement('li');
      item.classList.toggle('named', row.named);
      item.classList.toggle('injured', row.injured !== undefined);
      if (row.named) {
        item.setAttribute('aria-current', 'true');
      }
      item.append(cell('line-up-name', row.name || '–'));
      for (const minute of row.goals) {
        const goal = cell('line-up-goal', minute);
        goal.setAttribute('aria-label', `Goal, ${minute}`);
        item.append(goal);
      }
      if (row.injured) {
        const injury = cell('line-up-injury', row.injured);
        injury.setAttribute('aria-label', `Injured, ${row.injured}`);
        item.append(injury);
      }
      list.append(item);
    }
    body.append(heading, list);
  }
  const strengths = document.createElement('dl');
  strengths.className = 'line-up-strengths';
  strengths.setAttribute('aria-label', 'Team strengths');
  for (const [name, value] of lineUp.strengths) {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = name;
    const amount = document.createElement('dd');
    amount.textContent = String(value);
    row.append(term, amount);
    strengths.append(row);
  }
  body.append(strengths);
  return body;
};

/**
 * The column beside the clips' pitch (#256): tabs for the moments and each
 * side's line-up, the clubs' tabs named for them with their kits. Only the
 * tab on show is drawn.
 */
const tabbedPanel = (
  ticker: NonNullable<ModernHighlights['ticker']>,
  lineUps: NonNullable<ModernHighlights['lineUps']>,
  clip: NonNullable<ModernHighlights['clip']>,
  controls: readonly HighlightsControl[]
) => {
  const panel = document.createElement('section');
  panel.className = 'moments-panel tabbed';
  panel.setAttribute('aria-label', 'Moments and line-ups');
  const tabs = document.createElement('div');
  tabs.className = 'panel-tabs';
  tabs.setAttribute('role', 'tablist');
  for (const control of controls) {
    if (control.action.kind !== 'tab') {
      continue;
    }
    const { tab } = control.action;
    const button = controlButton(control, 'panel-tab');
    button.id = `panel-tab-${tab}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'panel-tab-body');
    button.tabIndex = tab === clip.tab ? 0 : -1;
    if (tab !== 'moments') {
      const swatch = document.createElement('span');
      swatch.className = 'kit-swatch';
      swatch.style.background = lineUps[tab].kit;
      swatch.setAttribute('aria-hidden', 'true');
      button.append(swatch);
    }
    button.append(cell('panel-tab-name', control.label));
    if (tab === 'moments' && clip.unseen) {
      const dot = cell('unseen-dot', '');
      dot.setAttribute('aria-label', 'New moments');
      button.append(dot);
    }
    tabs.append(button);
  }
  const body = document.createElement('div');
  body.className = 'panel-tab-body';
  body.id = 'panel-tab-body';
  body.setAttribute('role', 'tabpanel');
  body.setAttribute('aria-labelledby', `panel-tab-${clip.tab}`);
  body.append(
    clip.tab === 'moments' ? tickerList(ticker) : lineUpPanel(lineUps[clip.tab])
  );
  panel.append(tabs, body);
  return panel;
};

const icons = {
  next: '<path d="M5 5l9 7-9 7zM16 5h3v14h-3z" fill="currentColor" />',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor" />',
  rewind: '<path d="M19 5l-9 7 9 7zM5 5h3v14H5z" fill="currentColor" />'
};

/** One of the playhead's buttons, drawn as its icon and named for readers. */
const playheadButton = (control: HighlightsControl) => {
  const button = controlButton(control, 'playhead-button');
  const icon =
    control.action.kind === 'play'
      ? control.label === 'Play'
        ? icons.play
        : icons.pause
      : control.action.kind === 'next'
        ? icons.next
        : icons.rewind;
  button.setAttribute('aria-label', control.label);
  button.title = control.label;
  button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icon}</svg>`;
  return button;
};

/**
 * The playhead's controls (ADR 0016): rewind, play or pause, and next.
 * At full time only rewind is left, to watch the last clip again.
 */
const transport = (controls: readonly HighlightsControl[]) => {
  const buttons = (['rewind', 'play', 'next'] as const).flatMap(kind => {
    const control = controlFor(controls, kind);
    return control ? [playheadButton(control)] : [];
  });
  if (buttons.length === 0) {
    return undefined;
  }
  const group = document.createElement('div');
  group.className = 'transport';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Playback');
  group.append(...buttons);
  return group;
};

/**
 * The row under the highlights: Skip all, which becomes Continue for the
 * final hold, after the latest moment's line where one is given, and under
 * clips the playhead's controls before it.
 */
const controlsRow = (
  controls: readonly HighlightsControl[],
  latest?: HTMLElement
) => {
  const row = document.createElement('div');
  row.className = 'highlights-controls';
  if (latest) {
    row.append(latest);
  }
  const playback = transport(controls);
  if (playback) {
    row.append(playback);
  }
  const end = controlFor(controls, 'continue') ?? controlFor(controls, 'skip');
  if (end) {
    const button = controlButton(end, 'primary');
    button.textContent = end.label;
    row.append(button);
  }
  return row;
};

/**
 * Modern mode's highlights screen (#45), around `pitch`, the canvas the
 * original pitch is painted on.
 */
export const paintHighlights = (
  pane: HTMLElement,
  pitch: HTMLCanvasElement,
  clipPitch: HTMLCanvasElement,
  clipBar: HTMLElement,
  highlights: ModernHighlights
) => {
  const parts: HTMLElement[] = [stripScoreboard(highlights)];
  if (highlights.clip && highlights.ticker) {
    // Sprite highlights (#144): the clip's pitch, with the latest moment's
    // line under it, or after Skip the whole ticker over it. The moments
    // (#145) are in a drawer on a phone and a panel on a wide window.
    const { clip, ticker } = highlights;
    const stage = document.createElement('div');
    stage.className = 'clip-stage';
    // The drawer rises from the pitch's own foot, not the stage's.
    const frame = document.createElement('div');
    frame.className = 'clip-frame';
    frame.append(clipPitch);
    if (!clip.full) {
      frame.append(clipBar);
    }
    const close = highlights.controls.find(
      control => control.id === controlIds.close
    );
    if (close) {
      frame.append(momentsDrawer(ticker, close));
    }
    stage.append(frame);
    if (clip.full) {
      const overlay = tickerList(ticker);
      overlay.classList.add('full-ticker');
      stage.append(overlay);
    }
    // Under the pitch: the latest moment, then the playhead's controls and
    // Skip all, which becomes Continue once the last clip has played.
    const controls = controlsRow(
      highlights.controls,
      latestMoment(
        ticker.lines,
        highlights.controls.find(control => control.id === controlIds.latest),
        clip.full
      )
    );
    const panel = highlights.lineUps
      ? tabbedPanel(ticker, highlights.lineUps, clip, highlights.controls)
      : momentsPanel(ticker);
    pane.replaceChildren(panel, ...parts, stage, controls);
    return;
  }
  if (highlights.pitch) {
    pitch.setAttribute(
      'aria-label',
      highlights.pitch.attacking
        ? `Pitch: ${highlights.pitch.attacking.name} attacking`
        : 'Pitch'
    );
    const strengths = document.createElement('div');
    strengths.className = 'highlights-strengths';
    strengths.append(strengthsTable(highlights.pitch.strengths));
    parts.push(pitch, strengths);
  }
  if (highlights.ticker) {
    parts.push(tickerList(highlights.ticker), controlsRow(highlights.controls));
  }
  pane.replaceChildren(...parts);
};
