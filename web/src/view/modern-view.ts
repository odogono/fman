import type { AmountAction } from './amount-entry';
import {
  paintCupReplay,
  paintCupResult,
  paintCupScene
} from './cup-screens-paint';
import { paintFullTime } from './full-time-paint';
import type { Home } from './home';
import { paintHome } from './home-paint';
import { paintLeagueTable, paintWeekResults } from './league-screens-paint';
import { paintAmount } from './modern-amount-paint';
import { paintBills } from './modern-bills-paint';
import { paintFixture } from './modern-fixture-paint';
import { paintHighlights } from './modern-highlights-paint';
import { paintMessage } from './modern-message-paint';
import type { ModernScreen, ModernScreenKind } from './modern-screen';
import { paintStatus } from './modern-status-paint';
import { renameAnswer } from './name-screens';
import { paintNames } from './name-screens-paint';
import { paintPickTeam } from './pick-team-paint';
import { paintSaleOffer } from './sale-offer-paint';
import { paintEndOfSeason, paintSeasonSummary } from './season-end-paint';
import { paintSetup } from './setup-screens-paint';

export type ModernViewDeps = Readonly<{
  /** The browser can't paint the clips, having no WebGL (ADR 0018). */
  clipsUnpainted: () => boolean;
  /** The element whose classes the page's layout keys on. */
  layoutRoot: HTMLElement;
  /** The browser asks for less motion. */
  reducedMotion: () => boolean;
}>;

/** What a tap on a Modern screen's button, or the context bar's, does. */
export type Tap =
  /** Submits an offered answer, or works a view control, by its id. */
  | Readonly<{ id: string; kind: 'answer'; text: boolean }>
  /** Changes the amount being entered, not the game. */
  | Readonly<{ action: AmountAction; kind: 'amount' }>
  /** Opens the game menu. */
  | Readonly<{ kind: 'menu' }>;

/** The tap a button stands for, from the attributes its painter gave it. */
export const tapOf = (button: HTMLButtonElement): Tap | undefined => {
  if (button.dataset.action) {
    return {
      action: JSON.parse(button.dataset.action) as AmountAction,
      kind: 'amount'
    };
  }
  if (button.dataset.id) {
    return {
      id: button.dataset.id,
      kind: 'answer',
      text: button.dataset.kind === 'text'
    };
  }
  if (button.classList.contains('scoreboard-menu')) {
    return { kind: 'menu' };
  }
  return undefined;
};

/**
 * The answer a submitted name form gives: the manager's name, or a new
 * name in the colour picked.
 */
export const answerOf = (form: HTMLFormElement) => {
  const input = form.querySelector<HTMLInputElement>('input[name=name]');
  if (!input) {
    return undefined;
  }
  const ink = form.querySelector<HTMLInputElement>('input[name=ink]:checked');
  return form.classList.contains('names-rename')
    ? renameAnswer(
        input.value,
        !ink || ink.value === 'plain' ? 'plain' : Number(ink.value)
      )
    : input.value;
};

type Pane<K extends ModernScreenKind> = Readonly<{
  /** The root classes the page's layout keys on while it shows. */
  classes: readonly string[];
  /**
   * What the screen's markup is built from, by default the whole screen.
   * While it holds, a repaint keeps the markup, and with it any typing.
   */
  key?: (screen: Extract<ModernScreen, { kind: K }>) => unknown;
  paint: (
    pane: HTMLElement,
    screen: Extract<ModernScreen, { kind: K }>
  ) => void;
  /** Its pane; two kinds may share one. */
  pane: HTMLElement;
  /** Brings kept markup up to date, after any rebuild. */
  update?: (
    pane: HTMLElement,
    screen: Extract<ModernScreen, { kind: K }>
  ) => void;
}>;

const section = (
  id: string,
  className: string,
  label: string,
  role?: string
) => {
  const element = document.createElement('section');
  element.id = id;
  element.className = className;
  element.setAttribute('aria-label', label);
  if (role) {
    element.setAttribute('role', role);
  }
  element.hidden = true;
  return element;
};

/**
 * The view control focused after a rebuild, given the one focused before:
 * the same one, or the latest line once the moments drawer has closed.
 */
const focusFallback: Readonly<Record<string, string>> = { close: 'latest' };

/**
 * Modern mode's screens: a pane for each, built here and placed on the page
 * by its owner, which shows a Modern screen and the Home screen in them.
 */
