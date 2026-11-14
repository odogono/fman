import { expect, test } from 'bun:test';

import { spectrumClockHz, spectrumFrameT } from '../sim/frame-clock';
import { createJournal } from '../sim/journal';
import { creditLimit } from '../sim/management';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { tickerLeadIn, tickerPause, type Ticker } from '../sim/ticker';
import { submitInput } from '../test/input';
import type { AmountEntry } from './amount-entry';
import { answersFor } from './answers';
import { createApp, type Dom, type Menu, type MenuControl } from './app';
import { clipScriptsFor } from './clip-match';
import { createClipPlayer } from './clip-player';
import type { ClipFrame } from './clips';
import type { BarButton } from './context-bar';
import type { Home } from './home';
import type { ModernScreen } from './modern-screen';
import type { PickTeam } from './pick-team';
import { createStorage, type Options } from './storage';

const frameMs = (1000 * spectrumFrameT) / spectrumClockHz;

/** The app with every browser effect replaced by an in-memory one. */
/** The ticker on show, if moments decide the match on show. */
const tickerIn = (view: View) =>
  view.screen === 'highlights' && view.highlights.kind === 'moments'
    ? view.highlights.timeline
    : undefined;

const harness = ({
  autosave,
  coarsePointer = false,
  downloadFails = false,
  firstVisit = false,
  options,
  reducedMotion = false,
  storageFails = false
}: {
  autosave?: string;
  coarsePointer?: boolean;
  downloadFails?: boolean;
  /** Nothing stored yet, as on a player's first visit. */
  firstVisit?: boolean;
  /**
   * The stored options, as the page finds them on opening. Classic mode
   * unless they name a presentation mode.
   */
  options?: string;
  /** The browser asks for less motion. */
  reducedMotion?: boolean;
  storageFails?: boolean;
} = {}) => {
  const stored = new Map<string, string>();
  if (autosave !== undefined) {
    stored.set('fman:autosave', autosave);
  }
  if (!firstVisit) {
    stored.set(
      'fman:options',
      JSON.stringify({
        presentation: 'classic',
        ...(JSON.parse(options ?? '{}') as object)
      })
    );
  }
  const page = {
    amount: undefined as AmountEntry | undefined,
    /** Modern mode's loan, repayment or transfer bid screen. */
    get amountPrompt() {
      return this.modern?.kind === 'amount' ? this.modern.amount : undefined;
    },
    applied: [] as Options[],
    get atHome() {
      return this.modern?.kind === 'home';
    },
    bar: undefined as readonly BarButton[] | undefined,
    /** The sprite highlights' frames painted, latest last. */
    clips: [] as ClipFrame[],
    downloads: [] as { data: string; name: string }[],
    filesChosen: 0,
    fit: false,
    focused: 0,
    hidden: false,
    get highlights() {
      return this.modern?.kind === 'highlights'
        ? this.modern.highlights
        : undefined;
    },
    home: undefined as Home | undefined,
    inputFocus: false,
    menu: undefined as Menu | undefined,
    menuOpen: false,
    get message() {
      return this.modern?.kind === 'message' ? this.modern.message : undefined;
    },
    modern: undefined as ModernScreen | undefined,
    notice: '',
    get pickTeam() {
      return this.modern?.kind === 'pick-team'
        ? this.modern.pickTeam
        : undefined;
    },
    printed: 0,
    rendered: 0,
    /** On the status prompt, or read-only beside the Home screen. */
    get status() {
      return this.modern?.kind === 'status' || this.modern?.kind === 'home'
        ? this.modern.status
        : undefined;
    },
    title: '',
    typing: true
  };
  const dom: Dom = {
    applyOptions: (options, fit) => {
      page.applied.push(options);
      page.fit = fit;
    },
    chooseFile: () => page.filesChosen++,
    closeMenu: () => {
      page.menuOpen = false;
    },
    coarsePointer,
    focusInput: () => {
      page.focused++;
    },
    get hidden() {
      return page.hidden;
    },
    notice: text => {
      page.notice = text;
    },
    openMenu: () => {
      page.menuOpen = true;
    },
    paintClip: ({ frame }) => {
      page.clips.push(frame);
    },
    reducedMotion,
    render: ({ amount, bar, focus, home, modern, title, typing }) => {
      page.modern = modern;
      page.amount = amount;
      page.home = home;
      page.typing = typing;
      page.title = title;
      page.bar = bar;
      page.inputFocus = focus;
      page.rendered++;
    },
    showMenu: menu => {
      page.menu = menu;
    }
  };
  const beeper = {
    click: () => {},
    muted: false,
    reset: () => {},
    restart: () => {},
    sync: () => {},
    unlock: () => undefined
  };
  let now = 0;
  const app = createApp({
    beeper,
    clock: { now: () => now, today: () => '2026-01-02T03:04:05.000Z' },
    dom,
    download: (name, data) => {
      if (downloadFails) {
        throw new Error('Download blocked');
      }
      page.downloads.push({ data, name });
    },
    print: () => page.printed++,
    storage: createStorage(() => ({
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => {
        if (storageFails) {
          throw new Error('Quota exceeded');
        }
        stored.set(key, value);
      }
    }))
  });
  const view = () => app.journal.session.view;
  /** Lets animation frames run until the game takes input again. */
  const settle = () => {
    for (let frame = 0; view().paused; frame++) {
      // Modern mode's clips run at real-world pace: a match can take minutes.
      if (frame > 50_000) {
        throw new Error(`Still paused on ${view().screen}`);
      }
      now += frameMs;
      app.tick(now);
    }
  };
  const type = (text: string) => {
    settle();
    app.submit(text);
  };
  const control = (label: string) => {
    const found = page.menu?.controls.find(c => c.label.startsWith(label));
    if (!found) {
      throw new Error(`No menu control ${label}`);
    }
    return found;
  };
  const press = (label: string) => {
    const found = control(label);
    if (found.kind !== 'button' || found.disabled) {
      throw new Error(`Cannot press ${label}`);
    }
    found.action();
  };
  /** Answers by typing, or in Modern mode by tapping the offered answer. */
  const give = (id: string, text: string) => {
    settle();
    if (page.typing) {
      app.submit(text);
    } else {
      app.tap(id);
      app.pointerUp();
    }
  };
  const toMenu = () => {
    type('alex');
    give('clubs.club.1', '1');
    give('level.1', '1');
    // Enhanced games' clubs wear their own kits: no colour question.
    if (view().screen === 'colours') {
      give('colours.black', '0');
    }
    settle();
    expect(view().screen).toBe('menu');
  };
  /** Advances the page clock by `frames` Spectrum frames. */
  const wait = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      now += frameMs;
      app.tick(now);
    }
  };
  /** The bar's labels, as shown. */
  const labels = () => page.bar?.map(button => button.label);
  /** Taps the bar button labelled `label`, holding it for `frames`. */
  const tap = (label: string, frames = 3) => {
    settle();
    const button = page.bar?.find(b => b.label === label);
    if (!button) {
      throw new Error(`No bar button ${label} in ${labels()?.join(', ')}`);
    }
    app.tap(button.answer.id);
    wait(frames);
    app.pointerUp();
  };
  return {
    app,
    beeper,
    control,
    labels,
    page,
    press,
    settle,
    stored,
    tap,
    toMenu,
    type,
    view,
    wait
  };
};

