import type {
  FormResult,
  LeagueRow,
  LeagueTable,
  LeagueZone,
  WeekResults
} from './league-screens';
import { cell, clubLabel, continueRow } from './paint-parts';

/**
 * Modern mode's week's results: every match in the division, the managed
 * club's first and marked, then Continue.
 */
export const paintWeekResults = (pane: HTMLElement, results: WeekResults) => {
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
export const paintLeagueTable = (pane: HTMLElement, table: LeagueTable) => {
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
