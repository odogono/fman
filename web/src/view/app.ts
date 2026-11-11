import type { SoundEvent } from '../sim/beeper';
import { createJournal, openSave, type Journal } from '../sim/journal';
import type { Effect, View } from '../sim/session';
import { answersFor, tapAnswer } from './answers';
import { barFor, type BarButton } from './context-bar';
import { createFrameSampler } from './frame-sampler';
import { makeScreen } from './screen';
import { slotCount, type AppStorage, type Options } from './storage';

export type Display = ReturnType<typeof makeScreen>;

/** One control in the game menu, as the page shows it. */
export type MenuControl =
  | { action: () => void; disabled: boolean; kind: 'button'; label: string }
  | {
      change: (checked: boolean) => void;
      checked: boolean;
      kind: 'toggle';
      label: string;
    }
  | {
      change: (value: string) => void;
      choices: readonly (readonly [value: string, text: string])[];
      kind: 'select';
      label: string;
      value: string;
    };
export type Menu = {
  controls: readonly MenuControl[];
  status: string;
  title: string;
};

/** The page: it paints what the app gives it and reports what the player does. */
export type Dom = {
  /** `fit` scales the screen to the page width, for the context bar. */
  applyOptions: (options: Options, fit: boolean) => void;
  /** Opens the file picker; a chosen file arrives through `importSave`. */
  chooseFile: () => void;
  closeMenu: () => void;
  /** The page's main pointer is coarse, as on a phone or tablet. */
  readonly coarsePointer: boolean;
  focusInput: () => void;
  readonly hidden: boolean;
  notice: (text: string) => void;
  openMenu: () => void;
  render: (screen: {
    /** The context bar's buttons, or `undefined` when the bar is hidden. */
    bar: readonly BarButton[] | undefined;
    clearInput: boolean;
    display: Display;
    focus: boolean;
    view: View;
  }) => void;
  showMenu: (menu: Menu) => void;
};

export type Beeper = {
  click: () => void;
  muted: boolean;
  reset: () => void;
  restart: () => void;
  sync: (events: readonly SoundEvent[], nowT: number) => void;
  unlock: () => Promise<void> | undefined;
};

export type Adapters = {
  beeper: Beeper;
  clock: {
    /** Milliseconds on the page's monotonic timeline. */
    now: () => number;
    /** The current date as an ISO string, for slot timestamps. */
    today: () => string;
  };
  dom: Dom;
  /** Offers `data` as a file download; throws when the browser refuses. */
  download: (name: string, data: string) => void;
  print: () => void;
  storage: AppStorage;
};

export type KeyDown = {
  code: string;
  /** The command line has focus. */
  inputFocused: boolean;
  key: string;
  modified: boolean;
  repeat: boolean;
};

const saveFileName = 'football.fman.json';
const editingKeys = [
  'Enter',
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End'
];

type MenuView = 'main' | 'save' | 'load' | 'options' | 'new-game';

const button = (
  label: string,
  action: () => void,
  disabled = false
): MenuControl => ({ action, disabled, kind: 'button', label });

/**
 * The web app around one journal: autosave, the game menu and its save
 * slots, save files, options, sound sync and the player's input.
 */
