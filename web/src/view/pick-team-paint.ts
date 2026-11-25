import { cell, pounds, strengthsTable } from './paint-parts';
import type { PickTeam, PickTeamGroup, PickTeamRow } from './pick-team';

/**
 * The event an arranged pick team sends when a player is dropped on a
 * line (#121): its detail is the offered answer, submitted as a tap.
 */
export const pickAnswerEvent = 'pick-answer';

/** The row's cells; out of position (#121), his line and the skill he counts. */
const rowCells = (row: PickTeamRow) => {
  const name = cell('pick-name', row.name);
  if (row.playsIn) {
    name.append(cell('pick-plays', `→${row.playsIn.line}`));
  }
  return [
    cell('pick-tag', row.tag),
    name,
    cell('pick-number', row.number),
    cell(
      'pick-skill',
      row.playsIn ? `${row.playsIn.counts}(${row.skill})` : row.skill
    ),
    cell('pick-energy', row.energy),
    cell('pick-value', pounds(row.value)),
    cell('pick-marker', row.marker)
  ];
};

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
  element.append(...rowCells(row));
  return element;
};

const header = () => {
  const element = document.createElement('div');
  element.className = 'pick-row pick-header';
  element.setAttribute('aria-hidden', 'true');
  element.append(
    cell('pick-tag', ''),
    cell('pick-name', 'Name'),
    cell('pick-number', 'No.'),
    cell('pick-skill', 'Skill'),
    cell('pick-energy', 'Energy'),
    cell('pick-value', 'Value'),
    cell('pick-marker', '')
  );
  return element;
};

const answerButton = (
  id: string,
  label: string,
  className: string,
  enabled = true
) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.disabled = !enabled;
  element.dataset.id = id;
  element.dataset.kind = 'choice';
  return element;
};

/** The pick team each pane last showed, and the player chosen on it. */
const arranged = new WeakMap<
  HTMLElement,
  { chosen?: number; pick: PickTeam }
>();

/** Keeps a finger's drag from scrolling the page. */
const blockScroll = (event: TouchEvent) => event.preventDefault();

/** The answer that drops a row's player on a group, if one is offered. */
const answerOn = (row: PickTeamRow, group: PickTeamGroup) =>
  group.line === 'reserves'
    ? row.status === 'picked'
      ? row.answer
      : undefined
    : row.placings?.find(p => p.line === group.line)?.answer;

const countsOn = (row: PickTeamRow, group: PickTeamGroup) =>
  row.placings?.find(p => p.line === group.line)?.counts;

/**
 * Lets a row be dragged to a group (#121). A mouse drags at once; a finger
 * holds first, so a swipe still scrolls the list. A release on a group
 * that takes him sends his answer there.
 */
const draggable = (
  pane: HTMLElement,
  element: HTMLElement,
  row: PickTeamRow,
  groups: readonly PickTeamGroup[]
) => {
  element.addEventListener('pointerdown', down => {
    // While a player is chosen the headings take him, so nobody drags.
    if (down.button !== 0 || arranged.get(pane)?.chosen !== undefined) {
      return;
    }
    const touch = down.pointerType !== 'mouse';
    const startX = down.clientX;
    const startY = down.clientY;
    let held = !touch;
    let ghost: HTMLElement | undefined;
    let over: HTMLElement | undefined;
    const zones = [...pane.querySelectorAll<HTMLElement>('[data-line]')].filter(
      zone => {
        const group = groups.find(g => g.line === zone.dataset.line);
        return group && answerOn(row, group);
      }
    );
    const start = (x: number, y: number) => {
      ghost = element.cloneNode(true) as HTMLElement;
      ghost.classList.add('pick-ghost');
      ghost.style.width = `${element.getBoundingClientRect().width}px`;
      document.body.append(ghost);
      element.classList.add('pick-lifted');
      document.addEventListener('touchmove', blockScroll, { passive: false });
      for (const zone of zones) {
        zone.classList.add('pick-zone');
        const group = groups.find(g => g.line === zone.dataset.line)!;
        const counts = countsOn(row, group);
        zone
          .querySelector('h3')
          ?.append(
            cell(
              'pick-counts',
              counts === undefined ? 'drop' : `counts ${counts}`
            )
          );
      }
      move(x, y);
    };
    const move = (x: number, y: number) => {
      ghost!.style.transform = `translate(${x - 24}px, ${y - 22}px)`;
      const found = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-line]');
      const zone = found && zones.includes(found) ? found : undefined;
      if (zone !== over) {
        over?.classList.remove('pick-over');
        over = zone;
        over?.classList.add('pick-over');
      }
    };
    const timer = touch
      ? setTimeout(() => {
          held = true;
          start(startX, startY);
        }, 250)
      : undefined;
    const end = () => {
      clearTimeout(timer);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onCancel);
      document.removeEventListener('touchmove', blockScroll);
      if (!ghost) {
        return false;
      }
      ghost.remove();
      element.classList.remove('pick-lifted');
      for (const zone of zones) {
        zone.classList.remove('pick-zone', 'pick-over');
        zone.querySelector('.pick-counts')?.remove();
      }
      // The click that follows a drag doesn't choose the row.
      element.addEventListener('click', e => e.stopImmediatePropagation(), {
        capture: true,
        once: true
      });
      return true;
    };
    const onMove = (event: PointerEvent) => {
      if (ghost) {
        move(event.clientX, event.clientY);
      } else if (
        Math.hypot(event.clientX - startX, event.clientY - startY) > 6
      ) {
        if (held) {
          start(event.clientX, event.clientY);
        } else {
          // A finger that moves before the hold is scrolling.
          end();
        }
      }
    };
    const onUp = () => {
      const target = over;
      if (!end() || !target) {
        return;
      }
      const group = groups.find(g => g.line === target.dataset.line)!;
      const answer = answerOn(row, group);
      if (answer) {
        pane.dispatchEvent(
          new CustomEvent(pickAnswerEvent, { bubbles: true, detail: answer })
        );
      }
    };
    const onCancel = () => {
      end();
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onCancel);
  });
};

