import { cell, pounds, strengthsTable } from './paint-parts';
import type { PickTeam, PickTeamRow } from './pick-team';

/** One pick team row: a button while the original takes its number. */
const pickRow = (row: PickTeamRow) => {
  const element = document.createElement(row.answer ? 'button' : 'div');
  element.className = `pick-row ${row.status}`;
  if (row.answer) {
    element.setAttribute('type', 'button');
    element.dataset.id = row.answer;
    element.dataset.kind = 'choice';
    element.setAttribute('aria-label', row.label ?? row.name);
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

/** Modern mode's pick team screen (#44). */
export const paintPickTeam = (pane: HTMLElement, pick: PickTeam) => {
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
      ? group.players.map(pickRow)
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