test('keep downloads the save, then asks whether to play on', () => {
  const run = harness();
  run.toMenu();
  run.type('keep');
  expect(run.page.downloads).toEqual([
    { data: expect.any(String), name: 'football.fman.json' }
  ]);
  expect(run.view().screen).toBe('save-question');
  expect(run.page.notice).toBe('Web save download requested.');
  run.type('y');
  expect(run.view().screen).toBe('menu');

  run.type('keep');
  run.type('n');
  expect(run.view().screen).toBe('cleared');
  expect(run.page.notice).toBe(
    'Game cleared. Open the menu to start a new game.'
  );
});

test('a refused download keeps the game at the menu so keep can be retried', () => {
  const run = harness({ downloadFails: true });
  run.toMenu();
  run.type('keep');
  expect(run.view().screen).toBe('menu');
  expect(run.page.notice).toBe(
    'Could not download the web save. Try keep again.'
  );
  expect(JSON.parse(run.app.journal.snapshot()).inputs).toEqual([]);
});

test('the autosave resumes the exact session, and a broken one starts afresh', () => {
  const first = harness();
  first.toMenu();
  first.type('s');
  first.settle();
  first.app.pageHide();
  const autosave = first.stored.get('fman:autosave')!;
  expect(autosave).toBe(first.app.journal.snapshot());

  const resumed = harness({ autosave });
  expect(resumed.view()).toEqual(first.view());

  const broken = harness({ autosave: 'not a save' });
  expect(broken.view().screen).toBe('title');
  expect(broken.page.notice).toBe(
    'Could not resume the previous session; a new game has started.'
  );
});

test('slots save, confirm an overwrite and load back the same session', () => {
  const run = harness();
  run.toMenu();
  expect(run.app.keyDown(escape)).toBe(true);
  expect(run.page.menuOpen).toBe(true);
  run.press('Save');
  run.press('1. Empty');
  expect(run.page.menu?.status).toBe('Saved to slot 1.');
  const saved = JSON.parse(run.stored.get('fman:slot:1')!);
  expect(saved.label).toMatch(/^alex, \S.*, season 1$/);
  expect(saved.savedAt).toBe('2026-01-02T03:04:05.000Z');

  run.press('1. alex');
  expect(run.control('Overwrite 1. alex').kind).toBe('button');
  run.press('Overwrite 1. alex');
  expect(run.page.menu?.status).toBe('Saved to slot 1.');

  expect(run.app.menuCancel()).toBe(true);
  expect(run.page.menu?.title).toBe('Game menu');
  run.press('Resume');
  expect(run.page.menuOpen).toBe(false);
  run.type('s');
  run.settle();
  expect(run.view().screen).toBe('status');

  run.app.openMenu();
  run.press('Load');
  expect(
    (run.control('2. Empty') as Extract<MenuControl, { kind: 'button' }>)
      .disabled
  ).toBe(true);
  run.press('1. alex');
  expect(run.page.menuOpen).toBe(false);
  expect(run.page.notice).toBe('Loaded slot 1.');
  expect(run.view().screen).toBe('menu');
  expect(JSON.parse(run.app.journal.snapshot())).toEqual(
    JSON.parse(saved.data)
  );
});

test('save files export and import through the menu', async () => {
  const run = harness();
  run.toMenu();
  run.app.openMenu();
  run.press('Export save file');
  expect(run.page.menu?.status).toBe('Save file download requested.');
  const exported = run.page.downloads[0]!.data;

  run.press('Import save file');
  expect(run.page.filesChosen).toBe(1);
  await run.app.importSave(async () => 'not a save');
  expect(run.page.menu?.status).toBe(
    'Could not load this save file. The current game is unchanged.'
  );
  await run.app.importSave(async () => {
    throw new Error('Unreadable file');
  });
  expect(run.page.menuOpen).toBe(true);

  await run.app.importSave(async () => exported);
  expect(run.page.menuOpen).toBe(false);
  expect(run.page.notice).toBe('Save file loaded.');
  expect(JSON.parse(run.app.journal.snapshot())).toEqual(JSON.parse(exported));
});

test('without browser storage, slots are disabled and the menu says why', () => {
  const run = harness({ storageFails: true });
  run.toMenu();
  run.app.openMenu();
  expect(run.control('Save')).toMatchObject({ disabled: true });
  expect(run.page.menu?.status).toBe(
    'This browser is not storing progress. Export a save file to keep it.'
  );
});

test('options are stored and applied to sound and the page', () => {
  const run = harness();
  run.app.openMenu();
  run.press('Options');
  const sound = run.control('Sound');
  const size = run.control('Display size');
  if (sound.kind !== 'toggle' || size.kind !== 'select') {
    throw new Error('Unexpected option controls');
  }
  sound.change(false);
  size.change('2');
  expect(run.beeper.muted).toBe(true);
  expect(run.page.applied.at(-1)).toEqual({
    presentation: 'classic',
    rules: 'enhanced',
    scale: 2,
    sound: false,
    touch: 'auto'
  });
  expect(JSON.parse(run.stored.get('fman:options')!)).toEqual({
    presentation: 'classic',
    rules: 'enhanced',
    scale: 2,
    sound: false,
    touch: 'auto'
  });
});

test('h prints the screen', () => {
  const run = harness();
  run.toMenu();
  run.type('s');
  run.settle();
  run.type('h');
  expect(run.page.printed).toBe(1);
});