export const createModernView = (deps: ModernViewDeps) => {
  const home = document.createElement('div');
  home.id = 'home';
  home.className = 'home';
  home.hidden = true;
  const pick = section('pick-team', 'pick-team', 'Pick team');
  const highlights = section(
    'highlights',
    'modern-highlights',
    'Match highlights'
  );
  const status = section('status', 'modern-status', 'Club status');
  const amount = section('amount-prompt', 'modern-amount', 'Amount');
  const weekResults = section(
    'week-results',
    'modern-amount modern-week-results',
    'Results'
  );
  const leagueTable = section(
    'league-table',
    'modern-amount modern-league-table',
    'League table'
  );
  const bills = section('bills', 'modern-amount modern-bills', 'Weekly bills');
  const cupResult = section(
    'cup-result',
    'modern-amount modern-cup',
    'Cup result'
  );
  const cupReplay = section(
    'cup-replay',
    'modern-amount modern-cup',
    'Cup replay'
  );
  const fixture = section(
    'next-fixture',
    'modern-amount modern-fixture',
    'Next fixture'
  );
  const endOfSeason = section(
    'end-of-season',
    'modern-amount modern-season',
    'End of season'
  );
  const seasonSummary = section(
    'season-summary',
    'modern-amount modern-season',
    'Season summary'
  );
  const sale = section('sale-offer', 'modern-amount modern-sale', 'Sale offer');
  const setup = section('setup', 'modern-amount modern-setup', 'New game');
  const names = section(
    'names',
    'modern-amount modern-setup modern-names',
    'Change names'
  );
  const fullTime = section(
    'full-time',
    'modern-amount modern-full-time',
    'Full time'
  );
  const message = section(
    'message',
    'modern-amount modern-message',
    'Message',
    'status'
  );

  // Modern mode's own pitch for the original's attacks, kept between them
  // as the original's is not; its owner paints it.
  const pitch = document.createElement('canvas');
  pitch.className = 'modern-pitch';
  pitch.width = 256;
  pitch.height = 176;
  pitch.setAttribute('role', 'img');
  // The sprite highlights' pitch (#144), at the screen's resolution.
  const clipPitch = document.createElement('canvas');
  clipPitch.className = 'clip-pitch';
  clipPitch.setAttribute('role', 'img');
  clipPitch.setAttribute('aria-label', 'Pitch');
  // How far the clip on show has got, with a tick at its moment.
  const clipBar = document.createElement('div');
  clipBar.className = 'clip-progress';
  clipBar.setAttribute('aria-hidden', 'true');

  const scene = () => !deps.clipsUnpainted();
  const panes: { [K in ModernScreenKind]: Pane<K> } = {
    amount: {
      classes: ['has-amount'],
      paint: (pane, screen) => paintAmount(pane, screen.amount),
      pane: amount
    },
    bills: {
      classes: ['has-amount'],
      paint: (pane, screen) => paintBills(pane, screen.bills),
      pane: bills
    },
    'cup-replay': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintCupReplay(pane, screen.cupReplay),
      pane: cupReplay
    },
    // The scene's canvas stays put while it plays, so painting each frame
    // doesn't rebuild the screen.
    'cup-result': {
      classes: ['has-amount'],
      key: ({ cupResult: result }) => [
        result.title,
        result.headline,
        result.outcome,
        result.tie,
        result.done,
        Boolean(result.celebration) && scene()
      ],
      paint: (pane, screen) => paintCupResult(pane, screen.cupResult, scene()),
      pane: cupResult,
      update: (pane, screen) =>
        paintCupScene(pane, screen.cupResult, scene(), deps.reducedMotion())
    },
    'end-of-season': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintEndOfSeason(pane, screen.endOfSeason),
      pane: endOfSeason
    },
    fixture: {
      classes: ['has-amount'],
      paint: (pane, screen) => paintFixture(pane, screen.fixture),
      pane: fixture
    },
    'full-time': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintFullTime(pane, screen.fullTime),
      pane: fullTime
    },
    highlights: {
      classes: ['at-highlights'],
      paint: (pane, screen) =>
        paintHighlights(pane, pitch, clipPitch, clipBar, screen.highlights),
      pane: highlights
    },
    // Beside the Home pane, the status shows while the menu waits.
    home: {
      classes: ['at-home', 'has-status'],
      paint: (pane, screen) => paintStatus(pane, screen.status),
      pane: status
    },
    'league-table': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintLeagueTable(pane, screen.table),
      pane: leagueTable
    },
    message: {
      classes: ['has-amount'],
      paint: (pane, screen) => paintMessage(pane, screen.message),
      pane: message
    },
    // Kept while the same name is being changed, so typing isn't lost; a
    // refused name brings its message.
    names: {
      classes: ['has-amount'],
      key: ({ names: shown }) =>
        shown.kind === 'rename'
          ? [shown.kind, shown.target, shown.current, shown.error]
          : shown,
      paint: (pane, screen) => paintNames(pane, screen.names),
      pane: names
    },
    'pick-team': {
      classes: ['at-pick-team'],
      paint: (pane, screen) => paintPickTeam(pane, screen.pickTeam),
      pane: pick
    },
    'sale-offer': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintSaleOffer(pane, screen.offer),
      pane: sale
    },
    'season-summary': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintSeasonSummary(pane, screen.summary),
      pane: seasonSummary
    },
    // The manager's name is kept while it shows, so typing isn't lost.
    setup: {
      classes: ['has-amount'],
      key: ({ setup: shown }) =>
        shown.kind === 'manager' ? shown.kind : shown,
      paint: (pane, screen) => paintSetup(pane, screen.setup),
      pane: setup
    },
    status: {
      classes: ['has-status'],
      paint: (pane, screen) => paintStatus(pane, screen.status),
      pane: status
    },
    'week-results': {
      classes: ['has-amount'],
      paint: (pane, screen) => paintWeekResults(pane, screen.weekResults),
      pane: weekResults
    }
  };
  const modernPanes = [
    ...new Set(Object.values(panes).map(({ pane }) => pane))
  ];
  const classes = new Set(
    Object.values(panes).flatMap(({ classes: names }) => names)
  );

  /** What each pane on show was last shown and built from. */
  const shownOn = new Map<HTMLElement, string>();
  const builtOn = new Map<HTMLElement, string>();

  /**
   * Builds `pane` again unless `key` matches what it was built from,
   * focusing the same view control afterwards.
   */
  const build = (pane: HTMLElement, key: string, paint: () => void) => {
    if (builtOn.get(pane) === key) {
      return;
    }
    builtOn.set(pane, key);
    const before = pane.contains(document.activeElement)
      ? document.activeElement?.closest<HTMLElement>('[data-view-control]')
          ?.dataset.viewControl
      : undefined;
    paint();
    if (!before) {
      return;
    }
    const control = (id: string) =>
      pane.querySelector<HTMLElement>(`button[data-view-control="${id}"]`);
    const fallback = focusFallback[before];
    (control(before) ?? (fallback ? control(fallback) : null))?.focus({
      preventScroll: true
    });
  };

  /** Hides `pane`; it is built afresh when it shows again. */
  const hide = (pane: HTMLElement) => {
    pane.hidden = true;
    shownOn.delete(pane);
    builtOn.delete(pane);
  };

  const showScreen = <K extends ModernScreenKind>(
    screen: Extract<ModernScreen, { kind: K }>
  ) => {
    const spec = panes[screen.kind as K];
    const { pane } = spec;
    pane.hidden = false;
    const shown = JSON.stringify(screen);
    if (shownOn.get(pane) === shown) {
      return;
    }
    shownOn.set(pane, shown);
    build(
      pane,
      JSON.stringify([screen.kind, spec.key ? spec.key(screen) : screen]),
      () => spec.paint(pane, screen)
    );
    spec.update?.(pane, screen);
  };

  return {
    /** The clip's progress bar, set as each frame is painted. */
    clipBar,
    /** The canvas the clips are painted on. */
    clipPitch,
    /** The Home pane, placed before the original screen. */
    home,
    /** The other panes, in the order the page places them. */
    panes: modernPanes,
    /** The canvas the original's attacks are painted on. */
    pitch,
    /** A press here shortens the original's pauses, as on its screen. */
    pressesScreen: (target: Element) =>
      target === pitch || Boolean(target.closest('.celebrating')),
    /**
     * Shows `screen` in its pane, and `homeScreen` in the Home pane; either
     * may be absent. A pane is built again only when what it shows
     * changes, keeping what was typed into it and the view control focused.
     */
    show: (screen: ModernScreen | undefined, homeScreen: Home | undefined) => {
      if (homeScreen) {
        home.hidden = false;
        build(home, JSON.stringify(homeScreen), () =>
          paintHome(home, homeScreen)
        );
      } else {
        hide(home);
      }
      const active = screen && panes[screen.kind].pane;
      for (const pane of modernPanes) {
        if (pane !== active) {
          hide(pane);
        }
      }
      if (screen) {
        showScreen(screen);
      }
      const on = screen ? panes[screen.kind].classes : [];
      for (const name of classes) {
        deps.layoutRoot.classList.toggle(name, on.includes(name));
      }
    }
  };
};

export type ModernView = ReturnType<typeof createModernView>;
