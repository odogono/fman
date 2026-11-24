import { cell, clubLabel, setupButton } from './paint-parts';
import type { ModernSetup } from './setup-screens';

/**
 * Modern mode's setup screens: the manager's name, a division's clubs to
 * choose from, the levels, the colours, and playing on after a save.
 */
export const paintSetup = (pane: HTMLElement, setup: ModernSetup) => {
  switch (setup.kind) {
    case 'manager': {
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