test('the game menu prints the screen where the original takes h', () => {
  const run = harness({ coarsePointer: true });
  run.app.openMenu();
  expect(run.control('Print screen')).toMatchObject({ disabled: true });
  run.press('Resume');

  run.toMenu();
  expect(run.page.title).toBe('Main menu');
  run.tap('Score (s)');
  run.settle();
  expect(run.page.title).toBe('Club status');
  const before = run.app.journal.session.view;
  run.app.openMenu();
  run.press('Print screen');
  expect(run.page.menuOpen).toBe(false);
  expect(run.page.printed).toBe(1);
  expect(run.view().screen).toBe('status');
  expect(run.view().game).toEqual(before.game);
  // Enter goes down for the answer, as a typed h presses it, and lifts a
  // frame after the replayed prompt beep.
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Enter');
  run.wait(200);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

const escape = {
  code: 'Escape',
  inputFocused: true,
  key: 'Escape',
  modified: false,
  repeat: false
};

test('touch controls show the bar on coarse pointers, or when switched on', () => {
  const desktop = harness();
  expect(desktop.page.bar).toBeUndefined();
  expect(desktop.page.fit).toBe(false);

  const phone = harness({ coarsePointer: true });
  phone.settle();
  expect(phone.page.fit).toBe(true);
  expect(phone.labels()).toEqual(['Type name']);
  expect(phone.page.inputFocus).toBe(false);

  phone.app.openMenu();
  phone.press('Options');
  const touch = phone.control('Touch controls');
  if (touch.kind !== 'select') {
    throw new Error('Unexpected touch control');
  }
  touch.change('off');
  phone.app.menuClosed();
  expect(phone.page.bar).toBeUndefined();
  expect(phone.page.fit).toBe(false);

  desktop.app.openMenu();
  desktop.press('Options');
  const on = desktop.control('Touch controls');
  if (on.kind !== 'select') {
    throw new Error('Unexpected touch control');
  }
  on.change('on');
  desktop.app.menuClosed();
  expect(desktop.page.bar).toEqual([]);
});

test('the bar offers the menu answers and a tap submits one', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.settle();
  expect(run.labels()).toEqual([
    'Score (s)',
    'Squad (a)',
    'Loan (l)',
    'Repay (p)',
    'Level',
    'Names',
    'Save (keep)',
    'Continue (99)'
  ]);
  run.tap('Score (s)');
  expect(run.view().screen).toBe('status');
  run.tap('Continue');
  run.tap('Continue (99)');
  expect(run.view().screen).toBe('fixture');
  expect(run.page.focused).toBe(0);
});

test('a tap holds Enter until the finger lifts, as a key does', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.settle();
  run.app.tap('menu.status');
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Enter');
  run.wait(2);
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Enter');
  run.app.pointerUp();
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a keyboard-activated bar button submits without pressing Enter again', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.settle();
  run.app.keyDown({
    code: 'Enter',
    inputFocused: false,
    key: 'Enter',
    modified: false,
    repeat: false
  });
  run.app.tap('menu.status', false);
  expect(run.view().screen).toBe('status');
  run.app.pointerUp();
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Enter');
  run.app.keyUp();
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a finger on the screen is a keypress only during a timed pause', () => {
  const run = harness({ coarsePointer: true });
  run.app.pressScreen();
  expect(run.view().paused).toBe(true);
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Space');
  run.wait(3);
  run.app.pointerUp();
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
  run.settle();
  expect(run.view().screen).toBe('manager');
  run.app.pressScreen();
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a soft keyboard submit presses Enter until a frame has passed', () => {
  const run = harness({ coarsePointer: true });
  run.settle();
  run.app.submit('alex');
  expect(run.view().screen).toBe('clubs');
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Enter');
  run.wait(2);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a finger lifted after a save loads changes nothing in the loaded game', async () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.settle();
  run.app.tap('menu.status');
  const saved = run.app.journal.snapshot();
  await run.app.importSave(async () => saved);
  expect(run.page.notice).toBe('Save file loaded.');
  const loaded = run.app.journal.snapshot();
  run.app.pointerUp();
  expect(run.app.journal.snapshot()).toBe(loaded);
});

test('hiding the page lets go of a key whose key-up it will miss', () => {
  const run = harness();
  run.toMenu();
  run.app.keyDown({
    code: 'Space',
    inputFocused: true,
    key: ' ',
    modified: false,
    repeat: false
  });
  run.page.hidden = true;
  run.app.visibilityChanged();
  run.page.hidden = false;
  run.app.visibilityChanged();
  run.wait(2);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a lost window focus lets go of a held key', () => {
  const run = harness();
  run.toMenu();
  run.app.keyDown({
    code: 'KeyA',
    inputFocused: true,
    key: 'a',
    modified: false,
    repeat: false
  });
  run.app.blurred();
  run.wait(2);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
});

test('a physical Enter keeps its own press through a submit', () => {
  const run = harness();
  run.settle();
  run.app.keyDown({
    code: 'NumpadEnter',
    inputFocused: true,
    key: 'Enter',
    modified: false,
    repeat: false
  });
  run.app.submit('alex');
  run.wait(2);
  expect(run.app.journal.session.timingState.keyboard.key).toBe('NumpadEnter');
});

test('a loan is entered with the stepper, chips and keypad, then taken', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.tap('Loan (l)');
  run.settle();
  expect(run.labels()).toEqual(['Cancel (0)', 'Take loan']);
  const limit = creditLimit(run.view().game!) - run.view().game!.debt;
  expect(run.page.amount).toMatchObject({ max: limit, value: 0 });

  run.app.amount({ delta: 1000, type: 'step' });
  run.app.amount({ delta: 50_000, type: 'step' });
  expect(run.page.amount?.value).toBe(51_000);
  run.app.amount({ type: 'max' });
  expect(run.page.amount?.value).toBe(limit);
  run.app.amount({ type: 'keypad' });
  for (const digit of [7, 5, 0, 0]) {
    run.app.amount({ digit, type: 'digit' });
  }
  expect(run.page.amount?.typing).toBe('7500');
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');

  const debt = run.view().game!.debt;
  run.tap('Take loan');
  expect(run.view().screen).toBe('message');
  expect(run.view().game!.debt).toBe(debt + 7500);
  expect(run.page.amount).toBeUndefined();
});

test('Cancel leaves a loan the original way, by borrowing nothing', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  const debt = run.view().game!.debt;
  run.tap('Loan (l)');
  run.app.amount({ delta: 10_000, type: 'step' });
  run.tap('Cancel (0)');
  expect(run.view().screen).toBe('message');
  expect(run.view().game!.debt).toBe(debt);
});

const rulesChoice = (run: ReturnType<typeof harness>) => {
  const choice = run.control('Rules');
  if (choice.kind !== 'choice') {
    throw new Error('Rules is not a choice');
  }
  return choice;
};

test('a first visit plays Enhanced rules, and the menu says so', () => {
  const run = harness();
  expect(run.app.journal.session.ruleset).toBe(latestEnhanced);
  run.toMenu();
  expect(run.view().game!.ruleset).toBe(latestEnhanced);
  run.app.openMenu();
  expect(run.page.menu?.detail).toBe('Rules: Enhanced');
});

