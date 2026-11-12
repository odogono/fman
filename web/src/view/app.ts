import type { SoundEvent } from '../sim/beeper';
import { createJournal, openSave, type Journal } from '../sim/journal';
import type { Game } from '../sim/management';
import { clubSquads } from '../sim/ruleset';
import type { Effect, View } from '../sim/session';
import { positions } from '../sim/squads';
import {
  changeAmount,
  startAmount,
  type AmountAction,
  type AmountEntry
} from './amount-entry';
import { answersFor, printAccepted, type OfferedAnswer } from './answers';
import { barFor, tickerBar, type BarButton } from './context-bar';
import { createFrameSampler } from './frame-sampler';
import {
  isRules,
  rulesChoices,
  rulesName,
  rulesOf,
  rulesetFor,
  type Rules
} from './rules';
import { makeScreen } from './screen';
import { screenTitle } from './screen-title';
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
    }
  /** Lines to read, such as a club's squad. */
  | { items: readonly string[]; kind: 'list'; label: string }
  /** One of a few choices, each with a line saying what it means. */
  | {
      change: (value: string) => void;
      choices: readonly {
        description: string;
        text: string;
        value: string;
      }[];
      kind: 'choice';
      label: string;
      value: string;
    };
export type Menu = {
  controls: readonly MenuControl[];
  /** A line under the title about the game in play, such as its rules. */
  detail?: string;
  status: string;
  title: string;
};

