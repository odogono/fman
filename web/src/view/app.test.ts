import { expect, test } from 'bun:test';

import { spectrumClockHz, spectrumFrameT } from '../sim/frame-clock';
import { createJournal } from '../sim/journal';
import { creditLimit } from '../sim/management';
import { latestEnhanced } from '../sim/ruleset';
import { tickerPause } from '../sim/ticker';
import { submitInput } from '../test/input';
import type { AmountEntry } from './amount-entry';
import { createApp, type Dom, type Menu, type MenuControl } from './app';
import type { BarButton } from './context-bar';
import { createStorage, type Options } from './storage';

const frameMs = (1000 * spectrumFrameT) / spectrumClockHz;

/** The app with every browser effect replaced by an in-memory one. */
const harness = ({
  autosave,
  coarsePointer = false,
  downloadFails = false,
  options,
  storageFails = false
}: {
  autosave?: string;
  coarsePointer?: boolean;
  downloadFails?: boolean;
  /** The stored options, as the page finds them on opening. */
  options?: string;
  storageFails?: boolean;
} = {}) => {
  const stored = new Map<string, string>();
  if (autosave !== undefined) {
    stored.set('fman:autosave', autosave);
  }
  if (options !== undefined) {
    stored.set('fman:options', options);
  }
  const page = {
    amount: undefined as AmountEntry | undefined,
    applied: [] as Options[],
    bar: undefined as readonly BarButton[] | undefined,
    downloads: [] as { data: string; name: string }[],
    filesChosen: 0,
    fit: false,
    focused: 0,
    hidden: false,
    inputFocus: false,
    menu: undefined as Menu | undefined,
    menuOpen: false,
    notice: '',
    printed: 0,
    rendered: 0,
    title: ''
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
    render: ({ amount, bar, focus, title }) => {
      page.amount = amount;
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
      if (frame > 2000) {
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
  const toMenu = () => {
    for (const text of ['alex', '1', '1']) {
      type(text);
    }
    // Enhanced games' clubs wear their own kits: no colour question.
    if (view().screen === 'colours') {
      type('0');
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
    rules: 'enhanced',
    scale: 2,
    sound: false,
    touch: 'auto'
  });
  expect(JSON.parse(run.stored.get('fman:options')!)).toEqual({
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

/** A moment-highlights game at the management menu, as an autosave. */
const momentHighlightsSave = () => {
  const journal = createJournal({
    kind: 'title',
    ruleset: 'moment-highlights'
  });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', '0']) {
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
  const ticker = () => {
    const view = run.view();
    return view.screen === 'highlights' && 'ticker' in view
      ? view.ticker
      : undefined;
  };
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
  const view = reopened.view();
  expect(
    view.screen === 'highlights' && 'ticker' in view && view.ticker.shown
  ).toEqual(shown);
});