test('New game offers Enhanced first, then remembers the rules chosen', () => {
  const run = harness();
  run.toMenu();
  run.app.openMenu();
  run.press('New game');
  const offered = rulesChoice(run);
  expect(offered.value).toBe('enhanced');
  expect(offered.choices.map(c => c.text)).toEqual(['Enhanced', 'Original']);
  expect(offered.choices.every(c => c.description.length > 0)).toBe(true);

  offered.change('original');
  run.press('Start new game');
  expect(run.page.notice).toBe('New game started with Original rules.');
  expect(run.app.journal.session.ruleset).toBe('original');
  run.toMenu();
  expect(run.view().game!.ruleset).toBe('original');
  expect(JSON.parse(run.stored.get('fman:options')!).rules).toBe('original');

  run.app.openMenu();
  expect(run.page.menu?.detail).toBe('Rules: Original');
  run.press('New game');
  expect(rulesChoice(run).value).toBe('original');
  // Backing out keeps the game and the remembered choice.
  rulesChoice(run).change('enhanced');
  run.press('Back');
  run.press('New game');
  expect(rulesChoice(run).value).toBe('original');
  expect(run.app.journal.session.ruleset).toBe('original');
});

test('the rules survive the autosave, and a broken one starts afresh under the last choice', () => {
  const first = harness();
  first.app.openMenu();
  first.press('New game');
  rulesChoice(first).change('original');
  first.press('Start new game');
  first.toMenu();
  const autosave = first.stored.get('fman:autosave')!;
  const options = first.stored.get('fman:options')!;

  const resumed = harness({ autosave });
  expect(resumed.view().game!.ruleset).toBe('original');

  const broken = harness({ autosave: 'broken', options });
  expect(broken.page.notice).toContain('Could not resume');
  expect(broken.app.journal.session.ruleset).toBe('original');
  // With no autosave, a returning player also starts under their last choice.
  expect(harness({ options }).app.journal.session.ruleset).toBe('original');
});

test('save slots show each game’s rules; slots from before rule choice are Original', () => {
  const run = harness();
  run.toMenu();
  run.app.openMenu();
  run.press('Save');
  run.press('1.');
  run.stored.set(
    'fman:slot:2',
    JSON.stringify({
      data: JSON.parse(run.stored.get('fman:slot:1')!).data,
      label: 'old game',
      savedAt: '2025-01-01T00:00:00.000Z'
    })
  );
  run.press('Back');
  run.press('Load');
  const labels = run.page.menu!.controls.map(c => c.label);
  expect(labels[0]).toContain('season 1, Enhanced rules');
  expect(labels[1]).toContain('old game, Original rules');
});

/** An enhanced-7 game, with moment highlights, at the management menu, as an autosave. */
const momentHighlightsSave = () => {
  const journal = createJournal({
    kind: 'title',
    ruleset: 'enhanced-7'
  });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1']) {
    submitInput(journal, text);
  }
  return journal.snapshot();
};

/** The page kicked off into the ticker, with touch controls off. */
const atTicker = (autosave = momentHighlightsSave()) => {
  const run = harness({
    autosave,
    options: JSON.stringify({ touch: 'off' })
  });
  for (const text of ['99', '', '99']) {
    run.type(text);
  }
  const ticker = () => tickerIn(run.view());
  expect(ticker()).toBeDefined();
  return { ...run, ticker };
};

test('the ticker offers Skip even with touch controls off', () => {
  const run = atTicker();
  expect(run.labels()).toEqual(['Skip (s)']);
  run.settle();
  expect(run.view().screen).toBe('result');
  expect(run.page.bar).toBeUndefined();
});

test('Skip shows every moment, then holds them before the result', () => {
  const run = atTicker();
  run.wait(5);
  run.app.tap('ticker.skip');
  const ticker = run.ticker()!;
  expect(ticker.done).toBe(false);
  expect(ticker.shown.length).toBeGreaterThan(0);
  const shown = ticker.shown;
  run.wait(tickerPause - 5);
  expect(run.ticker()?.shown).toEqual(shown);
  run.wait(10);
  expect(run.view().screen).toBe('result');
});

test('the S key skips without pressing a key to the game', () => {
  const run = atTicker();
  run.wait(2);
  const prevent = run.app.keyDown({
    code: 'KeyS',
    inputFocused: false,
    key: 's',
    modified: false,
    repeat: false
  });
  expect(prevent).toBe(true);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('KeyS');
  expect(run.ticker()!.done).toBe(false);
  expect(run.ticker()!.shown.length).toBeGreaterThan(0);
});

test('any other key cuts one pause short, as in the original', () => {
  const run = atTicker();
  run.wait(5);
  run.app.keyDown({
    code: 'Space',
    inputFocused: false,
    key: ' ',
    modified: false,
    repeat: false
  });
  run.wait(2);
  run.app.keyUp();
  expect(run.ticker()!.shown).toHaveLength(1);
});

test('reopening the page mid-ticker resumes at the same moment', () => {
  const run = atTicker();
  run.wait(tickerPause + 20);
  const shown = run.ticker()!.shown;
  expect(shown).toHaveLength(1);
  run.app.pageHide();
  const reopened = harness({
    autosave: run.stored.get('fman:autosave')!,
    options: JSON.stringify({ touch: 'off' })
  });
  expect(tickerIn(reopened.view())?.shown).toEqual(shown);
});

/** An enhanced-6 game, whose clubs all own squads (#113), at the management menu. */
const clubSquadsSave = () => {
  const journal = createJournal({ kind: 'title', ruleset: 'enhanced-6' });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1']) {
    submitInput(journal, text);
  }
  return journal.snapshot();
};

test('under club squads the game menu lists every club’s squad, without skill', () => {
  const run = harness({ autosave: clubSquadsSave() });
  run.app.openMenu();
  run.press('Clubs');
  expect(run.page.menu?.title).toBe('Clubs');
  const club = run.control('Club');
  const squad = () => {
    const control = run.control('Squad');
    if (control.kind !== 'list') {
      throw new Error('Unexpected squad control');
    }
    return control.items;
  };
  if (club.kind !== 'select') {
    throw new Error('Unexpected club control');
  }
  // It opens on the managed club, whose squad is its owned players.
  expect(club.value).toBe('64');
  expect(squad()).toHaveLength(12);
  club.change('1');
  expect(run.control('Club')).toMatchObject({ value: '1' });
  expect(squad()).toHaveLength(12);
  expect(squad()[0]).toEndWith(', Goalkeeper');
  expect(squad().join()).not.toMatch(/\d/);
  run.press('Back');
  expect(run.page.menu?.title).toBe('Game menu');
});

test('under the Original rules the game menu has no clubs page', () => {
  const run = harness({ options: JSON.stringify({ rules: 'original' }) });
  run.toMenu();
  expect(run.app.journal.session.ruleset).toBe('original');
  run.app.openMenu();
  expect(run.page.menu!.controls.map(c => c.label)).not.toContain('Clubs');
});

