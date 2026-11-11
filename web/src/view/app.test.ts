import { expect, test } from 'bun:test';

import { spectrumClockHz, spectrumFrameT } from '../sim/frame-clock';
import { createApp, type Dom, type Menu, type MenuControl } from './app';
import { createStorage, type Options } from './storage';

const frameMs = (1000 * spectrumFrameT) / spectrumClockHz;

/** The app with every browser effect replaced by an in-memory one. */
const harness = ({
  autosave,
  downloadFails = false,
  storageFails = false
}: {
  autosave?: string;
  downloadFails?: boolean;
  storageFails?: boolean;
} = {}) => {
  const stored = new Map<string, string>();
  if (autosave !== undefined) {
    stored.set('fman:autosave', autosave);
  }
  const page = {
    applied: [] as Options[],
    downloads: [] as { data: string; name: string }[],
    filesChosen: 0,
    menu: undefined as Menu | undefined,
    menuOpen: false,
    notice: '',
    printed: 0,
    rendered: 0
  };
  const dom: Dom = {
    applyOptions: options => page.applied.push(options),
    chooseFile: () => page.filesChosen++,
    closeMenu: () => {
      page.menuOpen = false;
    },
    focusInput: () => {},
    hidden: false,
    notice: text => {
      page.notice = text;
    },
    openMenu: () => {
      page.menuOpen = true;
    },
    render: () => {
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
    for (const text of ['alex', '1', '1', '0']) {
      type(text);
    }
    settle();
    expect(view().screen).toBe('menu');
  };
  return {
    app,
    beeper,
    control,
    page,
    press,
    settle,
    stored,
    toMenu,
    type,
    view
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
  expect(run.page.applied.at(-1)).toEqual({ scale: 2, sound: false });
  expect(JSON.parse(run.stored.get('fman:options')!)).toEqual({
    scale: 2,
    sound: false
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

const escape = {
  code: 'Escape',
  inputFocused: true,
  key: 'Escape',
  modified: false,
  repeat: false
};
