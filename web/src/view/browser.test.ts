import { afterAll, beforeAll, expect, test } from 'bun:test';

import { GlobalRegistrator } from '@happy-dom/global-registrator';

import { createJournal } from '../sim/journal';
import { latestEnhanced } from '../sim/ruleset';
import { submitInput } from '../test/input';
import type { App } from './app';
import { createStorage } from './storage';

// The page's own input wiring, mounted in a DOM: taps and keyboard
// activation reach the app only through the buttons the page painted.

const nothing = () => {};

/** A canvas context that draws nothing. */
const noContext = () => new Proxy({}, { get: () => nothing });

beforeAll(() => {
  GlobalRegistrator.register();
  // The original's screen is painted on canvases, which the tests don't see.
  HTMLCanvasElement.prototype.getContext = noContext as never;
});

afterAll(() => GlobalRegistrator.unregister());

/** A game saved on the menu, after `inputs` there. */
const savedAt = (inputs: readonly string[] = []) => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', ...inputs]) {
    submitInput(journal, text);
  }
  return journal.snapshot();
};

type Call = readonly [name: string, ...args: unknown[]];

/**
 * The page, painted by the app from `autosave` in the given mode, with its
 * input connected to a stand-in that records each call instead.
 */
const mount = async (autosave: string, options: object) => {
  const { createApp } = await import('./app');
  const { createBrowserDom } = await import('./browser');
  document.body.innerHTML = '<div id="app"></div>';
  const { connect, dom } = createBrowserDom(document.querySelector('#app')!);
  const stored = new Map([
    ['fman:autosave', autosave],
    ['fman:options', JSON.stringify(options)]
  ]);
  const app = createApp({
    beeper: {
      click: () => {},
      muted: false,
      reset: () => {},
      restart: () => {},
      sync: () => {},
      unlock: () => undefined
    },
    clock: { now: () => 0, today: () => '2026-01-02T03:04:05.000Z' },
    dom,
    download: () => {},
    print: () => {},
    storage: createStorage(() => ({
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value)
    }))
  });
  app.tick(0);
  const calls: Call[] = [];
  connect(
    new Proxy({} as App, {
      get:
        (_, name) =>
        (...args: unknown[]) => {
          calls.push([String(name), ...args]);
          return false;
        }
    })
  );
  /** The calls an answer could come from: taps and amounts. */
  const answers = () =>
    calls.filter(([name]) => name === 'tap' || name === 'amount');
  return { answers, calls };
};

const find = (selector: string) => {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) {
    throw new Error(`Nothing matches ${selector}`);
  }
  return found;
};

const pointerDown = (target: Element, pointerType: 'mouse' | 'touch') =>
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType
    })
  );

/** A click: `detail` 0 from the keyboard, 1 from a pointer. */
const click = (target: Element, detail: 0 | 1) =>
  target.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, detail })
  );

/** A mouse tap: the press submits, so its click adds nothing. */
const mouseTap = (target: Element) => {
  pointerDown(target, 'mouse');
  click(target, 1);
};

/** A finger's tap: the press waits for the click, as a scroll might follow. */
const fingerTap = (target: Element) => {
  pointerDown(target, 'touch');
  click(target, 1);
};

const modern = { presentation: 'modern' };

test('the Home screen takes taps and keyboard activation on its choices', async () => {
  const page = await mount(savedAt(), modern);
  const status = find('#home button[data-id="menu.status"]');
  mouseTap(status);
  expect(page.answers()).toEqual([['tap', 'menu.status']]);
  fingerTap(status);
  expect(page.answers().at(-1)).toEqual(['tap', 'menu.status', 'brief']);
  click(status, 0);
  expect(page.answers().at(-1)).toEqual(['tap', 'menu.status', false]);
  expect(page.answers()).toHaveLength(3);
});

test('a Modern screen takes taps, keyboard activation and amounts', async () => {
  const page = await mount(savedAt(['l']), modern);
  const amountPane = find('#amount-prompt');
  expect(amountPane.hidden).toBe(false);
  const cancel = find('#amount-prompt button[data-id="borrow.cancel"]');
  mouseTap(cancel);
  click(cancel, 0);
  fingerTap(cancel);
  expect(page.answers()).toEqual([
    ['tap', 'borrow.cancel'],
    ['tap', 'borrow.cancel', false],
    ['tap', 'borrow.cancel', 'brief']
  ]);
  const step = find('#amount-prompt button[data-action]:not([disabled])');
  click(step, 1);
  expect(page.answers().at(-1)).toEqual([
    'amount',
    JSON.parse(step.dataset.action!)
  ]);
  expect(page.answers()).toHaveLength(4);
});

test("a press on a button's own content resolves to the button", async () => {
  const page = await mount(savedAt(), modern);
  const status = find('#home button[data-id="menu.status"]');
  const inner = document.createElement('span');
  inner.textContent = 'inside';
  status.append(inner);
  mouseTap(inner);
  expect(page.answers()).toEqual([['tap', 'menu.status']]);
});

test('content that is not a button submits nothing', async () => {
  const page = await mount(savedAt(), modern);
  const home = find('#home');
  mouseTap(home);
  fingerTap(home);
  click(home, 0);
  const text = find('#home .home-summary');
  mouseTap(text);
  fingerTap(text);
  expect(page.answers()).toEqual([]);
});

test('a button outside the pane handling the event submits nothing', async () => {
  const page = await mount(savedAt(), modern);
  // A button around the pane, as no page has: the pane is the boundary.
  const home = find('#home');
  const around = document.createElement('button');
  around.dataset.id = 'menu.status';
  home.replaceWith(around);
  around.append(home);
  const text = find('#home .home-summary');
  mouseTap(text);
  fingerTap(text);
  click(text, 0);
  expect(page.answers()).toEqual([]);
});

test('a disabled button or a typed answer is not tapped', async () => {
  const page = await mount(savedAt(), modern);
  const status = find('#home button[data-id="menu.status"]');
  status.setAttribute('disabled', '');
  mouseTap(status);
  fingerTap(status);
  status.removeAttribute('disabled');
  status.dataset.kind = 'text';
  mouseTap(status);
  fingerTap(status);
  expect(page.answers()).toEqual([]);
});

test('the Classic context bar takes taps and keyboard activation', async () => {
  const page = await mount(savedAt(), {
    presentation: 'classic',
    touch: 'on'
  });
  const bar = find('#context-bar');
  expect(bar.hidden).toBe(false);
  const status = find('#context-bar button[data-id="menu.status"]');
  const inner = document.createElement('span');
  status.append(inner);
  mouseTap(inner);
  click(status, 0);
  fingerTap(status);
  expect(page.answers()).toEqual([
    ['tap', 'menu.status'],
    ['tap', 'menu.status', false],
    ['tap', 'menu.status', 'brief']
  ]);
  mouseTap(bar);
  expect(page.answers()).toHaveLength(3);
});