const modernOptions = JSON.stringify({ presentation: 'modern' });
/** A key going down and up, as the page reports it. */
const key = (run: ReturnType<typeof harness>, name: string, code = name) => {
  const prevented = run.app.keyDown({
    code,
    inputFocused: false,
    key: name,
    modified: false,
    repeat: false
  });
  run.app.keyUp();
  return prevented;
};

test('a first visit opens in Modern mode; a stored Classic choice is kept', () => {
  const first = harness({ firstVisit: true });
  first.toMenu();
  expect(first.page.applied.at(-1)?.presentation).toBe('modern');
  expect(first.page.atHome).toBe(true);
  const classic = harness({
    options: JSON.stringify({ presentation: 'classic' })
  });
  expect(classic.page.applied.at(-1)?.presentation).toBe('classic');
});

test('the Presentation option switches modes mid-game, and is remembered', () => {
  const run = harness();
  run.toMenu();
  expect(run.page.home).toBeUndefined();
  run.app.openMenu();
  run.press('Options');
  const presentation = run.control('Presentation');
  if (presentation.kind !== 'select') {
    throw new Error('Unexpected presentation control');
  }
  expect(presentation.value).toBe('classic');
  presentation.change('modern');
  run.app.menuClosed();
  expect(run.page.atHome).toBe(true);
  expect(run.page.home?.manager).toBe('alex');
  expect(JSON.parse(run.stored.get('fman:options')!)).toMatchObject({
    presentation: 'modern'
  });
  const reopened = harness({ options: run.stored.get('fman:options')! });
  expect(reopened.page.applied.at(-1)?.presentation).toBe('modern');
});

test('the Home screen sums up the club and offers the menu in the original order', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  const home = run.page.home!;
  const game = run.view().game!;
  expect(home).toMatchObject({
    cash: game.cash,
    debt: game.debt,
    division: game.division,
    level: 'Beginner',
    manager: 'alex',
    morale: game.morale
  });
  // No league position before the first league match.
  expect(home.leaguePosition).toBeUndefined();
  expect(home.fixture?.title).toBe(`League match – Division ${game.division}`);
  expect(home.fixture?.home?.name).toBe(game.clubs[game.club - 1]!.name.trim());
  expect(home.choices.map(c => [c.label, c.tone, c.enabled])).toEqual([
    ['Play next match', 'primary', true],
    ['Sell or list your players', 'red', true],
    ['Print score etc', 'blue', true],
    ['Obtain a loan', 'red', true],
    ['Pay off loan', 'blue', true],
    ['Change your skill level', 'red', true],
    ['Change team or player names', 'blue', true],
    ['Save game', 'red', true]
  ]);
  // The Home screen stands in for the menu's bar.
  expect(run.page.bar).toBeUndefined();
});

test('Home screen choices submit the menu answers, and wait for the menu prompt', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  run.app.tap('menu.status');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  expect(run.view().screen).toBe('status');
  expect(run.page.atHome).toBe(false);
  expect(run.page.home?.choices.every(c => !c.enabled)).toBe(true);
  // Away from the menu prompt a choice submits nothing.
  run.app.tap('menu.borrow');
  run.app.pointerUp();
  expect(run.view().screen).toBe('status');
  // The status screen stands in for the original's and its bar.
  expect(run.page.bar).toBeUndefined();
  expect(run.page.status?.done).toEqual({
    enabled: true,
    id: 'status.continue'
  });
  run.app.tap('status.continue');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  expect(run.page.atHome).toBe(true);
  run.app.tap('menu.play');
  run.app.pointerUp();
  expect(run.view().screen).toBe('fixture');
});

/** Takes the quickest way on in Modern mode: kick off, continue or decline. */
const playOn = (run: ReturnType<typeof harness>) => {
  run.settle();
  if (run.page.pickTeam) {
    run.app.tap('team.kick-off');
    run.app.pointerUp();
    return;
  }
  // Modern mode's own screens and its bar submit the same offered answers.
  const offered = answersFor(run.view()).map(answer => answer.id);
  const next =
    offered.find(id => id.endsWith('.continue')) ??
    offered.find(id => id === 'transfer.decline') ??
    offered.find(id => id === 'sale.no');
  run.app.tap(next!);
  run.wait(3);
  run.app.pointerUp();
};

test('a cup round shows only the round on the Home screen, not the draw', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  run.app.tap('menu.play');
  run.app.pointerUp();
  for (let i = 0; run.view().screen !== 'menu'; i++) {
    expect(i).toBeLessThan(40);
    playOn(run);
  }
  expect(run.page.home?.fixture).toEqual({ title: 'F.A. Cup – Round 1' });
});

test('during a match the Home screen shows that match, not the one after it', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  const seen: string[] = [];
  for (let matches = 0; !seen.includes('cup'); matches++) {
    expect(matches).toBeLessThan(10);
    run.settle();
    run.app.tap('menu.play');
    run.app.pointerUp();
    for (let i = 0; run.view().screen !== 'menu'; i++) {
      expect(i).toBeLessThan(40);
      run.settle();
      const view = run.view();
      if ('fixture' in view) {
        const { fixture, game } = view;
        const shown = run.page.home!.fixture!;
        const opponent = game.clubs[fixture.opponent - 1]!.name.trim();
        expect((fixture.home ? shown.away : shown.home)?.name).toBe(opponent);
        expect(
          shown.title.startsWith(fixture.kind === 'cup' ? 'F.A. Cup' : 'League')
        ).toBe(true);
        if (view.screen === 'fixture') {
          seen.push(fixture.kind);
        }
      }
      playOn(run);
    }
  }
});

/** Plays from the menu to the team prompt by tapping. */
const toTeam = (run: ReturnType<typeof harness>) => {
  run.toMenu();
  run.app.tap('menu.play');
  run.app.pointerUp();
  for (let i = 0; run.view().screen !== 'team'; i++) {
    expect(i).toBeLessThan(5);
    run.tap('Continue');
  }
  run.settle();
};
/** Taps a pick team button, as a finger going down and up. */
const pick = (run: ReturnType<typeof harness>, id: string) => {
  run.settle();
  run.app.tap(id);
  run.wait(3);
  run.app.pointerUp();
  run.settle();
};
const liveRows = (pickTeam: PickTeam) =>
  pickTeam.groups.flatMap(g => g.players).filter(row => row.answer);

