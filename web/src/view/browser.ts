import { version } from '../../../package.json';
import { fixtureSides } from '../sim/league';
import { flashPhase, type View } from '../sim/session';
import {
  amountChips,
  amountStep,
  digitAllowed,
  formatAmount,
  type AmountAction,
  type AmountEntry
} from './amount-entry';
import type { App, Dom, MenuControl } from './app';
import { fitClipCanvas, paintClip } from './clip-canvas';
import { paintShot } from './clip-wipe';
import type { BarButton } from './context-bar';
import { celebrationFrame } from './cup-celebration';
import type { CupReplay, CupResult } from './cup-screens';
import type { FullTime } from './full-time';
import { rasterText, rasterizeCells } from './glyphs';
import type { ClubName, Home } from './home';
import type {
  FormResult,
  LeagueRow,
  LeagueTable,
  LeagueZone,
  WeekResults
} from './league-screens';
import type { BidPlayer, LoanCost, ModernAmount } from './modern-amount';
import type { ModernBills } from './modern-bills';
import type { ModernFixture } from './modern-fixture';
import {
  continueId,
  drawerIds,
  highlightsTabs,
  playheadIds,
  tabId,
  type ClipProgress,
  type HighlightsTab,
  type ModernHighlights,
  type ModernLineUp,
  type ModernTickerLine
} from './modern-highlights';
import type { ModernMessage } from './modern-message';
import type { ModernScreen, ModernScreenKind } from './modern-screen';
import type { ModernStatus } from './modern-status';
import type { ModernNames } from './name-screens';
import type { PickTeam, PickTeamRow, Strengths } from './pick-team';
import { paintAttack, paintEmptyPitch } from './pitch';
import type { SaleOffer } from './sale-offer';
import type { EndOfSeason, SeasonSummary } from './season-end';
import type { ModernSetup } from './setup-screens';
import { tickerLines, tickerText } from './ticker-layout';

// The commit the site build stamps in; `bun run dev` leaves it undefined.
declare const FMAN_COMMIT: string | undefined;
const commit = typeof FMAN_COMMIT === 'string' ? FMAN_COMMIT : '';
const versionLabel = commit ? `v${version} · ${commit}` : `v${version}`;

/** Offers `data` as a file download; throws when the browser refuses. */
export const downloadFile = (name: string, data: string) => {
  const url = URL.createObjectURL(
    new Blob([data], { type: 'application/json' })
  );
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

const control = (item: MenuControl) => {
  switch (item.kind) {
    case 'button': {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = item.label;
      element.disabled = item.disabled;
      element.addEventListener('click', item.action);
      return element;
    }
    case 'toggle': {
      const label = document.createElement('label');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = item.checked;
      toggle.addEventListener('change', () => item.change(toggle.checked));
      label.append(toggle, ` ${item.label}`);
      return label;
    }
    case 'select': {
      const label = document.createElement('label');
      const select = document.createElement('select');
      for (const [value, text] of item.choices) {
        select.append(new Option(text, value, false, item.value === value));
      }
      select.addEventListener('change', () => item.change(select.value));
      label.append(`${item.label} `, select);
      return label;
    }
    case 'list': {
      const list = document.createElement('ul');
      list.className = 'menu-list';
      list.setAttribute('aria-label', item.label);
      for (const text of item.items) {
        const entry = document.createElement('li');
        entry.textContent = text;
        list.append(entry);
      }
      return list;
    }
    case 'choice': {
      const group = document.createElement('fieldset');
      group.className = 'menu-choice';
      const legend = document.createElement('legend');
      legend.textContent = item.label;
      group.append(legend);
      for (const choice of item.choices) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `menu-${item.label}`;
        radio.value = choice.value;
        radio.checked = choice.value === item.value;
        radio.addEventListener('change', () => item.change(choice.value));
        const text = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = choice.text;
        const description = document.createElement('small');
        description.textContent = choice.description;
        text.append(name, description);
        label.append(radio, text);
        group.append(label);
      }
      return group;
    }
  }
};

/** A bar button that changes the amount being entered, not the game. */
const amountButton = (
  label: string,
  action: AmountAction,
  className: string,
  disabled = false
) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.disabled = disabled;
  element.dataset.action = JSON.stringify(action);
  return element;
};

/** The stepper and chips, or the keypad while an exact amount is typed. */
const amountPanel = (entry: AmountEntry) => {
  const shown = document.createElement('output');
  shown.className = 'amount wide';
  if (entry.typing !== undefined) {
    shown.textContent = `£${entry.typing}_`;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit =>
      amountButton(
        String(digit),
        { digit, type: 'digit' },
        'number',
        !digitAllowed(entry, digit)
      )
    );
    return [
      shown,
      ...digits,
      amountButton('Del', { type: 'back' }, 'number', !entry.typing),
      amountButton('Done', { type: 'done' }, 'number')
    ];
  }
  shown.className = 'amount';
  shown.textContent = formatAmount(entry.value);
  return [
    amountButton(
      '-',
      { delta: -amountStep, type: 'step' },
      'number',
      entry.value <= entry.min
    ),
    shown,
    amountButton(
      '+',
      { delta: amountStep, type: 'step' },
      'number',
      entry.value >= entry.max
    ),
    ...amountChips.map(chip =>
      amountButton(
        `+£${chip / 1000}k`,
        { delta: chip, type: 'step' },
        'number chip',
        entry.value >= entry.max
      )
    ),
    amountButton(
      'Max',
      { type: 'max' },
      'number chip',
      entry.value >= entry.max
    ),
    amountButton('Exact amount', { type: 'keypad' }, 'blue wide')
  ];
};

/**
 * The button an event came from, if it lies within the element handling the
 * event: the context bar, the Home screen or a Modern screen's pane.
 */
const paneButton = (event: Event) => {
  const pane = event.currentTarget as Node | null;
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  return button && pane?.contains(button) ? button : undefined;
};

const pounds = (value: number) => `£${value.toLocaleString('en-GB')}`;

/** A club's name in its name colour, on paper unless it is the screen's white. */
const clubLabel = (club: ClubName) => {
  const name = document.createElement('span');
  name.className = 'club-name';
  name.textContent = club.name;
  name.style.color = `var(--normal-${club.ink})`;
  if (club.paper !== 7) {
    name.style.background = `var(--normal-${club.paper})`;
  }
  return name;
};

/** Modern mode's Home screen: summary, next fixture and the menu's choices. */
const paintHome = (pane: HTMLElement, home: Home) => {
  const summary = document.createElement('section');
  summary.className = 'home-summary';
  summary.setAttribute('aria-label', 'Club summary');
  const heading = document.createElement('h2');
  heading.append(clubLabel(home.club));
  const manager = document.createElement('p');
  manager.textContent = `Manager: ${home.manager}`;
  const division = document.createElement('p');
  division.className = 'home-division';
  division.textContent = `Division ${home.division}`;
  const facts = document.createElement('dl');
  for (const [term, value] of [
    ['League position', home.leaguePosition ?? '—'],
    ['Cash', pounds(home.cash)],
    ['Loan', pounds(home.debt)],
    ...(home.bills ? [['Next bills', pounds(home.bills.total)] as const] : []),
    ['Morale', home.morale],
    ['Level', home.level]
  ] as const) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    row.append(dt, dd);
    facts.append(row);
  }
  summary.append(heading, manager, division, facts);

  const parts: HTMLElement[] = [summary];
  const warning = home.bills?.warning;
  if (warning) {
    const note = document.createElement('p');
    note.className = `home-warning ${warning.level}`;
    note.setAttribute('role', 'status');
    note.textContent = warning.text;
    parts.push(note);
  }
  if (home.fixture) {
    const fixture = document.createElement('section');
    fixture.className = 'home-fixture';
    fixture.setAttribute('aria-label', 'Next fixture');
    const title = document.createElement('h3');
    title.textContent = home.fixture.title;
    fixture.append(title);
    if (home.fixture.home && home.fixture.away) {
      const sides = document.createElement('p');
      sides.append(
        clubLabel(home.fixture.home),
        ' v ',
        clubLabel(home.fixture.away)
      );
      fixture.append(sides);
    }
    parts.push(fixture);
  }
  const choices = document.createElement('nav');
  choices.className = 'home-choices';
  choices.setAttribute('aria-label', 'Main menu');
  choices.append(
    ...home.choices.map(choice => {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = choice.label;
      element.className = choice.tone;
      element.disabled = !choice.enabled;
      element.dataset.id = choice.id;
      element.dataset.kind = 'choice';
      return element;
    })
  );
  parts.push(choices);
  pane.replaceChildren(...parts);
};

const cell = (className: string, text: string | number) => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = String(text);
  return element;
};

/** One pick team row: a button while the original takes its number. */
const pickRow = (row: PickTeamRow, verb: 'Add' | 'Drop' | 'Sell') => {
  const element = document.createElement(row.answer ? 'button' : 'div');
  element.className = `pick-row ${row.status}`;
  if (row.answer) {
    element.setAttribute('type', 'button');
    element.dataset.id = row.answer;
    element.dataset.kind = 'choice';
    element.setAttribute(
      'aria-label',
      `${verb} ${row.name}, number ${row.number}`
    );
  }
  element.append(
    cell('pick-tag', row.tag),
    cell('pick-name', row.name),
    cell('pick-number', row.number),
    cell('pick-skill', row.skill),
    cell('pick-energy', row.energy),
    cell('pick-value', pounds(row.value)),
    cell('pick-marker', row.marker)
  );
  return element;
};

