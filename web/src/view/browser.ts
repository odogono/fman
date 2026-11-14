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
import type { BarButton } from './context-bar';
import { rasterText, rasterizeCells } from './glyphs';
import type { ClubName, Home } from './home';
import type { BidPlayer, ModernAmount } from './modern-amount';
import {
  drawerIds,
  type ModernHighlights,
  type ModernTickerLine
} from './modern-highlights';
import type { ModernMessage } from './modern-message';
import type { ModernStatus } from './modern-status';
import type { PickTeam, PickTeamRow, Strengths } from './pick-team';
import { paintAttack, paintEmptyPitch } from './pitch';
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

/** The context bar or Home screen button an event came from, if any. */
const barButton = (event: Event) =>
  (event.target as Element).closest<HTMLButtonElement>(
    '#context-bar button, #home button, #pick-team button, #highlights button, #status button, #amount-prompt button, #message button'
  );

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
const pickRow = (row: PickTeamRow, adding: boolean) => {
  const element = document.createElement(row.answer ? 'button' : 'div');
  element.className = `pick-row ${row.status}`;
  if (row.answer) {
    element.setAttribute('type', 'button');
    element.dataset.id = row.answer;
    element.dataset.kind = 'choice';
    element.setAttribute(
      'aria-label',
      `${adding ? 'Add' : 'Drop'} ${row.name}, number ${row.number}`
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

/** Modern mode's highlights scoreboard: the competition, then the score. */
const scoreboard = (highlights: ModernHighlights) => {
  const board = document.createElement('section');
  board.className = 'scoreboard';
  board.setAttribute('aria-label', 'Score');
  const title = document.createElement('h3');
  title.textContent = highlights.title;
  const score = document.createElement('p');
  score.append(
    clubLabel(highlights.home),
    cell('scoreboard-goals', `${highlights.score[0]} v ${highlights.score[1]}`),
    clubLabel(highlights.away)
  );
  board.append(title, score);
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
    cell('latest-all', `All moments (${lines.length}) ›`)
  );
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

/**
 * Modern mode's highlights screen (#45), around `pitch`, the canvas the
 * original pitch is painted on.
 */
const paintHighlights = (
  pane: HTMLElement,
  pitch: HTMLCanvasElement,
  clipPitch: HTMLCanvasElement,
  highlights: ModernHighlights
) => {
  const parts: HTMLElement[] = [scoreboard(highlights)];
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
    if (clip.drawer && !clip.full) {
      frame.append(momentsDrawer(ticker));
    }
    stage.append(frame);
    if (clip.full) {
      const overlay = tickerList(ticker);
      overlay.classList.add('full-ticker');
      stage.append(overlay);
    }
    const actions = document.createElement('div');
    actions.className = 'pick-actions';
    actions.append(actionButton('Skip', 'ticker.skip', 'skip', ticker.skip));
    const before = document.activeElement?.closest<HTMLElement>(
      '[data-view-control]'
    )?.dataset.viewControl;
    pane.replaceChildren(
      momentsPanel(ticker),
      ...parts,
      stage,
      latestMoment(ticker.lines, clip.drawer, !clip.full),
      actions
    );
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
    const actions = document.createElement('div');
    actions.className = 'pick-actions';
    actions.append(
      actionButton('Skip', 'ticker.skip', 'skip', highlights.ticker.skip)
    );
    parts.push(tickerList(highlights.ticker), actions);
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

/** Labelled money rows, as on the status screen. */
const moneyRows = (rows: readonly (readonly [string, number])[]) => {
  const facts = document.createElement('dl');
  for (const [term, value] of rows) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = pounds(value);
    row.append(dt, dd);
    facts.append(row);
  }
  return facts;
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
    parts.push(shown, limit, keypad);
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
    cell('pick-marker injured', pick.weeksOut ? '1-3' : 'i'),
    pick.weeksOut ? ' = weeks injured' : ' = injured'
  );
  parts.push(picked, legend);
  if (pick.hint) {
    const hint = document.createElement('p');
    hint.className = 'pick-hint';
    hint.textContent = pick.hint;
    parts.push(hint);
  }
  const adding = pick.picked <= 11;
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
      ? group.players.map(row => pickRow(row, adding))
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
  let amountKey_ = '';
  const messagePane = find<HTMLElement>('#message');
  let messageKey = '';
  let statusKey = '';
  // Modern mode's own pitch, kept between attacks as the original's is not.
  const modernPitch = document.createElement('canvas');
  modernPitch.className = 'modern-pitch';
  modernPitch.width = 256;
  modernPitch.height = 176;
  modernPitch.setAttribute('role', 'img');
  const modernPitchContext = modernPitch.getContext('2d')!;
  let modernPitchFor: unknown;
  // The sprite highlights' pitch (#144), at the screen's resolution.
  const clipPitch = document.createElement('canvas');
  clipPitch.className = 'clip-pitch';
  clipPitch.setAttribute('role', 'img');
  clipPitch.setAttribute('aria-label', 'Pitch');
  const clipContext = clipPitch.getContext('2d')!;
  let highlightsKey = '';
  let barKey = '';
  let homeKey = '';
  let pickKey = '';

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
    if (!('playback' in view)) {
      return;
    }
    const { playback } = view;
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
    paintClip: ({ frame, sides }) => {
      if (clipPitch.isConnected) {
        paintClip(clipContext, frame, sides, fitClipCanvas(clipPitch));
      }
    },
    get reducedMotion() {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    render: ({
      amount,
      amountPrompt,
      atHome,
      bar: buttons,
      clearInput,
      display,
      focus,
      highlights,
      home,
      message,
      pickTeam,
      status,
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
      pickPane.hidden = !pickTeam;
      const pick = JSON.stringify(pickTeam);
      if (pickTeam && pick !== pickKey) {
        paintPickTeam(pickPane, pickTeam);
      }
      pickKey = pick;
      document.documentElement.classList.toggle('at-home', atHome);
      document.documentElement.classList.toggle('at-pick-team', !!pickTeam);
      amountPane.hidden = !amountPrompt;
      const amountShape = JSON.stringify(amountPrompt);
      if (amountPrompt && amountShape !== amountKey_) {
        paintAmount(amountPane, amountPrompt);
      }
      amountKey_ = amountShape;
      document.documentElement.classList.toggle(
        'has-amount',
        !!amountPrompt || !!message
      );
      messagePane.hidden = !message;
      const messageShape = JSON.stringify(message);
      if (message && messageShape !== messageKey) {
        paintMessage(messagePane, message);
      }
      messageKey = messageShape;
      statusPane.hidden = !status;
      const statusShape = JSON.stringify(status);
      if (status && statusShape !== statusKey) {
        paintStatus(statusPane, status);
      }
      statusKey = statusShape;
      highlightsPane.hidden = !highlights;
      const highlightsShape = JSON.stringify(highlights);
      if (highlights && highlightsShape !== highlightsKey) {
        paintHighlights(highlightsPane, modernPitch, clipPitch, highlights);
      }
      highlightsKey = highlightsShape;
      document.documentElement.classList.toggle('at-highlights', !!highlights);
      document.documentElement.classList.toggle('has-status', !!status);
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
      const current =
        view.screen === 'highlights' && 'playback' in view
          ? view.playback.current
          : undefined;
      const playing = Boolean(current && !current.frame.intro);
      pitch.hidden = !playing;
      screen.hidden = playing;
      screen.classList.toggle('cleared', view.screen === 'cleared');
      screen.classList.toggle('full-screen', display.lines.length === 24);
      if (view.screen === 'highlights' && 'playback' in view && current) {
        const { away, home } = fixtureSides(view.game, view.fixture);
        paintAttack(
          pitchContext,
          current.attack,
          current.index,
          view.playback.score,
          home,
          away,
          flashPhase(view)
        );
      }
      // The ticker announces each new line alone (#108), not the whole
      // screen; Modern mode's pitch announces each attack's outcome (#45).
      const ticker = view.screen === 'highlights' && 'ticker' in view;
      transcript.setAttribute(
        'aria-live',
        ticker || highlights ? 'off' : 'polite'
      );
      // Under sprite highlights, a line is heard when its clip reaches it.
      const newest =
        view.screen === 'highlights' && 'ticker' in view
          ? tickerLines(
              view.game,
              view.fixture,
              highlights?.clip
                ? view.ticker.moments.slice(0, highlights.clip.shown)
                : view.ticker.shown
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
    const pressed = (event: Event) => {
      const button = barButton(event);
      if (
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
    bar.addEventListener('pointerdown', pressed);
    amountPane.addEventListener('click', event => {
      const action = barButton(event)?.dataset.action;
      if (action) {
        target.amount(JSON.parse(action) as AmountAction);
      }
    });
    for (const pane of [
      homePane,
      pickPane,
      highlightsPane,
      statusPane,
      amountPane,
      messagePane
    ]) {
      pane.addEventListener('pointerdown', pressed);
      pane.addEventListener('click', event => {
        const button = barButton(event);
        // Activated from the keyboard, whose own key is already down.
        if (button?.dataset.id && event.detail === 0) {
          target.tap(button.dataset.id, false);
        }
      });
    }
    bar.addEventListener('click', event => {
      const button = barButton(event);
      if (!button) {
        return;
      }
      if (button.dataset.action) {
        target.amount(JSON.parse(button.dataset.action) as AmountAction);
      } else if (button.dataset.kind === 'text') {
        // Typed answers use the soft keyboard, which opens only on a tap.
        input.focus({ preventScroll: true });
      } else if (event.detail === 0) {
        // Activated from the keyboard, whose own key is already down.
        target.tap(button.dataset.id!, false);
      }
    });
    machine.addEventListener('pointerdown', target.pressScreen);
    modernPitch.addEventListener('pointerdown', target.pressScreen);
    clipPitch.addEventListener('pointerdown', target.pressScreen);
    addEventListener('pointerup', target.pointerUp);
    addEventListener('pointercancel', target.pointerUp);
    document.addEventListener('keyup', target.keyUp);
    addEventListener('pagehide', target.pageHide);
    addEventListener('blur', target.blurred);
    document.addEventListener('visibilitychange', target.visibilityChanged);
  };
  return { connect, dom };
};