test('Modern mode picks the team on its own screen, adding then dropping as the original does', () => {
  const run = harness({ options: modernOptions });
  toTeam(run);
  const team = run.page.pickTeam!;
  // The team prompt: strengths, read-only rows, change or kick off.
  expect(run.page.bar).toBeUndefined();
  expect(team.prompt).toBe('team');
  expect(team.picked).toBe(11);
  expect(team.strengths?.rows.map(r => r[0])).toEqual([
    'Energy',
    'Morale',
    'Defence',
    'Midfield',
    'Attack'
  ]);
  expect(liveRows(team)).toEqual([]);
  expect(team.actions.map(a => [a.label, a.tone, a.enabled])).toEqual([
    ['Change team', 'red', true],
    ['Kick off', 'primary', true]
  ]);
  expect(team.groups.map(g => g.title)).toEqual([
    'Defence',
    'Midfield',
    'Attack'
  ]);

  pick(run, 'team.change');
  const adding = run.page.pickTeam!;
  expect(run.view().screen).toBe('selection');
  expect(adding.hint).toBe('Tap a player to add');
  expect(adding.strengths).toBeUndefined();
  expect(adding.actions.map(a => a.label)).toEqual(['Done – continue']);
  // Only reserves take a tap while the original adds.
  const reserves = liveRows(adding);
  expect(reserves.length).toBeGreaterThan(0);
  expect(reserves.every(row => row.status === 'reserve')).toBe(true);

  pick(run, reserves[0]!.answer!);
  const dropping = run.page.pickTeam!;
  expect(dropping.picked).toBe(12);
  expect(dropping.hint).toBe('12 picked – tap one to drop');
  // No Done while twelve are picked: the original won't take 99.
  expect(dropping.actions).toEqual([]);
  const picked = liveRows(dropping);
  expect(picked).toHaveLength(12);
  expect(picked.every(row => row.status === 'picked')).toBe(true);

  pick(run, picked.at(-1)!.answer!);
  expect(run.page.pickTeam!.picked).toBe(11);
  pick(run, 'selection.done');
  expect(run.view().screen).toBe('team');
  pick(run, 'team.kick-off');
  expect(run.page.pickTeam).toBeUndefined();
});

test('every live pick team row and action is an offered answer', () => {
  const run = harness({ options: modernOptions });
  toTeam(run);
  pick(run, 'team.change');
  for (const step of [0, 1]) {
    const shown = run.page.pickTeam!;
    const offered = new Set(answersFor(run.view()).map(answer => answer.id));
    for (const id of [
      ...liveRows(shown).map(row => row.answer!),
      ...shown.actions.map(action => action.id)
    ]) {
      expect(offered.has(id)).toBe(true);
    }
    if (step === 0) {
      pick(run, liveRows(shown)[0]!.answer!);
    }
  }
});

test('the pick team screen groups by category and follows the ruleset', () => {
  const enhanced = harness({ options: modernOptions });
  toTeam(enhanced);
  const shown = enhanced.page.pickTeam!;
  // Club squads: a goalkeeper heads Defence; tiring injuries count weeks.
  expect(shown.weeksOut).toBe(true);
  expect(shown.groups[0]!.players[0]!.tag).toBe('G');
  expect(shown.groups[1]!.players.every(row => row.tag === 'M')).toBe(true);
  expect(shown.groups[2]!.players.every(row => row.tag === 'A')).toBe(true);

  const original = harness({
    options: JSON.stringify({ presentation: 'modern', rules: 'original' })
  });
  toTeam(original);
  const plain = original.page.pickTeam!;
  expect(plain.weeksOut).toBe(false);
  // Without positions, a player's place gives his category.
  plain.groups.forEach((group, category) => {
    for (const row of group.players) {
      expect(Math.floor((row.number - 1) / 8)).toBe(category);
    }
  });
});

test('Classic mode keeps the original team screens and their bar', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.type('99');
  run.settle();
  run.type('');
  run.settle();
  expect(run.view().screen).toBe('team');
  expect(run.page.pickTeam).toBeUndefined();
  expect(run.labels()).toContain('Kick off (99)');
});

test('Modern mode takes no typed answers, only names', () => {
  const run = harness({ options: modernOptions });
  run.settle();
  // The manager's name is asked for, so it is typed.
  expect(run.page.typing).toBe(true);
  expect(run.page.inputFocus).toBe(false);
  run.toMenu();
  expect(run.page.typing).toBe(false);
  run.app.submit('s');
  expect(run.view().screen).toBe('menu');
  // Print screen copies Spectrum screens, not the Home screen.
  run.app.openMenu();
  expect(run.control('Print screen')).toMatchObject({ disabled: true });
});

test('Modern mode takes an exact amount from a physical keyboard', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  run.app.tap('menu.borrow');
  run.app.pointerUp();
  run.settle();
  run.app.amount({ type: 'keypad' });
  for (const digit of '1200') {
    expect(key(run, digit, `Digit${digit}`)).toBe(true);
  }
  key(run, 'Backspace');
  const entry = () =>
    run.page.amountPrompt?.kind === 'borrow'
      ? run.page.amountPrompt.entry
      : undefined;
  expect(entry()?.typing).toBe('120');
  key(run, 'Enter');
  expect(entry()).toMatchObject({ typing: undefined, value: 120 });
  expect(run.view().screen).toBe('borrow');
});

test('in Modern mode a held key still cuts a timed pause short', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  run.app.tap('menu.status');
  run.app.pointerUp();
  expect(run.view().paused).toBe(true);
  run.app.keyDown({
    code: 'KeyX',
    inputFocused: false,
    key: 'x',
    modified: false,
    repeat: false
  });
  expect(run.app.journal.session.timingState.keyboard.key).toBe('KeyX');
});

/** Kicks off from the team screen in Modern mode. */
const kickOff = (run: ReturnType<typeof harness>) => {
  toTeam(run);
  run.app.tap('team.kick-off');
  run.app.pointerUp();
  run.wait(1);
  expect(run.view().screen).toBe('highlights');
};
/** Lets the highlights play out, however long they take. */
const playOut = (run: ReturnType<typeof harness>) => {
  for (let i = 0; run.view().screen === 'highlights'; i++) {
    expect(i).toBeLessThan(100_000);
    run.wait(1);
  }
};

test('Modern mode shows the original pitch under a scoreboard, with the strengths below', () => {
  const run = harness({
    options: JSON.stringify({ presentation: 'modern', rules: 'original' })
  });
  kickOff(run);
  const shown = run.page.highlights!;
  const view = run.view();
  const game = view.game!;
  expect(shown.ticker).toBeUndefined();
  expect(shown.title).toBe(`League match – Division ${game.division}`);
  expect([shown.home.name, shown.away.name]).toContain(
    game.clubs[game.club - 1]!.name.trim()
  );
  // The managed club first, as on the original comparison screen.
  expect(shown.pitch!.strengths.club.name).toBe(
    game.clubs[game.club - 1]!.name.trim()
  );
  expect(shown.pitch!.strengths.rows.map(([name]) => name)).toEqual([
    'Energy',
    'Morale',
    'Defence',
    'Midfield',
    'Attack'
  ]);
  expect(run.page.bar).toBeUndefined();
  expect(run.page.title).toContain(' v ');
  // No Home pane beside the match, even on a wide window.
  expect(run.page.home).toBeUndefined();
  playOut(run);
  expect(run.page.highlights).toBeUndefined();
});

