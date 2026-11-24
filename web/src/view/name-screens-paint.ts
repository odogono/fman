import type { ModernNames } from './name-screens';
import { cell, clubLabel, setupButton } from './paint-parts';

/**
 * Modern mode's name editing: its questions, a page of clubs or players
 * to choose from, and renaming one, a club's colour picked from swatches.
 */
export const paintNames = (pane: HTMLElement, names: ModernNames) => {
  if (names.kind === 'question') {
    const pair = document.createElement('div');
    pair.className = 'setup-pair';
    pair.append(
      setupButton(names.yes.id, names.yes.label),
      setupButton(names.no.id, names.no.label)
    );
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
    pane.replaceChildren(heading, list, next);
    return;
  }
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
    const choices = [
      ...names.colours.map(({ ink, name }) => ({ colour: String(ink), name })),
      { colour: 'plain', name: 'Plain' }
    ];
    for (const { colour, name } of choices) {
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
      option.append(radio, chip, name);
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