/** The two teams' strengths in two columns, each headed by its club. */
const strengthsTable = (strengths: Strengths) => {
  const table = document.createElement('table');
  table.className = 'pick-strengths';
  table.setAttribute('aria-label', 'Team strengths');
  const head = table.createTHead().insertRow();
  head.append(document.createElement('th'));
  for (const club of [strengths.club, strengths.opponent]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.append(clubLabel(club));
    head.append(th);
  }
  const body = table.createTBody();
  for (const [name, ours, theirs] of strengths.rows) {
    const row = body.insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = name;
    row.append(th);
    row.insertCell().textContent = String(ours);
    row.insertCell().textContent = String(theirs);
  }
  return table;
};

/** A club's name, carrying its three letters for a narrow scoreboard. */
const scoreboardClub = (name: ClubName, short?: string) => {
  const label = clubLabel(name);
  if (short) {
    label.dataset.short = short;
    label.setAttribute('aria-label', name.name);
  }
  return label;
};

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
  const longest = Math.max(
    highlights.home.name.length,
    highlights.away.name.length
  );
  if (highlights.short && longest > 10) {
    board.classList.add('long-names');
  }
  board.append(
    menu,
    scoreboardClub(highlights.home, highlights.short?.[0]),
    cell('scoreboard-goals', `${highlights.score[0]}–${highlights.score[1]}`),
    scoreboardClub(highlights.away, highlights.short?.[1]),
    cell('scoreboard-clock', highlights.clock ?? '')
  );
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
  open: boolean,
  shown: boolean
) => {
  const latest = lines[0];
  if (!latest || !shown) {
    const empty = document.createElement('div');
    empty.className = 'latest-moment';
    empty.textContent = shown ? 'Kick-off' : 'Full time';
    return empty;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `latest-moment ${latest.kind}`;
  // A second tap closes the drawer it opened.
  button.dataset.id = open ? drawerIds.close : drawerIds.open;
  button.dataset.viewControl = 'latest';
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-controls', 'moments-drawer');
  button.append(
    ...tickerCells(latest),
    cell('latest-all', `☰ ${lines.length}`)
  );
  button.setAttribute('aria-label', `All moments (${lines.length})`);
  return button;
};

/** The phone's moments drawer (#145): every line so far, over the pitch. */
const momentsDrawer = (ticker: NonNullable<ModernHighlights['ticker']>) => {
  const drawer = document.createElement('section');
  drawer.className = 'moments-drawer';
  drawer.id = 'moments-drawer';
  drawer.setAttribute('aria-label', 'All moments');
  const header = document.createElement('div');
  header.className = 'moments-header';
  const title = document.createElement('h3');
  title.textContent = 'All moments';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.dataset.id = drawerIds.close;
  close.dataset.viewControl = 'close';
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
  clip: NonNullable<ModernHighlights['clip']>
) => {
  const panel = document.createElement('section');
  panel.className = 'moments-panel tabbed';
  panel.setAttribute('aria-label', 'Moments and line-ups');
  const tabs = document.createElement('div');
  tabs.className = 'panel-tabs';
  tabs.setAttribute('role', 'tablist');
  const label = (tab: HighlightsTab) =>
    tab === 'moments' ? 'Moments' : lineUps[tab].club.name;
  for (const tab of highlightsTabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-tab';
    button.id = `panel-tab-${tab}`;
    button.dataset.id = tabId(tab);
    button.dataset.viewControl = tabId(tab);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab === clip.tab));
    button.setAttribute('aria-controls', 'panel-tab-body');
    button.tabIndex = tab === clip.tab ? 0 : -1;
    if (tab !== 'moments') {
      const swatch = document.createElement('span');
      swatch.className = 'kit-swatch';
      swatch.style.background = lineUps[tab].kit;
      swatch.setAttribute('aria-hidden', 'true');
      button.append(swatch);
    }
    button.append(cell('panel-tab-name', label(tab)));
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

/**
 * The drawer control to focus after a repaint, given the one focused
 * before: the same one, or the latest line once the drawer has closed.
 */
const focusAfter = (before: string | undefined, drawer: boolean) =>
  before === 'close' && !drawer ? 'latest' : before;

const actionButton = (
  label: string,
  id: string,
  kind: string,
  enabled: boolean
) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = 'primary';
  element.disabled = !enabled;
  element.dataset.id = id;
  element.dataset.kind = kind;
  return element;
};

const icons = {
  next: '<path d="M5 5l9 7-9 7zM16 5h3v14h-3z" fill="currentColor" />',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor" />',
  rewind: '<path d="M19 5l-9 7 9 7zM5 5h3v14H5z" fill="currentColor" />'
};