test('a finger on the pitch in a timed pause holds a key until it lifts', () => {
  const run = harness({
    options: JSON.stringify({ presentation: 'modern', rules: 'original' })
  });
  kickOff(run);
  const pausing = () => {
    const view = run.view();
    return (
      view.screen === 'highlights' &&
      view.highlights.kind === 'attacks' &&
      view.highlights.timeline.current?.frame.kind === 'pause' &&
      run.page.highlights!.pitch!.outcome !== undefined
    );
  };
  for (let i = 0; i < 20_000 && !pausing(); i++) {
    expect(run.view().screen).toBe('highlights');
    run.wait(1);
  }
  expect(run.page.highlights!.pitch!.outcome).toMatch(/^(Goal! .+|No goal)$/);
  run.app.pressScreen();
  expect(run.app.journal.session.timingState.keyboard.key).toBe('Space');
  run.app.pointerUp();
  run.wait(5);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('Space');
  playOut(run);
  expect(run.view().screen).toBe('result');
  expect(run.page.highlights).toBeUndefined();
});

/** Kicks off a moment-highlights match in Modern mode. */
const modernMoments = (
  setup: Parameters<typeof harness>[0] = {}
): ReturnType<typeof harness> & { ticker: () => Ticker } => {
  const run = harness({
    autosave: momentHighlightsSave(),
    options: modernOptions,
    ...setup
  });
  for (const id of ['menu.play', 'team.kick-off']) {
    run.settle();
    run.app.tap(id);
    run.app.pointerUp();
    while (run.view().screen === 'fixture') {
      run.settle();
      run.app.tap(answersFor(run.view())[0]!.id);
      run.app.pointerUp();
    }
  }
  const ticker = () => {
    const shown = tickerIn(run.view());
    if (!shown) {
      throw new Error('No ticker');
    }
    return shown;
  };
  return { ...run, ticker };
};

test('under reduced motion, Modern mode shows moment highlights as a ticker, newest first, with Skip', () => {
  const run = modernMoments({ reducedMotion: true });
  expect(run.ticker().lengths).toBeUndefined();
  run.wait(1);
  expect(run.view().screen).toBe('highlights');
  expect(run.page.highlights!.clip).toBeUndefined();
  expect(run.page.clips).toEqual([]);
  expect(run.page.bar).toBeUndefined();
  expect(run.page.highlights!.pitch).toBeUndefined();
  expect(run.page.highlights!.ticker!.skip).toBe(true);
  run.wait(5);
  run.app.tap('ticker.skip');
  const ticker = run.page.highlights!.ticker!;
  const shown = run.ticker();
  expect(ticker.lines).toHaveLength(shown.shown.length);
  expect(ticker.lines[0]!.minute).toBe(`${shown.shown.at(-1)!.minute}′`);
  expect(run.page.highlights!.score).toEqual(shown.score);
  run.wait(tickerPause + 10);
  expect(run.view().screen).toBe('result');
  expect(run.page.highlights).toBeUndefined();
});

test('Modern mode shows the original status facts, and Done returns to the menu', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  // Beside the Home screen while the menu waits: read-only.
  expect(run.page.status).toBeDefined();
  expect(run.page.status?.done).toBeUndefined();
  run.app.tap('menu.status');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  const game = run.view().game!;
  const club = game.clubs[game.club - 1]!;
  expect(run.page.status).toMatchObject({
    cash: game.cash,
    club: { name: club.name.trim() },
    debt: game.debt,
    leagueMatches: 0,
    level: { name: 'Beginner' },
    manager: 'alex',
    morale: game.morale,
    rating: game.rating,
    seasons: game.seasons
  });
  // Before the first league match there is no position to show.
  expect(run.page.status?.leaguePosition).toBeUndefined();
  // Modern mode's own screen is not the Spectrum's to copy.
  run.app.openMenu();
  expect(run.control('Print screen')).toMatchObject({ disabled: true });
  run.press('Resume');
  run.app.tap('status.continue');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  expect(run.view().screen).toBe('menu');
});

test('Classic mode keeps the original status screen, which prints', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.tap('Score (s)');
  run.settle();
  expect(run.page.status).toBeUndefined();
  expect(run.labels()).toEqual(['Continue']);
  run.app.openMenu();
  expect(run.control('Print screen')).toMatchObject({ disabled: false });
});

/** Opens a Modern loan or repayment prompt from the Home screen. */
const toLoan = (run: ReturnType<typeof harness>, id: string) => {
  run.settle();
  run.app.tap(id);
  run.app.pointerUp();
  run.settle();
};

test('Modern mode takes a loan on its own screen, then shows the balance', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  toLoan(run, 'menu.borrow');
  const game = run.view().game!;
  const loan = run.page.amountPrompt!;
  if (loan.kind !== 'borrow') {
    throw new Error('No loan screen');
  }
  expect(run.page.bar).toBeUndefined();
  expect(loan).toMatchObject({
    cancel: { enabled: true, id: 'borrow.cancel' },
    cash: game.cash,
    debt: game.debt,
    entry: { max: creditLimit(game) - game.debt, value: 0 },
    // At £0 the loan would do no more than Cancel does.
    submit: { enabled: false, id: 'borrow.amount', label: 'Take loan' }
  });
  run.app.amount({ delta: 50_000, type: 'step' });
  expect(run.page.amountPrompt).toMatchObject({ submit: { enabled: true } });
  run.app.tap('borrow.amount');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  expect(run.view().game!.debt).toBe(game.debt + 50_000);
  expect(run.page.amountPrompt).toBeUndefined();
  expect(run.page.message).toEqual({
    cash: game.cash + 50_000,
    debt: game.debt + 50_000,
    done: { enabled: true, id: 'message.continue' },
    kind: 'balance'
  });
  run.app.tap('message.continue');
  run.wait(3);
  run.app.pointerUp();
  run.settle();
  expect(run.view().screen).toBe('menu');
  expect(run.page.message).toBeUndefined();
});

test('Modern mode pays off a loan up to the debt and cash, or cancels', () => {
  const run = harness({ options: modernOptions });
  run.toMenu();
  toLoan(run, 'menu.borrow');
  run.app.amount({ delta: 10_000, type: 'step' });
  run.app.tap('borrow.amount');
  run.app.pointerUp();
  run.settle();
  toLoan(run, 'message.continue');
  toLoan(run, 'menu.repay');
  const game = run.view().game!;
  expect(run.page.amountPrompt).toMatchObject({
    entry: { max: Math.min(game.debt, game.cash), value: 0 },
    kind: 'repay',
    submit: { label: 'Pay off loan' }
  });
  run.app.tap('repay.cancel');
  run.app.pointerUp();
  run.settle();
  expect(run.view().game!.debt).toBe(game.debt);
  // Cancel borrows or repays nothing, the original's way.
  expect(run.page.message).toMatchObject({
    debt: game.debt,
    kind: 'balance'
  });
});