export const createApp = ({
  beeper,
  clock,
  dom,
  download,
  print,
  storage
}: Adapters) => {
  let journal: Journal;
  let storageWorks = true;
  {
    const saved = storage.readAutosave();
    try {
      journal = saved ? openSave(saved) : createJournal();
    } catch {
      journal = createJournal();
      dom.notice(
        'Could not resume the previous session; a new game has started.'
      );
    }
  }
  let options = storage.readOptions();
  let lastPersist = 0;
  let sampleFrames = createFrameSampler(clock.now());
  let menuOpen = false;
  let menuView: MenuView = 'main';
  let pendingSlot = 0;
  /** A finger is holding a key down: Enter after a tap, or a pause keypress. */
  let touchHeld = false;
  /** The frame at which a soft keyboard's submit pressed Enter. */
  let softEnterAt: number | undefined;

  const barShown = () =>
    options.touch === 'on' || (options.touch === 'auto' && dom.coarsePointer);
  const persist = () => {
    lastPersist = clock.now();
    storageWorks = storage.writeAutosave(journal.snapshot());
  };
  const applyOptions = () => {
    beeper.muted = !options.sound;
    dom.applyOptions(options, barShown());
  };
  const setOptions = (next: Options) => {
    options = next;
    storage.writeOptions(options);
    applyOptions();
  };
  applyOptions();

  const render = (clearInput = true) => {
    const view = journal.session.view;
    const display = makeScreen(view);
    if (view.screen === 'cleared') {
      dom.notice('Game cleared. Open the menu to start a new game.');
    }
    if (
      view.printFault ||
      (view.screen === 'names' && view.nameEditor.phase === 'fault')
    ) {
      dom.notice('Printing stopped. Open the menu to start a new game.');
    }
    const bar = barShown();
    dom.render({
      bar: bar ? barFor(answersFor(view)) : undefined,
      clearInput,
      display,
      focus: !display.paused && !menuOpen && !bar,
      view
    });
  };
  const syncSound = () => {
    if (!menuOpen && !dom.hidden) {
      beeper.sync(journal.session.sounds, journal.session.soundTimeT);
    }
  };
  const advanceTo = (now: number) => {
    const session = journal.session;
    const elapsed = sampleFrames(now);
    const before = session.view.screen;
    const repaint = journal.advance(elapsed);
    syncSound();
    const changed = before !== session.view.screen;
    if (changed || (elapsed > 0 && now - lastPersist >= 1000)) {
      persist();
    }
    if (repaint) {
      render(changed);
    }
  };

  const describe = () => {
    const { game, screen } = journal.session.view;
    if (game) {
      const club = game.clubs[game.club - 1]?.name.trim() ?? '';
      return `${game.manager}, ${club}, season ${game.seasons + 1}`;
    }
    return screen === 'cleared' ? 'Cleared program' : 'New game setup';
  };
  const closeMenu = () => {
    dom.closeMenu();
    menuClosed();
  };
  const menuClosed = () => {
    if (!menuOpen) {
      return;
    }
    menuOpen = false;
    // Exclude the host-menu interval, retaining the current fractional phase.
    sampleFrames(clock.now(), false);
    render();
    syncSound();
  };
  const replaceJournal = (next: Journal, message: string) => {
    journal = next;
    // Saves contain whole frames; a replacement starts a new browser phase.
    sampleFrames = createFrameSampler(clock.now());
    beeper.reset();
    persist();
    dom.notice(message);
    closeMenu();
  };
  const showMenu = (view: MenuView, status = '') => {
    menuView = view;
    let title: string;
    const controls: MenuControl[] = [];
    switch (view) {
      case 'main':
        title = 'Game menu';
        controls.push(
          button('Resume', closeMenu),
          button('Save', () => showMenu('save'), !storageWorks),
          button('Load', () => showMenu('load')),
          button('New game', () => showMenu('new-game')),
          button('Export save file', exportSave),
          button('Import save file', dom.chooseFile),
          button('Options', () => showMenu('options'))
        );
        if (!storageWorks) {
          status ||=
            'This browser is not storing progress. Export a save file to keep it.';
        }
        break;
      case 'save':
      case 'load':
        title = view === 'save' ? 'Save game' : 'Load game';
        for (let slot = 1; slot <= slotCount; slot++) {
          const entry = storage.readSlot(slot);
          const label = entry
            ? `${slot}. ${entry.label} (${new Date(entry.savedAt).toLocaleString()})`
            : `${slot}. Empty`;
          controls.push(
            button(
              pendingSlot === slot ? `Overwrite ${label}?` : label,
              () => (view === 'save' ? saveTo(slot) : loadFrom(slot)),
              view === 'load' && !entry
            )
          );
        }
        controls.push(button('Back', () => showMenu('main')));
        break;
      case 'new-game':
        title = 'Start a new game?';
        status = 'Progress not saved to a slot will be lost.';
        controls.push(
          button('Start new game', () =>
            replaceJournal(createJournal(), 'New game started.')
          ),
          button('Back', () => showMenu('main'))
        );
        break;
      case 'options':
        title = 'Options';
        controls.push(
          {
            change: sound => setOptions({ ...options, sound }),
            checked: options.sound,
            kind: 'toggle',
            label: 'Sound'
          },
          {
            change: value =>
              setOptions({
                ...options,
                scale: value === 'auto' ? 'auto' : (Number(value) as 1 | 2 | 3)
              }),
            choices: [
              ['auto', 'Fit window'],
              ['1', '1×'],
              ['2', '2×'],
              ['3', '3×']
            ],
            kind: 'select',
            label: 'Display size',
            value: String(options.scale)
          },
          {
            change: value =>
              setOptions({ ...options, touch: value as Options['touch'] }),
            choices: [
              ['auto', 'Auto'],
              ['on', 'On'],
              ['off', 'Off']
            ],
            kind: 'select',
            label: 'Touch controls',
            value: options.touch
          },
          button('Back', () => showMenu('main'))
        );
        break;
    }
    dom.showMenu({ controls, status, title });
  };
  const saveTo = (slot: number) => {
    if (storage.readSlot(slot) && pendingSlot !== slot) {
      pendingSlot = slot;
      showMenu('save');
      return;
    }
    pendingSlot = 0;
    const saved = storage.writeSlot(slot, {
      data: journal.snapshot(),
      label: describe(),
      savedAt: clock.today()
    });
    showMenu(
      'save',
      saved ? `Saved to slot ${slot}.` : 'Could not save to this browser.'
    );
  };
  const loadFrom = (slot: number) => {
    const entry = storage.readSlot(slot);
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
    let status: string;
    try {
      download(saveFileName, journal.snapshot());
      status = 'Save file download requested.';
    } catch {
      status = 'Could not download the save file.';
    }
    showMenu('main', status);
  };
  /** KEEP downloads the save; only then does the original ask whether to play on. */
  const keep = (data: string) => {
    try {
      download(saveFileName, data);
    } catch {
      dom.notice('Could not download the web save. Try keep again.');
      return;
    }
    journal.saved();
    persist();
    dom.notice('Web save download requested.');
  };
  const persistCurrent = () => {
    if (!menuOpen) {
      advanceTo(clock.now());
    }
    persist();
  };
  const openMenu = () => {
    if (menuOpen) {
      return;
    }
    advanceTo(clock.now());
    pendingSlot = 0;
    showMenu('main');
    beeper.reset();
    dom.openMenu();
    menuOpen = true;
  };
  const unlockSound = () => {
    void beeper.unlock()?.then(syncSound);
  };
  /** Submits at the current moment, unless input waits; then shows the result. */
  const answer = (send: () => Effect | undefined) => {
    void beeper.unlock();
    if (menuOpen) {
      return;
    }
    advanceTo(clock.now());
    if (journal.session.view.paused) {
      return;
    }
    beeper.restart();
    const effect = send();
    persist();
    dom.notice('');
    if (effect?.type === 'copy') {
      render();
      print();
      if (!barShown()) {
        dom.focusInput();
      }
      return;
    }
    if (effect?.type === 'save') {
      keep(effect.data);
    }
    if (effect?.type === 'unavailable') {
      dom.notice(`${effect.feature} is not available in this build.`);
    }
    render();
    syncSound();
  };
  const release = () => {
    if (!menuOpen) {
      advanceTo(clock.now());
    }
    journal.setKey('');
    persist();
  };

  render();
  return {
    /** Shows the page's current journal, for tests and tools. */
    get journal() {
      return journal;
    },
    /** A key went down; returns whether to stop the browser's default. */
    keyDown: (event: KeyDown) => {
      if (event.key === 'Escape') {
        if (menuOpen) {
          return false;
        }
        openMenu();
        return true;
      }
      if (menuOpen) {
        return false;
      }
      unlockSound();
      advanceTo(clock.now());
      if (
        !journal.session.view.paused &&
        event.inputFocused &&
        editingKeys.includes(event.key)
      ) {
        beeper.click();
      }
      let prevent = false;
      if (!event.repeat && !event.modified) {
        journal.setKey(event.code);
        if (journal.session.view.paused) {
          prevent = true;
          render();
        }
        persist();
      }
      return prevent;
    },
    keyUp: release,
    /** A save file was chosen; `read` gives its text. */
    importSave: async (read: () => Promise<string>) => {
      try {
        replaceJournal(openSave(await read()), 'Save file loaded.');
      } catch {
        showMenu(
          'main',
          'Could not load this save file. The current game is unchanged.'
        );
      }
    },
    /** The menu's Escape: inner pages go back to the main page. */
    menuCancel: () => {
      if (menuView === 'main') {
        return false;
      }
      pendingSlot = 0;
      showMenu('main');
      return true;
    },
    menuClosed,
    openMenu,
    /** The page is about to go away. */
    pageHide: persistCurrent,
    pointerDown: unlockSound,
    /** A finger lifted or its touch was cancelled. */
    pointerUp: () => {
      if (touchHeld) {
        touchHeld = false;
        release();
      }
    },
    /**
     * A finger went down on the screen. During a timed pause it is a
     * keypress until it lifts (ADR 0006); otherwise it does nothing.
     */
    pressScreen: () => {
      unlockSound();
      if (menuOpen) {
        return;
      }
      advanceTo(clock.now());
      if (!journal.session.view.paused) {
        return;
      }
      touchHeld = true;
      journal.setKey('Space');
      render();
      persist();
    },
    /** The command line's answer: typed, or sent from a soft keyboard. */
    submit: (text: string) =>
      answer(() => {
        // A soft keyboard often sends no Enter keydown; press it for the
        // submit, as a keyboard does, and release it once a frame passes.
        if (!journal.session.timingState.keyboard.key) {
          journal.setKey('Enter');
          softEnterAt = journal.session.view.frames;
        }
        return journal.submit(text);
      }),
    /**
     * A context bar button. A finger presses Enter and holds it until it
     * lifts; a keyboard activation already holds its own key.
     */
    tap: (id: string, pressEnter = true) =>
      answer(() => {
        const offered = answersFor(journal.session.view).find(a => a.id === id);
        if (offered?.kind !== 'choice') {
          return;
        }
        if (!pressEnter) {
          return journal.submit(offered.text);
        }
        touchHeld = true;
        return tapAnswer(journal, offered);
      }),
    /** An animation frame at `now`. */
    tick: (now: number) => {
      if (!menuOpen && !dom.hidden) {
        advanceTo(now);
        if (
          softEnterAt !== undefined &&
          journal.session.view.frames > softEnterAt
        ) {
          softEnterAt = undefined;
          if (journal.session.timingState.keyboard.key === 'Enter') {
            journal.setKey('');
            persist();
          }
        }
      }
    },
    /** Text went into the command line. */
    typed: (inserted: boolean) => {
      unlockSound();
      if (!journal.session.view.paused && inserted) {
        beeper.click();
      }
    },
    /** The page was hidden or shown again. */
    visibilityChanged: () => {
      if (dom.hidden) {
        persistCurrent();
        beeper.reset();
      } else {
        sampleFrames(clock.now(), false);
        syncSound();
      }
    }
  };
};
export type App = ReturnType<typeof createApp>;