/** One of the playhead's buttons, drawn as its icon and named for readers. */
const playheadButton = (
  label: string,
  icon: keyof typeof icons,
  id: string,
  enabled: boolean
) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'playhead-button';
  button.disabled = !enabled;
  button.dataset.id = id;
  button.dataset.viewControl = id;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${icons[icon]}</svg>`;
  return button;
};

/**
 * The playhead's controls (ADR 0016): rewind, play or pause, and next.
 * At full time only rewind is left, to watch the last clip again.
 */
const transport = (clip: ClipProgress, fullTime: boolean) => {
  const group = document.createElement('div');
  group.className = 'transport';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Playback');
  group.append(
    playheadButton('Rewind', 'rewind', playheadIds.rewind, true),
    clip.paused
      ? playheadButton('Play', 'play', playheadIds.play, !fullTime)
      : playheadButton('Pause', 'pause', playheadIds.play, !fullTime),
    playheadButton('Next', 'next', playheadIds.next, !fullTime)
  );
  return group;
};

/**
 * The row under the highlights: Skip all, which becomes Continue for the
 * final hold, after the latest moment's line where one is given, and under
 * clips the playhead's controls before it.
 */
const highlightsControls = (
  ticker: NonNullable<ModernHighlights['ticker']>,
  latest?: HTMLElement,
  clip?: ClipProgress
) => {
  const controls = document.createElement('div');
  controls.className = 'highlights-controls';
  if (latest) {
    controls.append(latest);
  }
  if (clip && !clip.full) {
    // At full time, or watching the last clip again on the way back to it.
    controls.append(
      transport(clip, clip.playing === undefined && ticker.fullTime)
    );
  }
  controls.append(
    ticker.fullTime
      ? actionButton('Continue', continueId, 'continue', true)
      : actionButton('Skip all', 'ticker.skip', 'skip', ticker.skip)
  );
  return controls;
};

/**
 * Modern mode's highlights screen (#45), around `pitch`, the canvas the
 * original pitch is painted on.
 */
const paintHighlights = (
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
    if (clip.drawer && !clip.full) {
      frame.append(momentsDrawer(ticker));
    }
    stage.append(frame);
    if (clip.full) {
      const overlay = tickerList(ticker);
      overlay.classList.add('full-ticker');
      stage.append(overlay);
    }
    // Under the pitch: the latest moment, then the playhead's controls and
    // Skip all, which becomes Continue once the last clip has played.
    const controls = highlightsControls(
      ticker,
      latestMoment(ticker.lines, clip.drawer, !clip.full),
      clip
    );
    const before = document.activeElement?.closest<HTMLElement>(
      '[data-view-control]'
    )?.dataset.viewControl;
    const panel = highlights.lineUps
      ? tabbedPanel(ticker, highlights.lineUps, clip)
      : momentsPanel(ticker);
    pane.replaceChildren(panel, ...parts, stage, controls);
    const focus = focusAfter(before, clip.drawer);
    if (focus) {
      pane
        .querySelector<HTMLElement>(`button[data-view-control="${focus}"]`)
        ?.focus({ preventScroll: true });
    }
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
    parts.push(
      tickerList(highlights.ticker),
      highlightsControls(highlights.ticker)
    );
  }
  pane.replaceChildren(...parts);
};

/** The player a transfer bid is for, in the ink of his category. */
const bidPlayer = (player: BidPlayer) => {
  const section = document.createElement('section');
  section.className = `bid-player category-${player.category}`;
  section.setAttribute('aria-label', 'Player for sale');
  const heading = document.createElement('h2');
  heading.append(
    cell('pick-tag', player.tag),
    cell('bid-name', player.name),
    cell('bid-number', `No.${player.number}`)
  );
  const facts = document.createElement('dl');
  for (const [term, value] of [
    ['Skill', String(player.skill)],
    ['Energy', String(player.energy)],
    ['Value', pounds(player.value)]
  ] as const) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    facts.append(row);
  }
  section.append(heading, facts);
  return section;
};

/**
 * Modern mode's message screen: the balance after a loan or repayment, or a
 * plain text message in a black bar, then Continue.
 */
const paintMessage = (pane: HTMLElement, message: ModernMessage) => {
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton('Continue', message.done.id, 'choice', message.done.enabled)
  );
  if (message.kind === 'balance') {
    pane.replaceChildren(
      moneyRows([
        ['Cash', message.cash],
        ['Loan', message.debt]
      ]),
      actions
    );
    return;
  }
  const text = document.createElement('p');
  text.className = 'message-text';
  text.textContent = message.text;
  pane.replaceChildren(text, actions);
};

/** One club's scorers on the Full-time screen, as `Smith 12′, 77′`. */
const scorerList = (
  scorers: FullTime['goals'] & {},
  side: 0 | 1,
  club: ClubName
) => {
  const list = document.createElement('ul');
  list.className = 'full-time-scorers';
  list.setAttribute('aria-label', `${club.name} scorers`);
  list.append(
    ...scorers[side].map(scorer => {
      const item = document.createElement('li');
      if (scorer.name) {
        item.append(cell('full-time-scorer', scorer.name), ' ');
      }
      item.append(cell('full-time-minutes', scorer.minutes.join(', ')));
      return item;
    })
  );
  return list;
};

/**
 * Modern mode's Full-time screen: the scoreboard at full time, the goals
 * under each club, the managed club's injuries, the gate receipts, then
 * Continue.
 */
const paintFullTime = (pane: HTMLElement, fullTime: FullTime) => {
  const title = cell('full-time-title', fullTime.title);
  const board = document.createElement('div');
  board.className = 'full-time-board';
  const longest = Math.max(
    fullTime.home.name.length,
    fullTime.away.name.length
  );
  if (fullTime.short && longest > 10) {
    board.classList.add('long-names');
  }
  board.setAttribute(
    'aria-label',
    `Full time: ${fullTime.home.name} ${fullTime.score[0]}, ${fullTime.away.name} ${fullTime.score[1]}`
  );
  board.append(
    scoreboardClub(fullTime.home, fullTime.short?.[0]),
    cell('scoreboard-goals', `${fullTime.score[0]}–${fullTime.score[1]}`),
    scoreboardClub(fullTime.away, fullTime.short?.[1]),
    cell('scoreboard-clock', fullTime.clock ?? '')
  );
  const parts: HTMLElement[] = [title, board];
  if (fullTime.goals?.some(side => side.length)) {
    const goals = document.createElement('div');
    goals.className = 'full-time-goals';
    goals.append(
      scorerList(fullTime.goals, 0, fullTime.home),
      scorerList(fullTime.goals, 1, fullTime.away)
    );
    parts.push(goals);
  }
  if (fullTime.replay) {
    parts.push(cell('full-time-replay', 'Drawn – a replay to come'));
  }
  if (fullTime.injuries?.length) {
    const injuries = document.createElement('ul');
    injuries.className = 'full-time-injuries';
    injuries.setAttribute('aria-label', 'Injured');
    injuries.append(
      ...fullTime.injuries.map(({ matches, name }) => {
        const item = document.createElement('li');
        item.append(
          cell('full-time-injury', 'Injured'),
          ` ${name}, out for ${matches} ${matches === 1 ? 'match' : 'matches'}`
        );
        return item;
      })
    );
    parts.push(injuries);
  }
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton('Continue', fullTime.done.id, 'choice', fullTime.done.enabled)
  );
  parts.push(moneyRows([['Gate receipts', fullTime.gate]]), actions);
  pane.replaceChildren(...parts);
};

/** A Continue button, the yellow primary, in its own row. */
const continueRow = (
  done: Readonly<{ enabled: boolean; id: string; label?: string }>
) => {
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton(done.label ?? 'Continue', done.id, 'choice', done.enabled)
  );
  return actions;
};

/** A signed amount of money, as `+£12,000` or `−£4,500`. */
const signedPounds = (value: number) =>
  value < 0 ? `−${pounds(-value)}` : `+${pounds(value)}`;

/**
 * Modern mode's weekly bills: each charge and their total, the weekly
 * balance, any loan taken to pay them, the grace period, then the cash and
 * the loan against the credit limit. A dismissal ends with the sacking.
 */
const paintBills = (pane: HTMLElement, bills: ModernBills) => {
  const charges = moneyRows([...bills.rows, ['Total', bills.total]]);
  charges.className = 'bills-charges';
  const balance = document.createElement('div');
  balance.className = `bills-balance ${bills.balance < 0 ? 'down' : 'up'}`;
  balance.append(
    cell('bills-balance-label', 'Weekly balance'),
    cell('bills-balance-value', signedPounds(bills.balance)),
    cell('bills-balance-note', 'Change in cash less loan since last week')
  );
  const parts: HTMLElement[] = [charges, balance];
  if (bills.borrowed !== undefined) {
    parts.push(
      cell(
        'bills-alert',
        `Loan increased by ${pounds(bills.borrowed)} to pay the bills`
      )
    );
  }
  if (bills.grace) {
    const { over, weeks } = bills.grace;
    parts.push(
      cell(
        'bills-alert',
        `${pounds(over)} over your credit limit – ${
          weeks === 1 ? 'last week' : `${weeks} weeks`
        } to clear it`
      )
    );
  }
  const standing = moneyRows([
    ['Cash', bills.cash],
    ['Loan', `${pounds(bills.debt)} of ${pounds(bills.limit)}`]
  ]);
  parts.push(standing);
  if (bills.dismissal) {
    parts.push(
      cell(
        'bills-sacked',
        `Sacked – you owe over ${pounds(bills.dismissal.limit)}, the club's credit limit`
      )
    );
  }
  parts.push(continueRow(bills.done));
  pane.replaceChildren(...parts);
};

/**
 * Modern mode's week's results: every match in the division, the managed
 * club's first and marked, then Continue.
 */
const paintWeekResults = (pane: HTMLElement, results: WeekResults) => {
  const title = document.createElement('h2');
  title.className = 'league-title';
  title.textContent = results.title;
  const list = document.createElement('ul');
  list.className = 'week-results';
  list.append(
    ...results.rows.map(row => {
      const item = document.createElement('li');
      if (row.own) {
        item.className = 'own';
      }
      item.append(
        clubLabel(row.home),
        cell('week-score', `${row.score[0]}–${row.score[1]}`),
        clubLabel(row.away)
      );
      return item;
    })
  );
  pane.replaceChildren(title, list, continueRow(results.done));
};

const zoneNames: Record<LeagueZone, readonly [key: string, outcome: string]> = {
  champions: ['Champions', 'Champions'],
  promotion: ['Promotion', 'Promoted'],
  relegation: ['Relegation', 'Relegated']
};

/** Places moved since last week: ▲2, ▼1 or a dash, with a spoken label. */
const moveCell = (move: number) => {
  const td = document.createElement('td');
  td.className = `league-move ${move > 0 ? 'up' : move < 0 ? 'down' : 'same'}`;
  td.textContent = move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–';
  td.setAttribute(
    'aria-label',
    move === 0 ? 'No change' : `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)}`
  );
  return td;
};

const formNames = { D: 'drawn', L: 'lost', W: 'won' } as const;

/** A club's latest results, oldest first, as one letter each. */
const formCell = (form: readonly FormResult[]) => {
  const td = document.createElement('td');
  td.className = 'league-form';
  td.append(...form.map(result => cell(`form-${result}`, result)));
  td.setAttribute(
    'aria-label',
    form.length
      ? form.map(result => formNames[result]).join(', ')
      : 'No results yet'
  );
  return td;
};

const signed = (value: number) =>
  value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0';

/**
 * Modern mode's league table: the division in order, each club's goals,
 * goal difference and points, the managed club's row marked and the
 * promotion and relegation places tinted. Each week a column shows the
 * places moved; at the season end the zones name their outcomes instead.
 * Under club form (#99) a last column shows each club's latest results.
 */
const paintLeagueTable = (pane: HTMLElement, table: LeagueTable) => {
  const caption = document.createElement('h2');
  caption.className = 'league-title';
  caption.textContent = table.caption;
  const element = document.createElement('table');
  element.className = 'league-table';
  const moves = table.rows.some(row => row.move !== undefined);
  const form = table.rows.some(row => row.form !== undefined);
  const head = element.createTHead().insertRow();
  for (const [label, name] of [
    ['Pos', 'Position'],
    ...(moves ? [['', 'Movement']] : []),
    ['Club', 'Club'],
    ['F', 'Goals for'],
    ['A', 'Goals against'],
    ['GD', 'Goal difference'],
    ['Pts', 'Points'],
    ...(form ? [['Form', 'Latest results']] : [])
  ] as const) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    th.setAttribute('aria-label', name);
    head.append(th);
  }
  const body = element.createTBody();
  for (const row of table.rows) {
    body.append(leagueRow(row, moves, table.final));
  }
  const parts: HTMLElement[] = [caption, element];
  const zones = [
    ...new Set(table.rows.flatMap(row => (row.zone ? [row.zone] : [])))
  ];
  if (zones.length && !table.final) {
    const key = document.createElement('ul');
    key.className = 'league-key';
    key.setAttribute('aria-label', 'Key');
    key.append(
      ...zones.map(zone => {
        const item = document.createElement('li');
        item.className = `zone-${zone}`;
        item.textContent = zoneNames[zone][0];
        return item;
      })
    );
    parts.push(key);
  }
  parts.push(continueRow(table.done));
  pane.replaceChildren(...parts);
};

