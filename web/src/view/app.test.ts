import { expect, test } from 'bun:test';

import { spectrumClockHz, spectrumFrameT } from '../sim/frame-clock';
import { createJournal } from '../sim/journal';
import { creditLimit } from '../sim/management';
import { latestEnhanced } from '../sim/ruleset';
import { tickerPause } from '../sim/ticker';
import { submitInput } from '../test/input';
import type { AmountEntry } from './amount-entry';
import { answersFor } from './answers';
import { createApp, type Dom, type Menu, type MenuControl } from './app';
import type { BarButton } from './context-bar';
import type { Home } from './home';
import type { ModernHighlights } from './modern-highlights';
import type { PickTeam } from './pick-team';
import { createStorage, type Options } from './storage';

const frameMs = (1000 * spectrumFrameT) / spectrumClockHz;

/** The app with every browser effect replaced by an in-memory one. */
const harness = ({
  autosave,
  coarsePointer = false,
  downloadFails = false,
  firstVisit = false,
  options,
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
    applied: [] as Options[],
    atHome: false,
    bar: undefined as readonly BarButton[] | undefined,
    downloads: [] as { data: string; name: string }[],
    filesChosen: 0,
    fit: false,
    focused: 0,
    hidden: false,
    highlights: undefined as ModernHighlights | undefined,
    home: undefined as Home | undefined,
    inputFocus: false,
    menu: undefined as Menu | undefined,
    menuOpen: false,
    notice: '',
    pickTeam: undefined as PickTeam | undefined,
    printed: 0,
    rendered: 0,
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
    render: ({
      amount,
      atHome,
      bar,
      focus,
      highlights,
      home,
      pickTeam,
      title,
      typing
    }) => {
      page.amount = amount;
      page.highlights = highlights;
      page.pickTeam = pickTeam;
      page.atHome = atHome;
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
  // Screens without a Modern design show the bar, without the original's keys.
  expect(run.labels()).toEqual(['Continue']);
  run.tap('Continue');
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
  const offered = run.page.bar!;
  const next =
    offered.find(b => b.answer.id.endsWith('.continue')) ??
    offered.find(b => b.answer.id === 'transfer.decline') ??
    offered.find(b => b.answer.id === 'sale.no');
  run.tap(next!.label);
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
  expect(run.page.amount?.typing).toBe('120');
  key(run, 'Enter');
  expect(run.page.amount).toMatchObject({ typing: undefined, value: 120 });
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
  playOut(run);
  expect(run.page.highlights).toBeUndefined();
});

test('Hold to hurry is live only in timed pauses, and holds a key until the finger lifts', () => {
  const run = harness({
    options: JSON.stringify({ presentation: 'modern', rules: 'original' })
  });
  kickOff(run);
  const seen = { drawing: false, outcome: false };
  for (let i = 0; i < 20_000 && !run.page.highlights?.pitch?.hurry; i++) {
    expect(run.view().screen).toBe('highlights');
    seen.drawing ||= run.page.highlights!.pitch!.hurry === false;
    seen.outcome ||= run.page.highlights!.pitch!.outcome !== undefined;
    run.wait(1);
  }
  expect(seen.drawing).toBe(true);
  expect(run.page.highlights!.pitch!.hurry).toBe(true);
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

test('Modern mode shows moment highlights as a ticker, newest first, with Skip', () => {
  const run = harness({
    autosave: momentHighlightsSave(),
    options: modernOptions
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
  run.wait(1);
  expect(run.view().screen).toBe('highlights');
  expect(run.page.bar).toBeUndefined();
  expect(run.page.highlights!.pitch).toBeUndefined();
  expect(run.page.highlights!.ticker!.skip).toBe(true);
  run.wait(5);
  run.app.tap('ticker.skip');
  const ticker = run.page.highlights!.ticker!;
  const view = run.view();
  if (view.screen !== 'highlights' || !('ticker' in view)) {
    throw new Error('No ticker');
  }
  expect(ticker.lines).toHaveLength(view.ticker.shown.length);
  expect(ticker.lines[0]!.minute).toBe(`${view.ticker.shown.at(-1)!.minute}′`);
  expect(run.page.highlights!.score).toEqual(view.ticker.score);
  run.wait(tickerPause + 10);
  expect(run.view().screen).toBe('result');
  expect(run.page.highlights).toBeUndefined();
});