test('Classic mode keeps the original loan screen and its bar', () => {
  const run = harness({ coarsePointer: true });
  run.toMenu();
  run.tap('Loan (l)');
  run.settle();
  expect(run.page.amountPrompt).toBeUndefined();
  expect(run.page.message).toBeUndefined();
  expect(run.labels()).toEqual(['Cancel (0)', 'Take loan']);
});

/** What a fresh clip player says of the match on show. */
const clipStateOf = (run: ReturnType<typeof modernMoments>) =>
  createClipPlayer().state(run.view())!;

test('Modern mode hands the sim the clip lengths at kick-off and shows what the clips reach', () => {
  const run = modernMoments();
  const view = run.view();
  if (view.screen !== 'highlights') {
    throw new Error('No highlights');
  }
  expect(run.ticker().lengths).toEqual(
    clipScriptsFor(view.game, view.fixture, run.ticker().moments).map(
      s => s.length
    )
  );
  expect(run.ticker().elapsedT).toBe(0);
  run.wait(5);
  expect(run.page.clips.at(-1)!.caption).toBe('Kick-off');
  // Partway through the first clip, the page shows what the player says.
  while (run.page.highlights!.clip!.shown === 0) {
    run.wait(10);
  }
  const state = clipStateOf(run);
  expect(run.page.highlights!.clip).toEqual(state.progress);
  expect(run.page.highlights!.score).toEqual(state.score);
  expect(run.page.highlights!.ticker!.lines).toHaveLength(1);
  expect(run.page.clips.at(-1)).toEqual(state.shot.frame);
});

test('a tap ends the clip, showing its moment first, and the next clip starts', () => {
  const run = modernMoments();
  if (run.ticker().moments.length < 2) {
    throw new Error('Needs two moments');
  }
  run.wait(tickerLeadIn + tickerPause + 30);
  expect(run.page.highlights!.clip!.shown).toBe(0);
  run.app.pressScreen();
  run.wait(2);
  run.app.pointerUp();
  expect(run.ticker().shown).toHaveLength(2);
  expect(run.page.highlights!.clip!.shown).toBe(1);
  expect(run.page.clips.at(-1)!.caption).toStartWith(
    `${run.ticker().moments[1]!.minute}′`
  );
});

test('Skip ends every clip and shows the whole ticker for the final hold', () => {
  const run = modernMoments();
  run.wait(tickerLeadIn + tickerPause + 30);
  run.app.tap('ticker.skip');
  const count = run.ticker().moments.length;
  expect(run.page.highlights!.clip).toEqual({
    drawer: false,
    full: true,
    shown: count
  });
  expect(run.page.highlights!.ticker!.lines).toHaveLength(count);
  run.settle();
  expect(run.view().screen).toBe('result');
  expect(run.page.highlights).toBeUndefined();
});

test('reopening the page mid-clip picks the clip up where it was', () => {
  const run = modernMoments();
  run.wait(tickerLeadIn + tickerPause + 400);
  run.app.pageHide();
  const reopened = harness({
    autosave: run.stored.get('fman:autosave')!,
    options: modernOptions
  });
  reopened.wait(1);
  expect(tickerIn(reopened.view())?.lengths).toEqual(run.ticker().lengths);
  expect(reopened.page.clips.at(-1)!.caption).toBe(
    run.page.clips.at(-1)!.caption
  );
  expect(reopened.page.highlights!.clip).toEqual(run.page.highlights!.clip);
});

test('a match kicked off without clips keeps the ticker to the end', () => {
  const run = modernMoments({ reducedMotion: true });
  run.wait(tickerLeadIn + tickerPause + 10);
  run.app.pageHide();
  // Reopened where motion is welcome, it still has no clip lengths.
  const reopened = harness({
    autosave: run.stored.get('fman:autosave')!,
    options: modernOptions
  });
  reopened.wait(1);
  expect(reopened.page.highlights!.clip).toBeUndefined();
  expect(reopened.page.highlights!.ticker!.lines).toHaveLength(1);
});

/** Plays a Modern match's clips until the first reaches its moment. */
const toFirstMoment = () => {
  const run = modernMoments();
  if (run.ticker().moments.length < 2) {
    throw new Error('Needs two moments');
  }
  while (run.page.highlights!.clip!.shown === 0) {
    run.wait(1);
  }
  return run;
};

test('the moments drawer opens and closes without ending the clip', () => {
  const run = toFirstMoment();
  expect(run.page.highlights!.clip!.drawer).toBe(false);
  run.app.tap('moments.open');
  run.app.pointerUp();
  expect(run.page.highlights!.clip!.drawer).toBe(true);
  // Opening it pressed no key: the first clip is still on show.
  expect(run.ticker().shown).toHaveLength(1);
  run.app.tap('moments.close');
  run.app.pointerUp();
  expect(run.page.highlights!.clip!.drawer).toBe(false);
});

test('a tap on the pitch ends the clip and leaves the drawer open', () => {
  const run = toFirstMoment();
  run.app.tap('moments.open');
  run.app.pointerUp();
  run.app.pressScreen();
  run.wait(2);
  run.app.pointerUp();
  expect(run.ticker().shown).toHaveLength(2);
  expect(run.page.highlights!.clip!.drawer).toBe(true);
});

test('Enter on the drawer button opens it without ending the clip', () => {
  const run = toFirstMoment();
  const enter = {
    code: 'Enter',
    inputFocused: false,
    key: 'Enter',
    modified: false,
    repeat: false,
    viewControlFocused: true
  };
  // The browser's own click on the button follows the key.
  expect(run.app.keyDown(enter)).toBe(false);
  run.app.tap('moments.open', false);
  expect(run.app.journal.session.timingState.keyboard.key).not.toBe('Enter');
  run.wait(2);
  run.app.keyUp();
  expect(run.ticker().shown).toHaveLength(1);
  expect(run.page.highlights!.clip).toMatchObject({ drawer: true, shown: 1 });
});

test('Skip closes the drawer for the full list', () => {
  const run = toFirstMoment();
  run.app.tap('moments.open');
  run.app.pointerUp();
  run.app.tap('ticker.skip');
  expect(run.page.highlights!.clip).toMatchObject({
    drawer: false,
    full: true
  });
});

test('Classic mode hands the sim no clip lengths', () => {
  const run = atTicker();
  expect(run.ticker()!.lengths).toBeUndefined();
  expect(run.page.clips).toEqual([]);
});