const leagueRow = (row: LeagueRow, moves: boolean, final: boolean) => {
  const tr = document.createElement('tr');
  tr.className = [row.zone ? `zone-${row.zone}` : '', row.own ? 'own' : '']
    .filter(Boolean)
    .join(' ');
  if (row.own) {
    tr.setAttribute('aria-current', 'true');
  }
  const position = document.createElement('td');
  position.textContent = String(row.position);
  tr.append(position);
  if (moves) {
    tr.append(moveCell(row.move ?? 0));
  }
  const club = document.createElement('td');
  club.className = 'league-club';
  club.append(clubLabel(row.club));
  if (final && row.zone) {
    club.append(cell('league-outcome', zoneNames[row.zone][1]));
  }
  tr.append(club);
  for (const value of [
    row.for,
    row.against,
    signed(row.difference),
    row.points
  ]) {
    const td = document.createElement('td');
    td.textContent = String(value);
    tr.append(td);
  }
  if (row.form) {
    tr.append(formCell(row.form));
  }
  return tr;
};

/** Modern mode's replay notice: the round, Replay, and the replay's fixture. */
const paintCupReplay = (pane: HTMLElement, replay: CupReplay) => {
  const title = document.createElement('h2');
  title.className = 'league-title';
  title.textContent = replay.title;
  const word = cell('cup-banner replay', 'Replay');
  const sides = document.createElement('p');
  sides.className = 'cup-fixture';
  sides.append(clubLabel(replay.home), ' v ', clubLabel(replay.away));
  pane.replaceChildren(title, word, sides, continueRow(replay.done));
};

/**
 * Modern mode's cup result: through, out, or the cup won. Winning plays
 * the cup celebration on the pitch, paced by the original's timed
 * celebration, before Continue; under reduced motion it shows the lift
 * from the start.
 */
const paintCupResult = (pane: HTMLElement, result: CupResult) => {
  const { celebration } = result;
  const playing = Boolean(celebration) && !result.done.enabled;
  pane.classList.toggle('celebrating', playing);
  // The scene's canvas stays put while it plays, so painting each frame
  // doesn't rebuild the screen.
  const shown = pane.dataset.shape;
  const shape = JSON.stringify([
    result.title,
    result.headline,
    result.outcome,
    result.done,
    Boolean(celebration)
  ]);
  if (shown !== shape) {
    pane.dataset.shape = shape;
    const title = document.createElement('h2');
    title.className = 'league-title';
    title.textContent = result.title;
    const parts: HTMLElement[] = [title];
    if (celebration) {
      const canvas = document.createElement('canvas');
      canvas.className = 'cup-scene';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        'The players lift the F.A. Cup on the pitch'
      );
      parts.push(canvas, cell('cup-won', result.headline));
    } else {
      parts.push(cell(`cup-banner ${result.outcome}`, result.headline));
    }
    if (!celebration || result.done.enabled) {
      parts.push(cell('cup-tie', result.tie), continueRow(result.done));
    }
    pane.replaceChildren(...parts);
  }
  const canvas = pane.querySelector<HTMLCanvasElement>('canvas.cup-scene');
  if (celebration && canvas) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    paintClip(
      canvas.getContext('2d')!,
      celebrationFrame(
        celebration.sides,
        celebration.progress,
        celebration.clock,
        still
      ),
      { attack: celebration.sides.winners, defence: celebration.sides.losers },
      fitClipCanvas(canvas)
    );
  }
};

/**
 * Modern mode's next fixture: both clubs with where each stands, home on the left, where the managed club plays, and for a cup
 * round its draw, then Pick team.
 */
const paintFixture = (pane: HTMLElement, fixture: ModernFixture) => {
  // The top bar names the competition, so the card doesn't repeat it.
  const card = document.createElement('div');
  card.className = 'fixture-card';
  const side = ({ club, standing }: ModernFixture['home']) => {
    const element = document.createElement('div');
    element.className = 'fixture-side';
    element.append(clubLabel(club), cell('fixture-standing', standing));
    return element;
  };
  card.append(side(fixture.home), cell('fixture-v', 'v'), side(fixture.away));
  pane.replaceChildren(
    card,
    cell('fixture-venue', fixture.draw ?? fixture.venue),
    continueRow(fixture.done)
  );
};

/** Modern mode's end of the season: the league place and the cup run. */
const paintEndOfSeason = (pane: HTMLElement, end: EndOfSeason) => {
  const facts = document.createElement('dl');
  facts.className = 'season-facts';
  for (const [term, value] of [
    ['League', end.league],
    ['F.A. Cup', end.cup]
  ] as const) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    facts.append(row);
  }
  pane.replaceChildren(facts, continueRow(end.done));
};

/**
 * Modern mode's season summary: what happened to the club, the bonus and
 * the rating, then the division's other moves.
 */
const paintSeasonSummary = (pane: HTMLElement, summary: SeasonSummary) => {
  const banner = cell(`season-banner ${summary.outcome}`, summary.headline);
  const facts = moneyRows([
    ['League success bonus', summary.bonus],
    ['Managerial rating', `${summary.rating} / 100`]
  ]);
  const parts: HTMLElement[] = [
    banner,
    facts,
    cell('season-bonus-for', `Bonus ${summary.bonusFor}`)
  ];
  for (const [label, names] of [
    [
      summary.outcome === 'promoted' ? 'Also promoted' : 'Promoted',
      summary.promoted
    ],
    [
      summary.outcome === 'relegated' ? 'Also relegated' : 'Relegated',
      summary.relegated
    ]
  ] as const) {
    if (names.length) {
      const line = document.createElement('p');
      line.className = 'season-moves';
      line.append(cell('season-moves-label', label), ` ${names.join(', ')}`);
      parts.push(line);
    }
  }
  parts.push(continueRow(summary.done));
  pane.replaceChildren(...parts);
};

/**
 * Modern mode's sale offer: the player, the buyer's offer against his value,
 * then Accept, and Refuse with what turning it down may cost.
 */
const paintSaleOffer = (pane: HTMLElement, offer: SaleOffer) => {
  const line = document.createElement('p');
  line.className = 'sale-line';
  line.append(clubLabel(offer.buyer), ` offer ${pounds(offer.amount)}`);
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  const accept = actionButton(
    'Accept',
    offer.accept.id,
    'choice',
    offer.accept.enabled
  );
  const refuse = actionButton(
    'Refuse',
    offer.refuse.id,
    'choice',
    offer.refuse.enabled
  );
  refuse.className = 'red';
  actions.append(accept, refuse);
  pane.replaceChildren(
    bidPlayer(offer.player),
    line,
    cell('sale-comparison', offer.comparison),
    actions,
    cell('sale-warning', offer.warning)
  );
};

/** A choice button on a setup screen, answering as the original's key. */
const setupButton = (id: string, ...content: (Node | string)[]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'setup-choice';
  button.dataset.id = id;
  button.dataset.kind = 'choice';
  button.append(...content);
  return button;
};

/**
 * Modern mode's setup screens: the manager's name, a division's clubs to
 * choose from, the levels, the colours, and playing on after a save.
 */
const paintSetup = (pane: HTMLElement, setup: ModernSetup) => {
  switch (setup.kind) {
    case 'manager': {
      // Kept while it shows, so typing isn't lost to a repaint.
      if (pane.querySelector('form.setup-name')) {
        return;
      }
      const form = document.createElement('form');
      form.className = 'setup-name';
      form.dataset.viewControl = '';
      const label = document.createElement('label');
      label.textContent = 'Your name';
      const input = document.createElement('input');
      input.name = 'name';
      input.maxLength = setup.maxLength;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'words');
      label.append(input);
      const next = document.createElement('button');
      next.type = 'submit';
      next.className = 'primary';
      next.textContent = 'Next';
      const actions = document.createElement('div');
      actions.className = 'pick-actions';
      actions.append(next);
      form.append(label, actions);
      pane.replaceChildren(form);
      input.focus();
      return;
    }
    case 'clubs': {
      const heading = document.createElement('h2');
      heading.className = 'league-title';
      heading.textContent = `Division ${setup.division}`;
      const list = document.createElement('div');
      list.className = 'setup-clubs';
      list.append(
        ...setup.clubs.map(({ club, id }) => setupButton(id, clubLabel(club)))
      );
      const next = setupButton(setup.next.id, setup.next.label);
      next.classList.add('setup-next');
      pane.replaceChildren(heading, cell('setup-note', setup.note), list, next);
      return;
    }
    case 'level': {
      const list = document.createElement('div');
      list.className = 'setup-levels';
      list.append(
        ...setup.levels.map(level => {
          const name = cell('setup-level-name', level.name);
          name.style.color = `var(--bright-${level.ink})`;
          name.style.background = `var(--bright-${level.paper})`;
          const button = setupButton(
            level.id,
            cell('setup-level-number', level.number),
            name
          );
          if (level.current) {
            button.append(cell('setup-current', 'current'));
            button.setAttribute('aria-current', 'true');
          }
          return button;
        })
      );
      pane.replaceChildren(list);
      return;
    }
    case 'colours':
    case 'play-on': {
      const list = document.createElement('div');
      list.className = 'setup-pair';
      list.append(
        ...setup.choices.map(choice => setupButton(choice.id, choice.label))
      );
      pane.replaceChildren(
        cell(
          'setup-question',
          setup.kind === 'colours'
            ? 'Your team colours'
            : 'Do you want to play some more?'
        ),
        list
      );
      return;
    }
  }
};

