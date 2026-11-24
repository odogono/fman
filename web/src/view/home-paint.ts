import type { Home } from './home';
import { clubLabel, pounds } from './paint-parts';

/** Modern mode's Home screen: summary, next fixture and the menu's choices. */
export const paintHome = (pane: HTMLElement, home: Home) => {
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
