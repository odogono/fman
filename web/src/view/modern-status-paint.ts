import type { ModernStatus } from './modern-status';
import { actionButton, cell, clubLabel, pounds } from './paint-parts';

/** Modern mode's status screen (#133): the original's facts as rows. */
export const paintStatus = (pane: HTMLElement, status: ModernStatus) => {
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