/** The colours a club's name may take, by ink. */
const inkNames = ['Black', 'Blue', 'Red', 'Magenta', 'Green'];

/**
 * Modern mode's name editing: its questions, a page of clubs or players
 * to choose from, and renaming one, a club's colour picked from swatches.
 */
const paintNames = (pane: HTMLElement, names: ModernNames) => {
  if (names.kind === 'question') {
    const pair = document.createElement('div');
    pair.className = 'setup-pair';
    pair.append(
      setupButton(names.yes.id, names.yes.label),
      setupButton(names.no.id, names.no.label)
    );
    pane.dataset.shape = '';
    pane.replaceChildren(cell('setup-question', names.text), pair);
    return;
  }
  if (names.kind === 'list') {
    const heading = document.createElement('h2');
    heading.className = 'league-title';
    heading.textContent = names.title;
    const list = document.createElement('div');
    list.className = 'setup-clubs';
    list.append(
      ...names.entries.map(entry =>
        setupButton(entry.id, entry.club ? clubLabel(entry.club) : entry.name)
      )
    );
    const next = setupButton(names.next.id, names.next.label);
    next.classList.add('setup-next');
    pane.dataset.shape = '';
    pane.replaceChildren(heading, list, next);
    return;
  }
  // Kept while the same name is being changed, so typing isn't lost; a
  // refused name brings its message.
  const shape = JSON.stringify([names.target, names.current, names.error]);
  if (pane.dataset.shape === shape) {
    return;
  }
  pane.dataset.shape = shape;
  const form = document.createElement('form');
  form.className = 'setup-name names-rename';
  form.dataset.viewControl = '';
  const now = document.createElement('p');
  now.className = 'names-current';
  now.append('Renaming ', clubLabel(names.current));
  const input = document.createElement('input');
  input.name = 'name';
  input.value = names.current.name;
  input.autocomplete = 'off';
  input.spellcheck = false;
  const label = document.createElement('label');
  label.append('New name', input);
  const parts: HTMLElement[] = [now];
  if (names.error) {
    parts.push(cell('names-error', names.error));
  }
  parts.push(label);
  const fit = (colour: string) => {
    input.maxLength =
      colour === 'plain' ? names.maxLength.plain : names.maxLength.coloured;
  };
  fit(String(names.colour));
  if (names.colours.length) {
    const swatches = document.createElement('fieldset');
    swatches.className = 'names-colours';
    const legend = document.createElement('legend');
    legend.textContent = 'Colour';
    swatches.append(legend);
    for (const colour of [...names.colours.map(String), 'plain']) {
      const option = document.createElement('label');
      option.className = 'names-swatch';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'ink';
      radio.value = colour;
      radio.checked = colour === String(names.colour);
      radio.addEventListener('change', () => fit(colour));
      const chip = cell('names-chip', '');
      chip.style.background =
        colour === 'plain' ? 'transparent' : `var(--normal-${colour})`;
      option.append(
        radio,
        chip,
        colour === 'plain' ? 'Plain' : inkNames[Number(colour)]!
      );
      swatches.append(option);
    }
    parts.push(swatches);
  }
  if (names.loses) {
    parts.push(
      cell(
        'names-note',
        'Renaming replaces its background with the colour chosen.'
      )
    );
  }
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'primary';
  submit.textContent = 'Rename';
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(submit);
  parts.push(actions);
  form.append(...parts);
  pane.replaceChildren(form);
  input.focus();
};

/** Labelled money rows, as on the status screen. */
const moneyRows = (rows: readonly (readonly [string, number | string])[]) => {
  const facts = document.createElement('dl');
  for (const [term, value] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = typeof value === 'number' ? pounds(value) : value;
    row.append(dt, dd);
    facts.append(row);
  }
  return facts;
};

/**
 * What a loan or repayment does to the weekly bills (#97): the interest
 * before and after it, the next bills with it, and their warning.
 */
const loanCost = (cost: LoanCost) => {
  const { after, before } = cost.interest;
  const change = after - before;
  const interest =
    change === 0
      ? pounds(before)
      : `${pounds(before)} → ${pounds(after)} (${change > 0 ? '+' : '−'}${pounds(Math.abs(change))})`;
  const rows = moneyRows([
    ['Weekly interest', interest],
    ...(cost.bills === undefined ? [] : [['Next bills', cost.bills] as const])
  ]);
  rows.className = 'loan-cost';
  rows.setAttribute('aria-live', 'polite');
  const parts: HTMLElement[] = [rows];
  if (cost.warning) {
    const note = document.createElement('p');
    note.className = `home-warning ${cost.warning.level}`;
    note.textContent = cost.warning.text;
    parts.push(note);
  }
  return parts;
};

/**
 * Modern mode's amount prompts, a loan or repayment (#134) or a transfer bid
 * (#135): the player for sale on a bid, then the stepper and chips, or
 * the keypad while an exact amount is typed; then the balance after it.
 */
const paintAmount = (pane: HTMLElement, amountPrompt: ModernAmount) => {
  const facts = moneyRows([
    ['Cash', amountPrompt.cash],
    ['Loan', amountPrompt.debt]
  ]);
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  const { entry } = amountPrompt;
  const shown = document.createElement('output');
  shown.className = 'amount-value';
  shown.setAttribute('aria-live', 'polite');
  const limit = cell('amount-limit', `Up to ${pounds(entry.max)}`);
  const parts: HTMLElement[] = amountPrompt.player
    ? [bidPlayer(amountPrompt.player), facts]
    : [facts];
  if (entry.typing === undefined) {
    shown.textContent = formatAmount(entry.value);
    const stepper = document.createElement('div');
    stepper.className = 'amount-stepper';
    const minus = amountButton(
      '−',
      { delta: -amountStep, type: 'step' },
      'red',
      entry.value <= entry.min
    );
    minus.setAttribute('aria-label', `Less by ${pounds(amountStep)}`);
    const plus = amountButton(
      '+',
      { delta: amountStep, type: 'step' },
      'red',
      entry.value >= entry.max
    );
    plus.setAttribute('aria-label', `More by ${pounds(amountStep)}`);
    stepper.append(minus, shown, plus);
    const chips = document.createElement('div');
    chips.className = 'amount-chips';
    chips.append(
      ...amountChips.map(chip =>
        amountButton(
          `+£${chip / 1000}k`,
          { delta: chip, type: 'step' },
          'chip',
          entry.value >= entry.max
        )
      ),
      amountButton('Max', { type: 'max' }, 'chip', entry.value >= entry.max)
    );
    parts.push(
      stepper,
      limit,
      ...(amountPrompt.cost ? loanCost(amountPrompt.cost) : []),
      chips,
      amountButton('Enter exact amount', { type: 'keypad' }, 'amount-exact')
    );
  } else {
    shown.textContent = `£${entry.typing}_`;
    const keypad = document.createElement('div');
    keypad.className = 'amount-keypad';
    keypad.append(
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit =>
        amountButton(
          String(digit),
          { digit, type: 'digit' },
          'chip',
          !digitAllowed(entry, digit)
        )
      ),
      amountButton('Del', { type: 'back' }, 'chip', !entry.typing),
      amountButton(
        '0',
        { digit: 0, type: 'digit' },
        'chip',
        !digitAllowed(entry, 0)
      ),
      amountButton('Done', { type: 'done' }, 'chip')
    );
    parts.push(
      shown,
      limit,
      ...(amountPrompt.cost ? loanCost(amountPrompt.cost) : []),
      keypad
    );
  }
  const submit = actionButton(
    amountPrompt.submit.label,
    amountPrompt.submit.id,
    'choice',
    amountPrompt.submit.enabled
  );
  const cancel = actionButton(
    amountPrompt.cancel.label,
    amountPrompt.cancel.id,
    'choice',
    amountPrompt.cancel.enabled
  );
  cancel.className = 'red';
  actions.append(submit, cancel);
  parts.push(actions);
  pane.replaceChildren(...parts);
};

/** Modern mode's status screen (#133): the original's facts as rows. */
const paintStatus = (pane: HTMLElement, status: ModernStatus) => {
  const heading = document.createElement('h2');
  heading.className = 'status-club';
  heading.append(clubLabel(status.club));
  const lines = (...texts: string[]) =>
    texts.map(text => {
      const line = document.createElement('p');
      line.textContent = text;
      return line;
    });
  const rating = document.createElement('p');
  rating.className = 'status-rating';
  rating.append(
    'Managerial rating',
    cell('status-rating-value', `${status.rating} / 100`)
  );
  const facts = document.createElement('dl');
  const level = cell('status-level', status.level.name);
  level.style.color = `var(--bright-${status.level.ink})`;
  level.style.background = `var(--normal-${status.level.paper})`;
  const rows: (readonly [string, string | HTMLElement])[] = [
    ['Level', level],
    ['Seasons', String(status.seasons)],
    ['Cash', pounds(status.cash)],
    ['Loan', pounds(status.debt)],
    ['Morale', String(status.morale)],
    ['League position', String(status.leaguePosition ?? '—')],
    ['League match', String(status.leagueMatches)]
  ];
  for (const [term, value] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.append(value);
    row.append(dt, dd);
    facts.append(row);
  }
  const parts: HTMLElement[] = [
    heading,
    ...lines(`Manager: ${status.manager}`, `Colours: ${status.colours}`),
    rating,
    facts
  ];
  if (status.done) {
    const actions = document.createElement('div');
    actions.className = 'pick-actions';
    actions.append(
      actionButton(
        'Done – continue',
        status.done.id,
        'choice',
        status.done.enabled
      )
    );
    parts.push(actions);
  }
  pane.replaceChildren(...parts);
};