/**
 * The selection prompt under natural positions (#121): players grouped by
 * where they play. A player is dragged to a line or the reserves, or
 * chosen with a tap, after which each line's heading takes him.
 */
const arrangedGroups = (pane: HTMLElement, pick: PickTeam) => {
  const chosenId = arranged.get(pane)?.chosen;
  const rows = pick.groups.flatMap(g => g.players);
  const chosen = rows.find(r => r.number === chosenId);
  const choose = (number?: number) => {
    arranged.set(pane, { ...(number ? { chosen: number } : {}), pick });
    paintPickTeam(pane, pick, true);
  };
  const sections = pick.groups.map(group => {
    const section = document.createElement('section');
    section.className = `pick-group category-${group.category}`;
    section.dataset.line = group.line!;
    const answer = chosen && answerOn(chosen, group);
    const counts = chosen && countsOn(chosen, group);
    const title = document.createElement('h3');
    title.textContent = group.title;
    section.append(
      answer
        ? answerButton(
            answer,
            group.line === 'reserves'
              ? `Reserves – drop ${chosen.name} here`
              : `${group.title} – put ${chosen.name} here (counts ${counts})`,
            'pick-target'
          )
        : title
    );
    const rowElements = group.players.map(row => {
      const movable = Boolean(row.placings || row.answer);
      const element = document.createElement(movable ? 'button' : 'div');
      element.className = `pick-row ${row.status}`;
      element.append(...rowCells(row));
      if (movable) {
        element.setAttribute('type', 'button');
        element.setAttribute('aria-pressed', String(row.number === chosenId));
        element.setAttribute('aria-label', `Choose ${row.name}`);
        element.addEventListener('click', () =>
          choose(row.number === chosenId ? undefined : row.number)
        );
        draggable(pane, element, row, pick.groups);
      }
      return element;
    });
    section.append(
      ...(rowElements.length
        ? rowElements
        : [
            cell(
              'pick-none',
              group.line === 'G' ? 'Nobody: defence loses 3' : 'None'
            )
          ])
    );
    return section;
  });
  const parts: HTMLElement[] = [header(), ...sections];
  if (chosen) {
    const sheet = document.createElement('div');
    sheet.className = 'pick-actions pick-sheet';
    const add = chosen.status !== 'picked' && chosen.answer;
    sheet.append(
      cell('pick-hint', `Tap a heading to move ${chosen.name}, or:`),
      ...(add
        ? [answerButton(chosen.answer!, `Add ${chosen.name}`, 'red')]
        : []),
      Object.assign(document.createElement('button'), {
        className: 'pick-cancel',
        onclick: () => choose(),
        textContent: 'Cancel',
        type: 'button'
      })
    );
    parts.push(sheet);
  }
  return parts;
};

/** Modern mode's pick team screen (#44). */
export const paintPickTeam = (
  pane: HTMLElement,
  pick: PickTeam,
  keepChoice = false
) => {
  if (!keepChoice) {
    arranged.set(pane, { pick });
  }
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
  if (pick.arranging) {
    parts.push(...arrangedGroups(pane, pick));
  } else {
    for (const group of pick.groups) {
      const section = document.createElement('section');
      section.className = `pick-group category-${group.category}`;
      const title = document.createElement('h3');
      title.textContent = group.title;
      const rows = group.players.length
        ? group.players.map(pickRow)
        : [cell('pick-none', 'None')];
      section.append(title, header(), ...rows);
      parts.push(section);
    }
  }
  if (pick.actions.length && !arranged.get(pane)?.chosen) {
    const actions = document.createElement('div');
    actions.className = 'pick-actions';
    actions.append(
      ...pick.actions.map(action => {
        const element = answerButton(
          action.id,
          action.label,
          action.tone,
          action.enabled
        );
        return element;
      })
    );
    parts.push(actions);
  }
  pane.replaceChildren(...parts);
};
