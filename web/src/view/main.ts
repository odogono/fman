import { createJournal, openSave, type Journal } from '../sim/journal';
import { saveLimit } from '../sim/save';
import type { View } from '../sim/session';
import { createBeeper } from './beeper';
import { cupVictoryTones } from './cup-victory';
import { createFrameSampler } from './frame-sampler';
import { paintAttack } from './pitch';
import { makeScreen } from './screen';
import {
  readAutosave,
  readOptions,
  readSlot,
  slotCount,
  writeAutosave,
  writeOptions,
  writeSlot
} from './storage';

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('Missing application root');
}
app.innerHTML = `
  <h1 class="sr-only">Football Manager</h1>
  <section class="machine" aria-label="ZX Spectrum Football Manager">
    <div id="screen" aria-hidden="true"></div><canvas id="pitch" width="256" height="176" aria-hidden="true" hidden></canvas>
    <form id="entry" autocomplete="off">
      <label for="command" id="prompt"></label><input id="command" name="command" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="256" />
    </form>
  </section>
  <pre id="transcript" class="sr-only" aria-live="polite" aria-atomic="true"></pre>
  <button id="menu-button" class="menu-button" type="button" aria-haspopup="dialog">Menu</button>
  <p class="build-note">Play league and cup matches, edit names and manage your club.<br />Play resumes where you left it. Press Esc or Menu to save, load or start again.</p>
  <p id="notice" class="notice" role="status"></p>
  <dialog id="game-menu" class="game-menu" aria-labelledby="game-menu-title"></dialog>
  <input id="load-save" type="file" accept=".json,.fman.json" hidden />
`;
const screen = document.querySelector<HTMLElement>('#screen')!;
const form = document.querySelector<HTMLFormElement>('#entry')!;
const input = document.querySelector<HTMLInputElement>('#command')!;
const prompt = document.querySelector<HTMLElement>('#prompt')!;
const transcript = document.querySelector<HTMLElement>('#transcript')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
const menuButton = document.querySelector<HTMLButtonElement>('#menu-button')!;
const menu = document.querySelector<HTMLDialogElement>('#game-menu')!;
const loadInput = document.querySelector<HTMLInputElement>('#load-save')!;
const canvas = document.querySelector<HTMLCanvasElement>('#pitch')!;
const context = canvas.getContext('2d')!;
const beeper = createBeeper();
let audioKey = '';

let journal: Journal;
let storageWorks = true;
{
  const saved = readAutosave();
  try {
    journal = saved ? openSave(saved) : createJournal();
  } catch {
    journal = createJournal();
    notice.textContent =
      'Could not resume the previous session; a new game has started.';
  }
}
let options = readOptions();
let lastPersist = 0;
let sampleFrames = createFrameSampler(performance.now());
const persist = () => {
  lastPersist = performance.now();
  storageWorks = writeAutosave(journal.snapshot());
};
const applyOptions = () => {
  beeper.muted = !options.sound;
  if (options.scale === 'auto') {
    document.documentElement.style.removeProperty('--pixel');
  } else {
    document.documentElement.style.setProperty('--pixel', `${options.scale}px`);
  }
};
applyOptions();

/** Changes whenever the tick must redraw without a change of screen. */
const displayKey = (view: View) =>
  view.screen === 'highlights'
    ? view.playback.key
    : (view.screen === 'cup-celebration' || view.screen === 'cup-result') &&
        view.celebration !== undefined
      ? `${view.celebration}:${Math.floor(view.frames / 16) % 2}`
      : '';

