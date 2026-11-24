import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';

import { GlobalRegistrator } from '@happy-dom/global-registrator';

import { createJournal } from '../sim/journal';
import { offeredAnswers } from '../sim/offers';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { playTo } from '../test/play';
import { tickerBar } from './context-bar';
import { homeFor } from './home';
import { continueId } from './modern-highlights';
import {
  modernScreenFor,
  type ModernScreen,
  type ModernScreenKind
} from './modern-screen';
import type { ModernView } from './modern-view';

// Modern screens shown in a DOM, straight from a view or a literal screen,
// without the page or the app around them.

const nothing = () => {};

/** A canvas context that draws nothing. */
const noContext = () => new Proxy({}, { get: () => nothing });

let createModernView: typeof import('./modern-view').createModernView;
let answerOf: typeof import('./modern-view').answerOf;
let tapOf: typeof import('./modern-view').tapOf;

beforeAll(async () => {
  GlobalRegistrator.register();
  HTMLCanvasElement.prototype.getContext = noContext as never;
  ({ answerOf, createModernView, tapOf } = await import('./modern-view'));
});

afterAll(() => GlobalRegistrator.unregister());

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.className = '';
});

/** The module's panes, placed in the body. */
const mount = (clipsUnpainted = true): ModernView => {
  const view = createModernView({
    clipsUnpainted: () => clipsUnpainted,
    layoutRoot: document.documentElement,
    reducedMotion: () => false
  });
  document.body.append(view.home, ...view.panes);
  return view;
};

/** The panes on show. */
const shown = () => [
  ...document.body.querySelectorAll<HTMLElement>(':scope > :not([hidden])')
];

/** A new Enhanced game at the menu, then `inputs`. */
const after = (...inputs: string[]): View => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of inputs) {
    submitInput(journal, text);
  }
  return journal.session.view;
};

const atMenu = (...inputs: string[]) => after('alex', '1', '1', ...inputs);

const seller = () =>
  atMenu('a').game!.players.find(p => p.status > 0 && p.status !== 3)!;

/** A view that shows each kind of Modern screen. */
const viewFor: Record<ModernScreenKind, () => View> = {
  amount: () => atMenu('l'),
  bills: () => playTo('bills'),
  'cup-replay': () => ({ ...playTo('cup-result'), screen: 'replay' }),
  'cup-result': () => playTo('cup-result'),
  'end-of-season': () => playTo('end-season'),
  fixture: () => playTo('fixture'),
  'full-time': () => playTo('result'),
  highlights: () => playTo('highlights'),
  home: () => atMenu(),
  'league-table': () => playTo('table'),
  message: () => atMenu('l', '5000'),
  names: () => atMenu('change'),
  'pick-team': () => playTo('team'),
  'sale-offer': () => atMenu('a', String(seller().id)),
  'season-summary': () => playTo('season-summary'),
  setup: () => after(),
  status: () => atMenu('s'),
  'week-results': () => playTo('other-matches')
};

const kinds = Object.keys(viewFor) as ModernScreenKind[];

test.each(kinds)(
  'every enabled button on the %s screen is an offered answer or a view control',
  kind => {
    const view = viewFor[kind]();
    const screen = modernScreenFor(view);
    expect(screen?.kind).toBe(kind);
    const modern = mount();
    modern.show(
      screen,
      view.game && kind === 'home'
        ? homeFor({ ...view, game: view.game })
        : undefined
    );
    const offered = offeredAnswers(view);
    // With them, Skip all and Continue, the keypresses the app makes itself
    // during the highlights.
    const ids = new Set([
      ...offered.map(answer => answer.id),
      tickerBar[0]!.answer.id,
      continueId
    ]);
    const buttons = shown().flatMap(pane => [
      ...pane.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    ]);
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      const tap = tapOf(button);
      const what =
        tap?.kind === 'answer'
          ? ids.has(tap.id) || button.dataset.viewControl !== undefined
          : tap
            ? // The amount's stepper, and the game menu: view controls.
              true
            : // A name form's submit, where the prompt takes free text.
              button.type === 'submit' &&
              offered.some(answer => answer.kind === 'text');
      expect([button.textContent, what]).toEqual([button.textContent, true]);
    }
  },
  30_000
);

test('a screen shows in its own pane, with its layout classes, and alone', () => {
  const modern = mount();
  const status = modernScreenFor(atMenu('s'))!;
  modern.show(status, undefined);
  expect(shown().map(pane => pane.id)).toEqual(['status']);
  expect(document.documentElement.classList.contains('has-status')).toBe(true);
  const amount = modernScreenFor(atMenu('l'))!;
  modern.show(amount, undefined);
  expect(shown().map(pane => pane.id)).toEqual(['amount-prompt']);
  expect(document.documentElement.classList.contains('has-status')).toBe(false);
  expect(document.documentElement.classList.contains('has-amount')).toBe(true);
  modern.show(undefined, undefined);
  expect(shown()).toEqual([]);
  expect(document.documentElement.className).toBe('');
});

test('each pane is placed once, the Home pane apart from the rest', () => {
  const modern = mount();
  const ids = modern.panes.map(pane => pane.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).not.toContain('home');
  expect(modern.home.id).toBe('home');
});