/** The page: it paints what the app gives it and reports what the player does. */
export type Dom = {
  /** `touch`: the context bar shows, so the screen fits the page width. */
  applyOptions: (options: Options, touch: boolean) => void;
  /** Opens the file picker; a chosen file arrives through `importSave`. */
  chooseFile: () => void;
  closeMenu: () => void;
  /** The page has a touchscreen, as on a phone or tablet. */
  readonly coarsePointer: boolean;
  focusInput: () => void;
  readonly hidden: boolean;
  notice: (text: string) => void;
  openMenu: () => void;
  render: (screen: {
    /** The amount being entered on an amount prompt, while the bar shows. */
    amount: AmountEntry | undefined;
    /** The context bar's buttons, or `undefined` when the bar is hidden. */
    bar: readonly BarButton[] | undefined;
    clearInput: boolean;
    display: Display;
    focus: boolean;
    /** The name of the screen on show, for the title above it. */
    title: string;
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

type MenuView = 'main' | 'save' | 'load' | 'options' | 'new-game' | 'clubs';

const button = (
  label: string,
  action: () => void,
  disabled = false
): MenuControl => ({ action, disabled, kind: 'button', label });

/**
 * The web app around one journal: autosave, the game menu and its save
 * slots, save files, options, sound sync and the player's input.
 */
const positionNames = {
  DF: 'Defender',
  FW: 'Attacker',
  GK: 'Goalkeeper',
  MF: 'Midfielder'
} as const;

/**
 * A club's squad as the clubs page lists it, goalkeeper first. The managed
 * club's squad is the owned players in its places.
 */
const squadLines = (game: Game, slot: number) => {
  const squad =
    slot === game.club
      ? game.players.filter(p => p.status > 0)
      : (game.clubs[slot - 1]!.squad ?? []);
  return [...squad]
    .sort(
      (a, b) => positions.indexOf(a.position!) - positions.indexOf(b.position!)
    )
    .map(p => `${p.name}, ${positionNames[p.position!]}`);
};

export const createApp = ({
  beeper,
  clock,
  dom,
  download,
  print,
  storage
}: Adapters) => {
  let options = storage.readOptions();
  /** A fresh game at the title, under the rules last chosen (Enhanced at first). */
  const newJournal = (rules: Rules = options.rules) =>
    createJournal({ kind: 'title', ruleset: rulesetFor(rules) });
  let journal: Journal;
  let storageWorks = true;
  {
    const saved = storage.readAutosave();
    try {
      journal = saved ? openSave(saved) : newJournal();
    } catch {
      journal = newJournal();
      dom.notice(
        'Could not resume the previous session; a new game has started.'
      );
    }
  }
  let lastPersist = 0;
  let sampleFrames = createFrameSampler(clock.now());
  let menuOpen = false;
  let menuView: MenuView = 'main';
  /** The club whose squad the clubs page shows, by slot. */
  let shownClub = 1;
  let pendingSlot = 0;
  /** The rules picked in the New game step, until it starts a game. */
  let chosenRules = options.rules;
  /** The held keypress is a finger's, so its lift releases it. */
  let touchHeld = false;
  /** The amount being entered; it starts afresh each time its prompt does. */
  let amountEntry: AmountEntry | undefined;
  const amountFor = (answers: readonly OfferedAnswer[]) => {
    const offered = answers.find(a => a.kind === 'amount');
    if (offered?.kind !== 'amount') {
      amountEntry = undefined;
    } else if (amountEntry?.id !== offered.id) {
      amountEntry = startAmount(offered);
    }
    return amountEntry;
  };

  const barShown = () =>
    options.touch === 'on' || (options.touch === 'auto' && dom.coarsePointer);
  /** The moment-highlights ticker (#108) is still showing its moments. */
  const tickerRunning = () => {
    const view = journal.session.view;
    return (
      view.screen === 'highlights' && 'ticker' in view && !view.ticker.done
    );
  };
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
    const answers = answersFor(view);
    const ticking = tickerRunning();
    dom.render({
      amount: bar ? amountFor(answers) : undefined,
      bar: ticking ? tickerBar : bar ? barFor(answers) : undefined,
      clearInput,
      display,
      focus: !display.paused && !menuOpen && !bar,
      title: screenTitle(view),
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
  /** Whether the game in play has a squad for every club (#113). */
  const squadsShown = () => {
    const { game } = journal.session.view;
    return game !== undefined && clubSquads(game.ruleset);
  };
  const showMenu = (view: MenuView, status = '') => {
    menuView = view;
    let title: string;
    let detail: string | undefined;
    const controls: MenuControl[] = [];
    switch (view) {
      case 'main':
        title = 'Game menu';
        detail = `Rules: ${rulesName(rulesOf(journal.session.ruleset))}`;
        controls.push(
          button('Resume', closeMenu),
          button(
            'Print screen',
            printScreen,
            !printAccepted(journal.session.view)
          ),
          button('Save', () => showMenu('save'), !storageWorks),
          button('Load', () => showMenu('load')),
          button('New game', () => {
            chosenRules = options.rules;
            showMenu('new-game');
          }),
          ...(squadsShown()
            ? [
                button('Clubs', () => {
                  shownClub = journal.session.view.game!.club;
                  showMenu('clubs');
                })
              ]
            : []),
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
            ? `${slot}. ${entry.label}, ${rulesName(entry.rules ?? 'original')} rules (${new Date(entry.savedAt).toLocaleString()})`
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
          {
            change: value => {
              if (isRules(value)) {
                chosenRules = value;
              }
            },
            choices: rulesChoices.map(choice => ({
              description: choice.description,
              text: choice.name,
              value: choice.rules
            })),
            kind: 'choice',
            label: 'Rules',
            value: chosenRules
          },
          button('Start new game', () => {
            setOptions({ ...options, rules: chosenRules });
            replaceJournal(
              newJournal(chosenRules),
              `New game started with ${rulesName(chosenRules)} rules.`
            );
          }),
          button('Back', () => showMenu('main'))
        );
        break;
      case 'clubs': {
        title = 'Clubs';
        const game = journal.session.view.game!;
        detail = 'Names and positions, without skill.';
        controls.push(
          {
            change: value => {
              shownClub = Number(value);
              showMenu('clubs');
            },
            choices: game.clubs.map((club, i) => [
              String(i + 1),
              `${club.name.trim()} (Division ${Math.floor(i / 16) + 1})`
            ]),
            kind: 'select',
            label: 'Club',
            value: String(shownClub)
          },
          {
            items: squadLines(game, shownClub),
            kind: 'list',
            label: 'Squad'
          },
          button('Back', () => showMenu('main'))
        );
        break;
      }
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
    dom.showMenu({
      controls,
      ...(detail === undefined ? {} : { detail }),
      status,
      title
    });
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
      rules: rulesOf(journal.session.ruleset),
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
  /** The original's `h`, sent from the menu once play resumes. */
  const printScreen = () => {
    closeMenu();
    answer(() => journal.submit('h', 'brief'));
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
  /**
   * Skip on the ticker (#108): ends its remaining pauses at once. It presses
   * no key, which would also end the final hold.
   */
  const skip = () => {
    if (menuOpen) {
      return;
    }
    advanceTo(clock.now());
    if (!tickerRunning()) {
      return;
    }
    journal.skipPause();
    render();
    persist();
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
    journal.release();
    persist();
  };
  /** A key-up can no longer arrive, so a held keypress lifts by itself. */
  const letGo = () => {
    touchHeld = false;
    journal.letGo();
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
        event.code === 'KeyS' &&
        !event.modified &&
        !event.repeat &&
        tickerRunning()
      ) {
        skip();
        return true;
      }
      if (
        !journal.session.view.paused &&
        event.inputFocused &&
        editingKeys.includes(event.key)
      ) {
        beeper.click();
      }
      let prevent = false;
      if (!event.repeat && !event.modified) {
        touchHeld = false;
        journal.press(event.code, 'held');
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
      journal.press('Space', 'held');
      render();
      persist();
    },
    /** The command line's answer: typed, or sent from a soft keyboard. */
    submit: (text: string) => answer(() => journal.submit(text, 'brief')),
    /** A change to the amount being entered; it presses no key. */
    amount: (action: AmountAction) => {
      if (amountEntry && !menuOpen) {
        amountEntry = changeAmount(amountEntry, action);
        render(false);
      }
    },
    /**
     * A context bar button. A finger presses Enter and holds it until it
     * lifts; a keyboard activation already holds its own key. An amount's
     * button submits the amount entered, closing the keypad first.
     */
    tap: (id: string, pressEnter = true) => {
      if (id === tickerBar[0]!.answer.id) {
        skip();
        return;
      }
      answer(() => {
        const answers = answersFor(journal.session.view);
        const offered = answers.find(a => a.id === id);
        const entry = amountFor(answers);
        let text: string;
        if (offered?.kind === 'choice') {
          text = offered.text;
        } else if (offered?.kind === 'amount' && entry) {
          text = String(changeAmount(entry, { type: 'done' }).value);
        } else {
          return;
        }
        if (!pressEnter) {
          return journal.submit(text);
        }
        touchHeld = !journal.session.timingState.keyboard.key;
        return journal.submit(text, 'held');
      });
    },
    /** An animation frame at `now`. */
    tick: (now: number) => {
      if (!menuOpen && !dom.hidden) {
        advanceTo(now);
      }
    },
    /** Text went into the command line. */
    typed: (inserted: boolean) => {
      unlockSound();
      if (!journal.session.view.paused && inserted) {
        beeper.click();
      }
    },
    /** The window lost focus, so no key-up will reach it. */
    blurred: () => {
      letGo();
      persist();
    },
    /** The page was hidden or shown again. */
    visibilityChanged: () => {
      if (dom.hidden) {
        letGo();
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