const render = (clearInput = true) => {
  const view = journal.session.view;
  const display = makeScreen(view);
  const fragment = document.createDocumentFragment();
  for (const cell of display.cells) {
    const span = document.createElement('span');
    span.textContent = cell.text;
    const palette = cell.bright ? 'bright' : 'normal';
    span.style.color = `var(--${palette}-${cell.inverse ? cell.paper : cell.ink})`;
    span.style.backgroundColor = `var(--${palette}-${cell.inverse ? cell.ink : cell.paper})`;
    fragment.append(span);
  }
  const current =
    view.screen === 'highlights' ? view.playback.current : undefined;
  if (view.screen === 'cup-celebration' && audioKey !== 'cup-victory') {
    beeper.play(cupVictoryTones);
    audioKey = 'cup-victory';
  }
  const playing = Boolean(current);
  canvas.hidden = !playing;
  screen.hidden = playing;
  screen.classList.toggle('cleared', view.screen === 'cleared');
  screen.classList.toggle('full-screen', display.lines.length === 24);
  if (view.screen === 'cleared') {
    notice.textContent = 'Game cleared. Open the menu to start a new game.';
  }
  if (view.screen === 'names' && view.nameEditor.phase === 'fault') {
    notice.textContent =
      'Name editing stopped. Open the menu to start a new game.';
  }
  if (view.screen === 'highlights' && current) {
    const { fixture, game, playback } = view;
    paintAttack(
      context,
      current.attack,
      current.index,
      playback.score,
      game.clubs[(fixture.home ? game.club : fixture.opponent) - 1]!,
      game.clubs[(fixture.home ? fixture.opponent : game.club) - 1]!
    );
    if (audioKey !== playback.key) {
      beeper.play(current.frame.tones);
      audioKey = playback.key;
    }
  }
  screen.replaceChildren(fragment);
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
  if (!display.paused && !menu.open) {
    input.focus({ preventScroll: true });
  }
};

type MenuView = 'main' | 'save' | 'load' | 'options' | 'new-game';
let menuView: MenuView = 'main';
let menuStatus = '';
let pendingSlot = 0;