const setup = (): ModernScreen => ({
  kind: 'setup',
  setup: { kind: 'manager', maxLength: 12 }
});

const typeName = (text: string) => {
  const input = document.querySelector<HTMLInputElement>(
    '#setup input[name=name]'
  )!;
  input.value = text;
  return input;
};

test("the manager's name keeps what was typed across repaints, and the answer is the name", () => {
  const modern = mount();
  modern.show(setup(), undefined);
  const input = typeName('Alex');
  expect(document.activeElement).toBe(input);
  // A repaint, as at every frame, from an equal screen.
  modern.show(setup(), undefined);
  expect(document.querySelector('#setup input[name=name]')).toBe(input);
  expect(input.value).toBe('Alex');
  expect(answerOf(input.form!)).toBe('Alex');
});

test("a new game's manager name starts empty, not with the last one typed", () => {
  const modern = mount();
  modern.show(setup(), undefined);
  typeName('Alex');
  // Away to the menu and back to a new game's first screen.
  modern.show(modernScreenFor(atMenu())!, undefined);
  modern.show(setup(), undefined);
  expect(
    document.querySelector<HTMLInputElement>('#setup input[name=name]')!.value
  ).toBe('');
});

const rename = (error?: string): ModernScreen => ({
  kind: 'names',
  names: {
    colour: 2,
    colours: [
      { ink: 1, name: 'Blue' },
      { ink: 2, name: 'Red' }
    ],
    current: { ink: 2, name: 'Arsenal', paper: 7 },
    ...(error ? { error } : {}),
    kind: 'rename',
    loses: false,
    maxLength: { coloured: 10, plain: 12 },
    target: 'club'
  }
});

test('a rename keeps what was typed until the original refuses it, and answers in the colour picked', () => {
  const modern = mount();
  modern.show(rename(), undefined);
  const input = document.querySelector<HTMLInputElement>(
    '#names input[name=name]'
  )!;
  input.value = 'Gunners';
  document.querySelector<HTMLInputElement>('input[value="1"]')!.click();
  modern.show(rename(), undefined);
  expect(document.querySelector('#names input[name=name]')).toBe(input);
  expect(answerOf(input.form!)).toBe(`${String.fromCharCode(16, 1)}Gunners`);
  document.querySelector<HTMLInputElement>('input[value="plain"]')!.click();
  expect(answerOf(input.form!)).toBe('Gunners');
  // A refused name rebuilds the form, with the original's message.
  modern.show(rename('INVALID TEAM NAME'), undefined);
  expect(document.querySelector('#names input[name=name]')).not.toBe(input);
  expect(document.querySelector('.names-error')?.textContent).toBe(
    'INVALID TEAM NAME'
  );
});

/** The clips' highlights at kick-off, playing or paused. */
const clipsScreen = (view: View, paused: boolean) =>
  modernScreenFor(view, {
    clips: {
      progress: {
        drawer: false,
        full: false,
        heard: 0,
        paused,
        shown: 0,
        tab: 'moments',
        unseen: false
      },
      score: [0, 0]
    }
  });

test('a rebuilt pane keeps focus on the view control that had it', () => {
  const modern = mount(false);
  const view = playTo('highlights');
  modern.show(clipsScreen(view, false), undefined);
  const pause = document.querySelector<HTMLElement>(
    '[data-view-control="clips.play"]'
  )!;
  expect(pause.getAttribute('aria-label')).toBe('Pause');
  pause.focus();
  modern.show(clipsScreen(view, true), undefined);
  const play = document.querySelector<HTMLElement>(
    '[data-view-control="clips.play"]'
  );
  expect(play).not.toBe(pause);
  expect(play?.getAttribute('aria-label')).toBe('Play');
  expect(document.activeElement).toBe(play);
});

test('the clip canvas is the same node across rebuilds', () => {
  const modern = mount(false);
  const view = playTo('highlights');
  modern.show(clipsScreen(view, false), undefined);
  expect(modern.clipPitch.isConnected).toBe(true);
  modern.show(clipsScreen(view, true), undefined);
  expect(document.querySelectorAll('canvas.clip-pitch')).toHaveLength(1);
  expect(document.querySelector('canvas.clip-pitch')).toBe(modern.clipPitch);
});

test('without WebGL the cup won shows its banner, and the celebration presses the screen while it plays', () => {
  const decided = playTo('cup-result');
  const won = modernScreenFor({
    ...decided,
    celebration: 1,
    celebrationProgress: { stars: 0, text: 0, trophy: 40 },
    game: { ...decided.game, cupFinished: true, cupRound: 8 },
    score: decided.fixture.home ? [1, 0] : [0, 1],
    screen: 'cup-celebration'
  } as View);
  expect(won?.kind).toBe('cup-result');
  const banner = mount(true);
  banner.show(won, undefined);
  expect(document.querySelector('canvas.cup-scene')).toBeNull();
  document.body.replaceChildren();
  const scene = mount(false);
  scene.show(won, undefined);
  const canvas = document.querySelector('canvas.cup-scene')!;
  expect(canvas).not.toBeNull();
  expect(scene.pressesScreen(canvas)).toBe(true);
  expect(scene.pressesScreen(scene.pitch)).toBe(true);
  expect(scene.pressesScreen(scene.home)).toBe(false);
});