/** Modern mode's pick team screen (#44). */
const paintPickTeam = (pane: HTMLElement, pick: PickTeam) => {
  const parts: HTMLElement[] = [];
  if (pick.strengths) {
    parts.push(strengthsTable(pick.strengths));
  }
  const picked = document.createElement('p');
  picked.className = 'pick-count';
  picked.textContent = `Players picked = ${pick.picked}`;
  const legend = document.createElement('p');
  legend.className = 'pick-legend';
  legend.append(
    cell('pick-marker picked', 'p'),
    pick.weeksOut ? ' = picked, ' : ' = picked to play, ',
    cell('pick-marker injured', pick.weeksOut ? `1-${pick.weeksOut}` : 'i'),
    pick.weeksOut ? ' = weeks injured' : ' = injured'
  );
  parts.push(picked, legend);
  if (pick.hint) {
    const hint = document.createElement('p');
    hint.className = 'pick-hint';
    hint.textContent = pick.hint;
    parts.push(hint);
  }
  const verb =
    pick.prompt === 'squad' ? 'Sell' : pick.picked <= 11 ? 'Add' : 'Drop';
  for (const group of pick.groups) {
    const section = document.createElement('section');
    section.className = `pick-group category-${group.category}`;
    const title = document.createElement('h3');
    title.textContent = group.title;
    const header = document.createElement('div');
    header.className = 'pick-row pick-header';
    header.setAttribute('aria-hidden', 'true');
    header.append(
      cell('pick-tag', ''),
      cell('pick-name', 'Name'),
      cell('pick-number', 'No.'),
      cell('pick-skill', 'Skill'),
      cell('pick-energy', 'Energy'),
      cell('pick-value', 'Value'),
      cell('pick-marker', '')
    );
    const rows = group.players.length
      ? group.players.map(row => pickRow(row, verb))
      : [cell('pick-none', 'None')];
    section.append(title, header, ...rows);
    parts.push(section);
  }
  if (pick.actions.length) {
    const actions = document.createElement('div');
    actions.className = 'pick-actions';
    actions.append(
      ...pick.actions.map(action => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = action.label;
        element.className = action.tone;
        element.disabled = !action.enabled;
        element.dataset.id = action.id;
        element.dataset.kind = 'choice';
        return element;
      })
    );
    parts.push(actions);
  }
  pane.replaceChildren(...parts);
};