const button = (label: string, action: () => void, disabled = false) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', action);
  return element;
};
const describe = () => {
  const { game, screen: current } = journal.session.view;
  if (game) {
    const club = game.clubs[game.club - 1]?.name.trim() ?? '';
    return `${game.manager}, ${club}, season ${game.seasons + 1}`;
  }
  return current === 'cleared' ? 'Cleared program' : 'New game setup';
};
const replaceJournal = (next: Journal, message: string) => {
  journal = next;
  audioKey = '';
  persist();
  notice.textContent = message;
  menu.close();
};
const showMenu = (view: MenuView, status = '') => {
  menuView = view;
  menuStatus = status;
  const heading = document.createElement('h2');
  heading.id = 'game-menu-title';
  const list = document.createElement('div');
  list.className = 'menu-actions';
  switch (view) {
    case 'main':
      heading.textContent = 'Game menu';
      list.append(
        button('Resume', () => menu.close()),
        button('Save', () => showMenu('save'), !storageWorks),
        button('Load', () => showMenu('load')),
        button('New game', () => showMenu('new-game')),
        button('Export save file', exportSave),
        button('Import save file', () => loadInput.click()),
        button('Options', () => showMenu('options'))
      );
      if (!storageWorks) {
        menuStatus ||=
          'This browser is not storing progress. Export a save file to keep it.';
      }
      break;
    case 'save':
    case 'load':
      heading.textContent = view === 'save' ? 'Save game' : 'Load game';
      for (let slot = 1; slot <= slotCount; slot++) {
        const entry = readSlot(slot);
        const label = entry
          ? `${slot}. ${entry.label} (${new Date(entry.savedAt).toLocaleString()})`
          : `${slot}. Empty`;
        list.append(
          button(
            pendingSlot === slot ? `Overwrite ${label}?` : label,
            () => (view === 'save' ? saveTo(slot) : loadFrom(slot)),
            view === 'load' && !entry
          )
        );
      }
      list.append(button('Back', () => showMenu('main')));
      break;
    case 'new-game':
      heading.textContent = 'Start a new game?';
      menuStatus = 'Progress not saved to a slot will be lost.';
      list.append(
        button('Start new game', () =>
          replaceJournal(createJournal(), 'New game started.')
        ),
        button('Back', () => showMenu('main'))
      );
      break;
    case 'options': {
      heading.textContent = 'Options';
      const sound = document.createElement('label');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = options.sound;
      toggle.addEventListener('change', () => {
        options = { ...options, sound: toggle.checked };
        writeOptions(options);
        applyOptions();
      });
      sound.append(toggle, ' Sound');
      const scale = document.createElement('label');
      const select = document.createElement('select');
      for (const [value, text] of [
        ['auto', 'Fit window'],
        ['1', '1×'],
        ['2', '2×'],
        ['3', '3×']
      ] as const) {
        select.append(
          new Option(text, value, false, String(options.scale) === value)
        );
      }
      select.addEventListener('change', () => {
        options = {
          ...options,
          scale:
            select.value === 'auto'
              ? 'auto'
              : (Number(select.value) as 1 | 2 | 3)
        };
        writeOptions(options);
        applyOptions();
      });
      scale.append('Display size ', select);
      list.append(
        sound,
        scale,
        button('Back', () => showMenu('main'))
      );
      break;
    }
  }
  const statusLine = document.createElement('p');
  statusLine.className = 'menu-status';
  statusLine.setAttribute('role', 'status');
  statusLine.textContent = menuStatus;
  menu.replaceChildren(heading, list, statusLine);
  list.querySelector<HTMLElement>('button, input, select')?.focus();
};
const saveTo = (slot: number) => {
  if (readSlot(slot) && pendingSlot !== slot) {
    pendingSlot = slot;
    showMenu('save');
    return;
  }
  pendingSlot = 0;
  const saved = writeSlot(slot, {
    data: journal.snapshot(),
    label: describe(),
    savedAt: new Date().toISOString()
  });
  showMenu(
    'save',
    saved ? `Saved to slot ${slot}.` : 'Could not save to this browser.'
  );
};
const loadFrom = (slot: number) => {
  const entry = readSlot(slot);
  try {
    replaceJournal(openSave(entry!.data), `Loaded slot ${slot}.`);
  } catch {
    showMenu(
      'load',
      'Could not load this saved game. The current game is unchanged.'
    );
  }
};
const exportSave = () => {
  let url: string | undefined;
  try {
    url = URL.createObjectURL(
      new Blob([journal.snapshot()], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'football.fman.json';
    document.body.append(link);
    link.click();
    link.remove();
    menuStatus = 'Save file download requested.';
  } catch {
    menuStatus = 'Could not download the save file.';
  } finally {
    if (url) {
      const downloadUrl = url;
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  }
  showMenu('main', menuStatus);
};
const openMenu = () => {
  if (menu.open) {
    return;
  }
  pendingSlot = 0;
  showMenu('main');
  menu.showModal();
};
menu.addEventListener('cancel', event => {
  if (menuView !== 'main') {
    event.preventDefault();
    pendingSlot = 0;
    showMenu('main');
  }
});
menu.addEventListener('close', () => {
  // Play was frozen while the menu was open; time outside it is not simulated.
  sampleFrames = createFrameSampler(performance.now());
  render();
});
menuButton.addEventListener('click', openMenu);

loadInput.addEventListener('change', async () => {
  const file = loadInput.files?.[0];
  if (!file) {
    return;
  }
  try {
    if (file.size > saveLimit) {
      throw new RangeError('Save file is too large');
    }
    replaceJournal(openSave(await file.text()), 'Save file loaded.');
  } catch {
    showMenu(
      'main',
      'Could not load this save file. The current game is unchanged.'
    );
  } finally {
    loadInput.value = '';
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  beeper.unlock();
  if (menu.open) {
    return;
  }
  const effect = journal.submit(input.value);
  persist();
  notice.textContent = '';
  if (effect?.type === 'copy') {
    render();
    window.print();
    input.focus({ preventScroll: true });
    return;
  }
  if (effect?.type === 'save') {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(
        new Blob([effect.data], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'football.fman.json';
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      journal.saved();
      persist();
      notice.textContent = 'Web save download requested.';
    } catch {
      notice.textContent = 'Could not download the web save. Try keep again.';
    } finally {
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }
  if (effect?.type === 'unavailable') {
    notice.textContent = `${effect.feature} is not available in this build.`;
  }
  render();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (!menu.open) {
      event.preventDefault();
      openMenu();
    }
    return;
  }
  if (menu.open) {
    return;
  }
  if (
    journal.session.view.paused &&
    !event.repeat &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    journal.skipPause();
    persist();
    render();
  }
});

const tick = (now: number) => {
  if (menu.open) {
    requestAnimationFrame(tick);
    return;
  }
  const session = journal.session;
  const elapsed = sampleFrames(now);
  const before = session.view;
  journal.advance(elapsed);
  const after = session.view;
  if (before.screen !== after.screen) {
    persist();
  } else if (elapsed > 0 && now - lastPersist >= 1000) {
    persist();
  }
  if (
    before.screen !== after.screen ||
    displayKey(before) !== displayKey(after)
  ) {
    render(before.screen !== after.screen);
  }
  requestAnimationFrame(tick);
};
addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    persist();
  }
});
render();
requestAnimationFrame(tick);
