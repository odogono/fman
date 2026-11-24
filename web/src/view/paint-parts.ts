import {
  amountChips,
  amountStep,
  digitAllowed,
  formatAmount,
  type AmountAction,
  type AmountEntry
} from './amount-entry';
import type { ClubName } from './home';
import type { BidPlayer } from './modern-amount';
import type { Strengths } from './pick-team';

/** A bar button that changes the amount being entered, not the game. */
export const amountButton = (
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
export const amountPanel = (entry: AmountEntry) => {
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

export const pounds = (value: number) => `£${value.toLocaleString('en-GB')}`;

/** A club's name in its name colour, on paper unless it is the screen's white. */
export const clubLabel = (club: ClubName) => {
  const name = document.createElement('span');
  name.className = 'club-name';
  name.textContent = club.name;
  name.style.color = `var(--normal-${club.ink})`;
  if (club.paper !== 7) {
    name.style.background = `var(--normal-${club.paper})`;
  }
  return name;
};

export const cell = (className: string, text: string | number) => {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = String(text);
  return element;
};

/** The two teams' strengths in two columns, each headed by its club. */
export const strengthsTable = (strengths: Strengths) => {
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
 * Both clubs, the score and the clock, appended to `board`. Names too
 * long for a phone's board give way to their three letters.
 */
export const appendScoreboard = (
  board: HTMLElement,
  shown: Readonly<{
    away: ClubName;
    clock?: string;
    home: ClubName;
    score: readonly number[];
    short?: readonly [string, string];
  }>
) => {
  const longest = Math.max(shown.home.name.length, shown.away.name.length);
  if (shown.short && longest > 10) {
    board.classList.add('long-names');
  }
  board.append(
    scoreboardClub(shown.home, shown.short?.[0]),
    cell('scoreboard-goals', `${shown.score[0]}–${shown.score[1]}`),
    scoreboardClub(shown.away, shown.short?.[1]),
    cell('scoreboard-clock', shown.clock ?? '')
  );
};

export const actionButton = (
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

/** The player a transfer bid is for, in the ink of his category. */
export const bidPlayer = (player: BidPlayer) => {
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

/** A Continue button, the yellow primary, in its own row. */
export const continueRow = (
  done: Readonly<{ enabled: boolean; id: string; label?: string }>
) => {
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton(done.label ?? 'Continue', done.id, 'choice', done.enabled)
  );
  return actions;
};

/** A choice button on a setup screen, answering as the original's key. */
export const setupButton = (id: string, ...content: (Node | string)[]) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'setup-choice';
  button.dataset.id = id;
  button.dataset.kind = 'choice';
  button.append(...content);
  return button;
};

/** Labelled money rows, as on the status screen. */
export const moneyRows = (
  rows: readonly (readonly [string, number | string])[]
) => {
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