/** Builds the page inside `app` and returns the app's view of it. */
export const createBrowserDom = (app: HTMLElement) => {
  app.innerHTML = `
  <h1 class="sr-only">Football Manager</h1>
  <header class="top-bar">
    <button id="menu-button" class="menu-button" type="button" aria-haspopup="dialog" aria-label="Game menu" title="Game menu">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" /></svg>
    </button>
    <p id="screen-title" class="screen-title"></p>
  </header>
  <div id="home" class="home" hidden></div>
  <section class="machine" aria-label="ZX Spectrum Football Manager">
    <canvas id="screen" width="256" height="176" aria-hidden="true"></canvas><canvas id="pitch" width="256" height="176" aria-hidden="true" hidden></canvas>
    <form id="entry" autocomplete="off">
      <canvas id="entry-display" width="256" height="16" aria-hidden="true"></canvas>
      <label for="command" id="prompt"></label><input id="command" name="command" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="256" />
    </form>
  </section>
  <section id="pick-team" class="pick-team" aria-label="Pick team" hidden></section>
  <section id="highlights" class="modern-highlights" aria-label="Match highlights" hidden></section>
  <section id="status" class="modern-status" aria-label="Club status" hidden></section>
  <section id="amount-prompt" class="modern-amount" aria-label="Amount" hidden></section>
  <section id="week-results" class="modern-amount modern-week-results" aria-label="Results" hidden></section>
  <section id="league-table" class="modern-amount modern-league-table" aria-label="League table" hidden></section>
  <section id="bills" class="modern-amount modern-bills" aria-label="Weekly bills" hidden></section>
  <section id="cup-result" class="modern-amount modern-cup" aria-label="Cup result" hidden></section>
  <section id="cup-replay" class="modern-amount modern-cup" aria-label="Cup replay" hidden></section>
  <section id="next-fixture" class="modern-amount modern-fixture" aria-label="Next fixture" hidden></section>
  <section id="end-of-season" class="modern-amount modern-season" aria-label="End of season" hidden></section>
  <section id="season-summary" class="modern-amount modern-season" aria-label="Season summary" hidden></section>
  <section id="sale-offer" class="modern-amount modern-sale" aria-label="Sale offer" hidden></section>
  <section id="setup" class="modern-amount modern-setup" aria-label="New game" hidden></section>
  <section id="names" class="modern-amount modern-setup modern-names" aria-label="Change names" hidden></section>
  <section id="full-time" class="modern-amount modern-full-time" aria-label="Full time" hidden></section>
  <section id="message" class="modern-amount modern-message" aria-label="Message" role="status" hidden></section>
  <div id="context-bar" class="context-bar" aria-label="Answers" hidden></div>
  <pre id="transcript" class="sr-only" aria-live="polite" aria-atomic="true"></pre>
  <p id="ticker-live" class="sr-only" aria-live="polite"></p>
  <p class="build-note">Play league and cup matches, edit names and manage your club.<br />Play resumes where you left it. Press Esc or the menu button to save, load or start again.</p>
  <p id="notice" class="notice" role="status"></p>
  <p class="version">${versionLabel}</p>
  <dialog id="game-menu" class="game-menu" aria-labelledby="game-menu-title"></dialog>
  <input id="load-save" type="file" accept=".json,.fman.json" hidden />
`;
  const find = <T extends HTMLElement>(selector: string) =>
    app.querySelector<T>(selector)!;
  const screen = find<HTMLCanvasElement>('#screen');
  const screenContext = screen.getContext('2d')!;
  const entryContext =
    find<HTMLCanvasElement>('#entry-display').getContext('2d')!;
  const form = find<HTMLFormElement>('#entry');
  const input = find<HTMLInputElement>('#command');
  const prompt = find<HTMLElement>('#prompt');
  const transcript = find<HTMLElement>('#transcript');
  const tickerLive = find<HTMLElement>('#ticker-live');
  const notice = find<HTMLElement>('#notice');
  const menuButton = find<HTMLButtonElement>('#menu-button');
  const menu = find<HTMLDialogElement>('#game-menu');
  const loadInput = find<HTMLInputElement>('#load-save');
  const screenTitle = find<HTMLElement>('#screen-title');
  const pitch = find<HTMLCanvasElement>('#pitch');
  const pitchContext = pitch.getContext('2d')!;
  const machine = find<HTMLElement>('.machine');
  const bar = find<HTMLElement>('#context-bar');
  const homePane = find<HTMLElement>('#home');
  const pickPane = find<HTMLElement>('#pick-team');
  const highlightsPane = find<HTMLElement>('#highlights');
  const statusPane = find<HTMLElement>('#status');
  const amountPane = find<HTMLElement>('#amount-prompt');
  const messagePane = find<HTMLElement>('#message');
  const fullTimePane = find<HTMLElement>('#full-time');
  const weekResultsPane = find<HTMLElement>('#week-results');
  const leagueTablePane = find<HTMLElement>('#league-table');
  const billsPane = find<HTMLElement>('#bills');
  const fixturePane = find<HTMLElement>('#next-fixture');
  const salePane = find<HTMLElement>('#sale-offer');
  const setupPane = find<HTMLElement>('#setup');
  const namesPane = find<HTMLElement>('#names');
  const endOfSeasonPane = find<HTMLElement>('#end-of-season');
  const seasonSummaryPane = find<HTMLElement>('#season-summary');
  const cupResultPane = find<HTMLElement>('#cup-result');
  const cupReplayPane = find<HTMLElement>('#cup-replay');
  // Modern mode's own pitch, kept between attacks as the original's is not.
  const modernPitch = document.createElement('canvas');
  modernPitch.className = 'modern-pitch';
  modernPitch.width = 256;
  modernPitch.height = 176;
  modernPitch.setAttribute('role', 'img');
  const modernPitchContext = modernPitch.getContext('2d')!;
  // A wide window, as the stylesheet has it (#257).
  const wideWindow = matchMedia(
    '(min-width: 900px) and (min-aspect-ratio: 1) and (min-height: 501px)'
  );
  /**
   * On a wide window, the original's pitch at the largest whole multiple
   * of its 256 by 176 pixels that fits beside the strengths and under the
   * scoreboard, so its pixels stay crisp (#257). Elsewhere the stylesheet
   * sizes it.
   */
  const fitOriginalPitch = () => {
    if (!wideWindow.matches || !modernPitch.isConnected) {
      modernPitch.style.width = '';
      return;
    }
    const board =
      highlightsPane.querySelector<HTMLElement>('.strip-scoreboard')
        ?.offsetHeight ?? 40;
    const wide = innerWidth - 16 - 280 - 24;
    const high = innerHeight - 16 - board - 6;
    const times = Math.max(1, Math.floor(Math.min(wide / 256, high / 176)));
    modernPitch.style.width = `${256 * times}px`;
  };
  addEventListener('resize', fitOriginalPitch);
  let modernPitchFor: unknown;
  // The sprite highlights' pitch (#144), at the screen's resolution.
  const clipPitch = document.createElement('canvas');
  clipPitch.className = 'clip-pitch';
  clipPitch.setAttribute('role', 'img');
  clipPitch.setAttribute('aria-label', 'Pitch');
  const clipContext = clipPitch.getContext('2d')!;
  // How far the clip on show has got, with a tick at its moment.
  const clipBar = document.createElement('div');
  clipBar.className = 'clip-progress';
  clipBar.setAttribute('aria-hidden', 'true');
  let barKey = '';
  let homeKey = '';
  /**
   * Where each kind of Modern screen is painted, and the root classes the
   * page's layout keys on while it shows.
   */
  const modernPanes: {
    [K in ModernScreenKind]: Readonly<{
      classes: readonly string[];
      paint: (screen: Extract<ModernScreen, { kind: K }>) => void;
      pane: HTMLElement;
    }>;
  } = {
    amount: {
      classes: ['has-amount'],
      paint: ({ amount }) => paintAmount(amountPane, amount),
      pane: amountPane
    },
    bills: {
      classes: ['has-amount'],
      paint: ({ bills }) => paintBills(billsPane, bills),
      pane: billsPane
    },
    'cup-replay': {
      classes: ['has-amount'],
      paint: ({ cupReplay }) => paintCupReplay(cupReplayPane, cupReplay),
      pane: cupReplayPane
    },
    'cup-result': {
      classes: ['has-amount'],
      paint: ({ cupResult }) => paintCupResult(cupResultPane, cupResult),
      pane: cupResultPane
    },
    'end-of-season': {
      classes: ['has-amount'],
      paint: ({ endOfSeason }) =>
        paintEndOfSeason(endOfSeasonPane, endOfSeason),
      pane: endOfSeasonPane
    },
    fixture: {
      classes: ['has-amount'],
      paint: ({ fixture }) => paintFixture(fixturePane, fixture),
      pane: fixturePane
    },
    'full-time': {
      classes: ['has-amount'],
      paint: ({ fullTime }) => paintFullTime(fullTimePane, fullTime),
      pane: fullTimePane
    },
    highlights: {
      classes: ['at-highlights'],
      paint: ({ highlights }) =>
        paintHighlights(
          highlightsPane,
          modernPitch,
          clipPitch,
          clipBar,
          highlights
        ),
      pane: highlightsPane
    },
    'league-table': {
      classes: ['has-amount'],
      paint: ({ table }) => paintLeagueTable(leagueTablePane, table),
      pane: leagueTablePane
    },
    names: {
      classes: ['has-amount'],
      paint: ({ names }) => paintNames(namesPane, names),
      pane: namesPane
    },
    'sale-offer': {
      classes: ['has-amount'],
      paint: ({ offer }) => paintSaleOffer(salePane, offer),
      pane: salePane
    },
    'season-summary': {
      classes: ['has-amount'],
      paint: ({ summary }) => paintSeasonSummary(seasonSummaryPane, summary),
      pane: seasonSummaryPane
    },
    setup: {
      classes: ['has-amount'],
      paint: ({ setup }) => paintSetup(setupPane, setup),
      pane: setupPane
    },
    'week-results': {
      classes: ['has-amount'],
      paint: ({ weekResults }) =>
        paintWeekResults(weekResultsPane, weekResults),
      pane: weekResultsPane
    },
    // Beside the Home pane, the status shows while the menu waits.
    home: {
      classes: ['at-home', 'has-status'],
      paint: ({ status }) => paintStatus(statusPane, status),
      pane: statusPane
    },
    message: {
      classes: ['has-amount'],
      paint: ({ message }) => paintMessage(messagePane, message),
      pane: messagePane
    },
    'pick-team': {
      classes: ['at-pick-team'],
      paint: ({ pickTeam }) => paintPickTeam(pickPane, pickTeam),
      pane: pickPane
    },
    status: {
      classes: ['has-status'],
      paint: ({ status }) => paintStatus(statusPane, status),
      pane: statusPane
    }
  };
  const modernClasses = new Set(
    Object.values(modernPanes).flatMap(({ classes }) => classes)
  );
  const paintModern = <K extends ModernScreenKind>(
    screen: Extract<ModernScreen, { kind: K }>
  ) => modernPanes[screen.kind as K].paint(screen);
  let modernKey = '';

  const paintBar = (
    buttons: readonly BarButton[] | undefined,
    amount: AmountEntry | undefined
  ) => {
    bar.hidden = !buttons;
    const key = JSON.stringify([
      buttons?.map(b => [b.answer.id, b.label]),
      amount
    ]);
    if (!buttons || key === barKey) {
      return;
    }
    // A new prompt without a typed answer closes the soft keyboard.
    if (
      document.activeElement === input &&
      buttons.every(button => button.answer.kind !== 'text')
    ) {
      input.blur();
    }
    // Keep the bar's height while nothing is offered, so the page holds still.
    bar.style.minHeight = buttons.length ? '' : `${bar.offsetHeight}px`;
    barKey = key;
    bar.replaceChildren(
      ...(amount ? amountPanel(amount) : []),
      ...buttons.map(button => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = button.label;
        element.dataset.id = button.answer.id;
        element.dataset.kind = button.answer.kind;
        element.className = `${button.tone}${button.wide ? ' wide' : ''}`;
        return element;
      })
    );
  };

  /**
   * Paints the attack on Modern mode's pitch. Between attacks, where the
   * original shows its text screen, the last frame stays; before the first,
   * the empty pitch.
   */
  const paintModernPitch = (view: View & { screen: 'highlights' }) => {
    if (view.highlights.kind !== 'attacks') {
      return;
    }
    fitOriginalPitch();
    const playback = view.highlights.timeline;
    const current = playback.current;
    const fresh = modernPitchFor !== playback;
    modernPitchFor = playback;
    if (!current) {
      if (fresh) {
        paintEmptyPitch(modernPitchContext);
      }
      return;
    }
    if (current.frame.intro && !fresh) {
      return;
    }
    const { away, home } = fixtureSides(view.game, view.fixture);
    paintAttack(
      modernPitchContext,
      current.attack,
      current.index,
      playback.score,
      home,
      away,
      flashPhase(view)
    );
  };

  const paintEntry = () => {
    const rgba = new Uint8ClampedArray(256 * 16 * 4);
    rasterText(rgba, 256, 0, 0, ' '.repeat(32));
    rasterText(rgba, 256, 0, 8, ' '.repeat(32));
    [...prompt.textContent!, ...input.value].forEach((character, index) =>
      rasterText(
        rgba,
        256,
        (index % 32) * 8,
        Math.floor(index / 32) * 8,
        character
      )
    );
    entryContext.putImageData(new ImageData(rgba, 256, 16), 0, 0);
  };
  input.addEventListener('input', paintEntry);

  const dom: Dom = {
    applyOptions: (options, touch) => {
      document.documentElement.classList.toggle(
        'modern',
        options.presentation === 'modern'
      );
      document.documentElement.classList.toggle(
        'fit',
        touch && options.scale === 'auto'
      );
      if (options.scale === 'auto') {
        document.documentElement.style.removeProperty('--pixel');
      } else {
        document.documentElement.style.setProperty(
          '--pixel',
          `${options.scale}px`
        );
      }
    },
    chooseFile: () => loadInput.click(),
    closeMenu: () => menu.close(),
    get coarsePointer() {
      // Any touchscreen, not only a main touch pointer: some phones and
      // tablets report a fine main pointer (desktop mode, a trackpad).
      return (
        matchMedia('(any-pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0
      );
    },
    focusInput: () => input.focus({ preventScroll: true }),
    get hidden() {
      return document.visibilityState === 'hidden';
    },
    notice: text => {
      notice.textContent = text;
    },
    openMenu: () => menu.showModal(),
    paintClip: (shot, bar) => {
      if (clipPitch.isConnected) {
        paintShot(clipContext, shot, fitClipCanvas(clipPitch));
      }
      clipBar.hidden = !bar;
      if (bar) {
        clipBar.style.setProperty('--at', String(bar.at));
        clipBar.style.setProperty('--moment', String(bar.moment));
      }
    },
    get reducedMotion() {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    render: ({
      amount,
      bar: buttons,
      clearInput,
      display,
      focus,
      home,
      modern,
      title,
      typing,
      view
    }) => {
      paintBar(buttons, amount);
      homePane.hidden = !home;
      const key = JSON.stringify(home);
      if (home && key !== homeKey) {
        paintHome(homePane, home);
      }
      homeKey = key;
      const active = modern && modernPanes[modern.kind];
      for (const { pane } of Object.values(modernPanes)) {
        pane.hidden = pane !== active?.pane;
      }
      const shape = JSON.stringify(modern);
      if (modern && shape !== modernKey) {
        paintModern(modern);
      }
      modernKey = shape;
      for (const name of modernClasses) {
        document.documentElement.classList.toggle(
          name,
          Boolean(active?.classes.includes(name))
        );
      }
      const highlights =
        modern?.kind === 'highlights' ? modern.highlights : undefined;
      if (highlights?.pitch && view.screen === 'highlights') {
        paintModernPitch(view);
      }
      input.readOnly = !typing;
      if (!typing && document.activeElement === input) {
        input.blur();
      }
      screenTitle.textContent = title;
      screen.height = display.lines.length * 8;
      screenContext.putImageData(
        new ImageData(
          rasterizeCells(display.cells, flashPhase(view)),
          256,
          screen.height
        ),
        0,
        0
      );
      const match = view.screen === 'highlights' ? view.highlights : undefined;
      const playback = match?.kind === 'attacks' ? match.timeline : undefined;
      const ticker = match?.kind === 'moments' ? match.timeline : undefined;
      const current = playback?.current;
      const playing = Boolean(current && !current.frame.intro);
      pitch.hidden = !playing;
      screen.hidden = playing;
      screen.classList.toggle('cleared', view.screen === 'cleared');
      screen.classList.toggle('full-screen', display.lines.length === 24);
      if (view.screen === 'highlights' && playback && current) {
        const { away, home } = fixtureSides(view.game, view.fixture);
        paintAttack(
          pitchContext,
          current.attack,
          current.index,
          playback.score,
          home,
          away,
          flashPhase(view)
        );
      }
      // The ticker announces each new line alone (#108), not the whole
      // screen; Modern mode's pitch announces each attack's outcome (#45).
      transcript.setAttribute(
        'aria-live',
        ticker || highlights ? 'off' : 'polite'
      );
      // Under sprite highlights, a line is heard when its clip reaches it.
      const newest =
        view.screen === 'highlights' && ticker
          ? tickerLines(
              view.game,
              view.fixture,
              highlights?.clip
                ? ticker.moments.slice(0, highlights.clip.heard)
                : ticker.shown
            )[0]
          : undefined;
      const said = newest
        ? tickerText(newest)
        : (highlights?.pitch?.outcome ?? '');
      if (tickerLive.textContent !== said) {
        tickerLive.textContent = said;
      }
      const text = display.lines.join('\n') + '\n' + display.prompt;
      if (transcript.textContent !== text) {
        transcript.textContent = text;
      }
      form.hidden = display.paused;
      prompt.textContent = display.prompt;
      input.setAttribute('aria-label', display.label);
      input.inputMode = display.numeric ? 'numeric' : 'text';
      if (clearInput) {
        input.value = '';
      }
      paintEntry();
      if (focus) {
        input.focus({ preventScroll: true });
      }
    },
    showMenu: ({ controls, detail, status, title }) => {
      const heading = document.createElement('h2');
      heading.id = 'game-menu-title';
      heading.textContent = title;
      const detailLine = document.createElement('p');
      detailLine.className = 'menu-detail';
      detailLine.textContent = detail ?? '';
      detailLine.hidden = !detail;
      const list = document.createElement('div');
      list.className = 'menu-actions';
      list.append(...controls.map(control));
      const statusLine = document.createElement('p');
      statusLine.className = 'menu-status';
      statusLine.setAttribute('role', 'status');
      statusLine.textContent = status;
      menu.replaceChildren(heading, detailLine, list, statusLine);
      // The chosen radio, so arrow keys move from it; otherwise the first control.
      (
        list.querySelector<HTMLElement>('input[type="radio"]:checked') ??
        list.querySelector<HTMLElement>('button, input, select')
      )?.focus();
    }
  };

  /** Sends the page's events to `target`. */
  const connect = (target: App) => {
    menu.addEventListener('cancel', event => {
      if (target.menuCancel()) {
        event.preventDefault();
      }
    });
    menu.addEventListener('close', target.menuClosed);
    menuButton.addEventListener('click', target.openMenu);
    highlightsPane.addEventListener('click', event => {
      if ((event.target as Element).closest('.scoreboard-menu')) {
        target.openMenu();
      }
    });
    loadInput.addEventListener('change', async () => {
      const file = loadInput.files?.[0];
      if (!file) {
        return;
      }
      try {
        await target.importSave(() => file.text());
      } finally {
        loadInput.value = '';
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      target.submit(input.value);
    });
    document.addEventListener('keydown', event => {
      // In the tabs beside the clips (#256), the arrows move between tabs
      // and never reach the playhead.
      const tab = document.activeElement?.closest<HTMLElement>('[role=tab]');
      if (
        tab &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        const tabs = [
          ...(tab.parentElement?.querySelectorAll<HTMLElement>('[role=tab]') ??
            [])
        ];
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next =
          tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
        if (next?.dataset.id) {
          target.tap(next.dataset.id, false);
          highlightsPane
            .querySelector<HTMLElement>(
              `[data-view-control="${next.dataset.id}"]`
            )
            ?.focus({ preventScroll: true });
        }
        return;
      }
      if (
        target.keyDown({
          code: event.code,
          inputFocused: document.activeElement === input,
          key: event.key,
          modified: event.metaKey || event.ctrlKey || event.altKey,
          repeat: event.repeat,
          viewControlFocused: !!document.activeElement?.closest(
            '[data-view-control]'
          )
        })
      ) {
        event.preventDefault();
      }
    });
    input.addEventListener('input', event =>
      target.typed(
        'inputType' in event &&
          typeof event.inputType === 'string' &&
          event.inputType.startsWith('insert')
      )
    );
    document.addEventListener('pointerdown', target.pointerDown);
    // A touch may yet become a scroll, so a finger's tap waits for the
    // click the browser sends only when the touch didn't scroll.
    let touched = false;
    const pressed = (event: PointerEvent) => {
      touched = event.pointerType === 'touch';
      const button = paneButton(event);
      if (
        touched ||
        !button?.dataset.id ||
        button.disabled ||
        button.dataset.kind === 'text'
      ) {
        return;
      }
      // Submit on the way down, as a key does; keep focus off the button.
      event.preventDefault();
      target.tap(button.dataset.id!);
    };
    /** A click: from the keyboard, or a finger's tap that didn't scroll. */
    const clicked = (button: HTMLButtonElement, event: MouseEvent) => {
      if (event.detail === 0) {
        // Activated from the keyboard, whose own key is already down.
        target.tap(button.dataset.id!, false);
      } else if (
        touched &&
        !button.disabled &&
        button.dataset.kind !== 'text'
      ) {
        target.tap(button.dataset.id!, 'brief');
      }
    };
    // The context bar, the Home screen and every Modern screen take taps
    // on their buttons; registering a Modern screen is all it needs.
    const inputPanes = new Set([
      bar,
      homePane,
      ...Object.values(modernPanes).map(({ pane }) => pane)
    ]);
    for (const pane of inputPanes) {
      pane.addEventListener('pointerdown', pressed);
      pane.addEventListener('click', event => {
        const button = paneButton(event);
        if (!button) {
          return;
        }
        if (button.dataset.action) {
          target.amount(JSON.parse(button.dataset.action) as AmountAction);
        } else if (pane === bar && button.dataset.kind === 'text') {
          // Typed answers use the soft keyboard, which opens only on a tap.
          input.focus({ preventScroll: true });
        } else if (button.dataset.id) {
          clicked(button, event);
        }
      });
    }
    machine.addEventListener('pointerdown', target.pressScreen);
    modernPitch.addEventListener('pointerdown', target.pressScreen);
    // A tap on the clips' pitch does nothing: the playhead's controls take
    // its place (ADR 0016).
    // The manager's name, typed on the setup screen, is the answer.
    setupPane.addEventListener('submit', event => {
      event.preventDefault();
      const input =
        setupPane.querySelector<HTMLInputElement>('input[name=name]');
      if (input) {
        target.submit(input.value);
      }
    });
    // A new name, typed on the rename screen, after a club's INK prefix
    // for the colour picked: the answer the original takes.
    namesPane.addEventListener('submit', event => {
      event.preventDefault();
      const form = namesPane.querySelector('form');
      const input = form?.querySelector<HTMLInputElement>('input[name=name]');
      if (!form || !input) {
        return;
      }
      const ink = form.querySelector<HTMLInputElement>(
        'input[name=ink]:checked'
      );
      const prefix =
        ink && ink.value !== 'plain'
          ? String.fromCharCode(16, Number(ink.value))
          : '';
      target.submit(prefix + input.value);
    });
    // During the celebration, a finger shortens its pauses, as on the pitch.
    cupResultPane.addEventListener('pointerdown', () => {
      if (cupResultPane.classList.contains('celebrating')) {
        target.pressScreen();
      }
    });
    addEventListener('pointerup', target.pointerUp);
    addEventListener('pointercancel', target.pointerUp);
    document.addEventListener('keyup', target.keyUp);
    addEventListener('pagehide', target.pageHide);
    addEventListener('blur', target.blurred);
    document.addEventListener('visibilitychange', target.visibilityChanged);
  };
  return { connect, dom };
};
