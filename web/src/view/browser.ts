import { version } from '../../../package.json';
import { fixtureSides } from '../sim/league';
import { flashPhase, type View } from '../sim/session';
import type { AmountEntry } from './amount-entry';
import type { App, Dom, MenuControl } from './app';
import { canPaintClips, fitClipCanvas } from './clip-canvas';
import { paintShot } from './clip-wipe';
import type { BarButton } from './context-bar';
import { rasterText, rasterizeCells } from './glyphs';
import { answerOf, createModernView, tapOf } from './modern-view';
import { amountPanel } from './paint-parts';
import { paintAttack, paintEmptyPitch } from './pitch';
import { tickerLines, tickerText } from './ticker-layout';

// The commit the site build stamps in; `bun run dev` leaves it undefined.
declare const FMAN_COMMIT: string | undefined;
const commit = typeof FMAN_COMMIT === 'string' ? FMAN_COMMIT : '';
const versionLabel = commit ? `v${version} · ${commit}` : `v${version}`;

/** Offers `data` as a file download; throws when the browser refuses. */
export const downloadFile = (name: string, data: string) => {
  const url = URL.createObjectURL(
    new Blob([data], { type: 'application/json' })
  );
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

const control = (item: MenuControl) => {
  switch (item.kind) {
    case 'button': {
      const element = document.createElement('button');
      element.type = 'button';
      element.textContent = item.label;
      element.disabled = item.disabled;
      element.addEventListener('click', item.action);
      return element;
    }
    case 'toggle': {
      const label = document.createElement('label');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = item.checked;
      toggle.addEventListener('change', () => item.change(toggle.checked));
      label.append(toggle, ` ${item.label}`);
      return label;
    }
    case 'select': {
      const label = document.createElement('label');
      const select = document.createElement('select');
      for (const [value, text] of item.choices) {
        select.append(new Option(text, value, false, item.value === value));
      }
      select.addEventListener('change', () => item.change(select.value));
      label.append(`${item.label} `, select);
      return label;
    }
    case 'list': {
      const list = document.createElement('ul');
      list.className = 'menu-list';
      list.setAttribute('aria-label', item.label);
      for (const text of item.items) {
        const entry = document.createElement('li');
        entry.textContent = text;
        list.append(entry);
      }
      return list;
    }
    case 'choice': {
      const group = document.createElement('fieldset');
      group.className = 'menu-choice';
      const legend = document.createElement('legend');
      legend.textContent = item.label;
      group.append(legend);
      for (const choice of item.choices) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `menu-${item.label}`;
        radio.value = choice.value;
        radio.checked = choice.value === item.value;
        radio.addEventListener('change', () => item.change(choice.value));
        const text = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = choice.text;
        const description = document.createElement('small');
        description.textContent = choice.description;
        text.append(name, description);
        label.append(radio, text);
        group.append(label);
      }
      return group;
    }
  }
};

/**
 * The button an event came from, if it lies within the element handling the
 * event: the context bar, the Home screen or a Modern screen's pane.
 */
const paneButton = (event: Event) => {
  const pane = event.currentTarget as Node | null;
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  return button && pane?.contains(button) ? button : undefined;
};

/** Builds the page inside `app` and returns the app's view of it. */
export const createBrowserDom = (app: HTMLElement) => {
  app.innerHTML = `
  <h1 class="sr-only">Football Manager</h1>
  <header class="top-bar">
    <button id="menu-button" class="menu-button" type="button" aria-haspopup="dialog" aria-label="Game menu" title="Game menu">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" /></svg>
    </button>
    <p id="screen-title" class="screen-title"></p>
  </header>
  <section class="machine" aria-label="ZX Spectrum Football Manager">
    <canvas id="screen" width="256" height="176" aria-hidden="true"></canvas><canvas id="pitch" width="256" height="176" aria-hidden="true" hidden></canvas>
    <form id="entry" autocomplete="off">
      <canvas id="entry-display" width="256" height="16" aria-hidden="true"></canvas>
      <label for="command" id="prompt"></label><input id="command" name="command" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="256" />
    </form>
  </section>
  <div id="context-bar" class="context-bar" aria-label="Answers" hidden></div>
  <pre id="transcript" class="sr-only" aria-live="polite" aria-atomic="true"></pre>
  <p id="ticker-live" class="sr-only" aria-live="polite"></p>
  <p class="build-note">Play league and cup matches, edit names and manage your club.<br />Play resumes where you left it. Press Esc or the menu button to save, load or start again.</p>
  <p id="notice" class="notice" role="status"></p>
  <p class="version">${versionLabel}</p>
  <dialog id="game-menu" class="game-menu" aria-labelledby="game-menu-title"></dialog>
  <input id="load-save" type="file" accept=".json,.fman.json" hidden />
`;
  const find = <T extends HTMLElement>(selector: string) =>
    app.querySelector<T>(selector)!;
  const screen = find<HTMLCanvasElement>('#screen');
  const screenContext = screen.getContext('2d')!;
  const entryContext =
    find<HTMLCanvasElement>('#entry-display').getContext('2d')!;
  const form = find<HTMLFormElement>('#entry');
  const input = find<HTMLInputElement>('#command');
  const prompt = find<HTMLElement>('#prompt');
  const transcript = find<HTMLElement>('#transcript');
  const tickerLive = find<HTMLElement>('#ticker-live');
  const notice = find<HTMLElement>('#notice');
  const menuButton = find<HTMLButtonElement>('#menu-button');
  const menu = find<HTMLDialogElement>('#game-menu');
  const loadInput = find<HTMLInputElement>('#load-save');
  const screenTitle = find<HTMLElement>('#screen-title');
  const pitch = find<HTMLCanvasElement>('#pitch');
  const pitchContext = pitch.getContext('2d')!;
  const machine = find<HTMLElement>('.machine');
  const bar = find<HTMLElement>('#context-bar');
  const modernView = createModernView({
    clipsUnpainted: () => dom.clipsUnpainted,
    layoutRoot: document.documentElement,
    reducedMotion: () => dom.reducedMotion
  });
  machine.before(modernView.home);
  bar.before(...modernView.panes);
  const { clipBar, clipPitch, pitch: modernPitch } = modernView;
  const modernPitchContext = modernPitch.getContext('2d')!;
  // A wide window, as the stylesheet has it (#257).
  const wideWindow = matchMedia(
    '(min-width: 900px) and (min-aspect-ratio: 1) and (min-height: 501px)'
  );
  /**
   * On a wide window, the original's pitch at the largest whole multiple
   * of its 256 by 176 pixels that fits beside the strengths and under the
   * scoreboard, so its pixels stay crisp (#257). Elsewhere the stylesheet
   * sizes it.
   */
  const fitOriginalPitch = () => {
    if (!wideWindow.matches || !modernPitch.isConnected) {
      modernPitch.style.width = '';
      return;
    }
    const board =
      modernPitch.parentElement?.querySelector<HTMLElement>('.strip-scoreboard')
        ?.offsetHeight ?? 40;
    const wide = innerWidth - 16 - 280 - 24;
    const high = innerHeight - 16 - board - 6;
    const times = Math.max(1, Math.floor(Math.min(wide / 256, high / 176)));
    modernPitch.style.width = `${256 * times}px`;
  };
  addEventListener('resize', fitOriginalPitch);
  let modernPitchFor: unknown;
  const clipContext = clipPitch.getContext('2d')!;
  let barKey = '';

  const paintBar = (
    buttons: readonly BarButton[] | undefined,
    amount: AmountEntry | undefined
  ) => {
    bar.hidden = !buttons;
    const key = JSON.stringify([
      buttons?.map(b => [b.answer.id, b.label]),
      amount
    ]);
    if (!buttons || key === barKey) {
      return;
    }
    // A new prompt without a typed answer closes the soft keyboard.
    if (
      document.activeElement === input &&
      buttons.every(button => button.answer.kind !== 'text')
    ) {
      input.blur();
    }
    // Keep the bar's height while nothing is offered, so the page holds still.
    bar.style.minHeight = buttons.length ? '' : `${bar.offsetHeight}px`;
    barKey = key;
    bar.replaceChildren(
      ...(amount ? amountPanel(amount) : []),
      ...buttons.map(button => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = button.label;
        element.dataset.id = button.answer.id;
        element.dataset.kind = button.answer.kind;
        element.className = `${button.tone}${button.wide ? ' wide' : ''}`;
        return element;
      })
    );
  };

  /**
   * Paints the attack on Modern mode's pitch. Between attacks, where the
   * original shows its text screen, the last frame stays; before the first,
   * the empty pitch.
   */
  const paintModernPitch = (view: View & { screen: 'highlights' }) => {
    if (view.highlights.kind !== 'attacks') {
      return;
    }
    fitOriginalPitch();
    const playback = view.highlights.timeline;
    const current = playback.current;
    const fresh = modernPitchFor !== playback;
    modernPitchFor = playback;
    if (!current) {
      if (fresh) {
        paintEmptyPitch(modernPitchContext);
      }
      return;
    }
    if (current.frame.intro && !fresh) {
      return;
    }
    const { away, home } = fixtureSides(view.game, view.fixture);
    paintAttack(
      modernPitchContext,
      current.attack,
      current.index,
      playback.score,
      home,
      away,
      flashPhase(view)
    );
  };

  const paintEntry = () => {
    const rgba = new Uint8ClampedArray(256 * 16 * 4);
    rasterText(rgba, 256, 0, 0, ' '.repeat(32));
    rasterText(rgba, 256, 0, 8, ' '.repeat(32));
    [...prompt.textContent!, ...input.value].forEach((character, index) =>
      rasterText(
        rgba,
        256,
        (index % 32) * 8,
        Math.floor(index / 32) * 8,
        character
      )
    );
    entryContext.putImageData(new ImageData(rgba, 256, 16), 0, 0);
  };
  input.addEventListener('input', paintEntry);

  const dom: Dom = {
    applyOptions: (options, touch) => {
      document.documentElement.classList.toggle(
        'modern',
        options.presentation === 'modern'
      );
      document.documentElement.classList.toggle(
        'fit',
        touch && options.scale === 'auto'
      );
      if (options.scale === 'auto') {
        document.documentElement.style.removeProperty('--pixel');
      } else {
        document.documentElement.style.setProperty(
          '--pixel',
          `${options.scale}px`
        );
      }
    },
    chooseFile: () => loadInput.click(),
    get clipsUnpainted() {
      return !canPaintClips();
    },
    closeMenu: () => menu.close(),
    get coarsePointer() {
      // Any touchscreen, not only a main touch pointer: some phones and
      // tablets report a fine main pointer (desktop mode, a trackpad).
      return (
        matchMedia('(any-pointer: coarse)').matches ||
        navigator.maxTouchPoints > 0
      );
    },
    focusInput: () => input.focus({ preventScroll: true }),
    get hidden() {
      return document.visibilityState === 'hidden';
    },
    notice: text => {
      notice.textContent = text;
    },
    openMenu: () => menu.showModal(),
    paintClip: (shot, bar) => {
      if (clipPitch.isConnected) {
        paintShot(clipContext, shot, fitClipCanvas(clipPitch));
      }
      clipBar.hidden = !bar;
      if (bar) {
        clipBar.style.setProperty('--at', String(bar.at));
        clipBar.style.setProperty('--moment', String(bar.moment));
      }
    },
    get reducedMotion() {
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    },
    render: ({
      amount,
      bar: buttons,
      clearInput,
      display,
      focus,
      home,
      modern,
      title,
      typing,
      view
    }) => {
      paintBar(buttons, amount);
      modernView.show(modern, home);
      const highlights =
        modern?.kind === 'highlights' ? modern.highlights : undefined;
      if (highlights?.pitch && view.screen === 'highlights') {
        paintModernPitch(view);
      }
      input.readOnly = !typing;
      if (!typing && document.activeElement === input) {
        input.blur();
      }
      screenTitle.textContent = title;
      screen.height = display.lines.length * 8;
      screenContext.putImageData(
        new ImageData(
          rasterizeCells(display.cells, flashPhase(view)),
          256,
          screen.height
        ),
        0,
        0
      );
      const match = view.screen === 'highlights' ? view.highlights : undefined;
      const playback = match?.kind === 'attacks' ? match.timeline : undefined;
      const ticker = match?.kind === 'moments' ? match.timeline : undefined;
      const current = playback?.current;
      const playing = Boolean(current && !current.frame.intro);
      pitch.hidden = !playing;
      screen.hidden = playing;
      screen.classList.toggle('cleared', view.screen === 'cleared');
      screen.classList.toggle('full-screen', display.lines.length === 24);
      if (view.screen === 'highlights' && playback && current) {
        const { away, home } = fixtureSides(view.game, view.fixture);
        paintAttack(
          pitchContext,
          current.attack,
          current.index,
          playback.score,
          home,
          away,
          flashPhase(view)
        );
      }
      // The ticker announces each new line alone (#108), not the whole
      // screen; Modern mode's pitch announces each attack's outcome (#45).
      transcript.setAttribute(
        'aria-live',
        ticker || highlights ? 'off' : 'polite'
      );
      // Under sprite highlights, a line is heard when its clip reaches it.
      const newest =
        view.screen === 'highlights' && ticker
          ? tickerLines(
              view.game,
              view.fixture,
              highlights?.clip
                ? ticker.moments.slice(0, highlights.clip.heard)
                : ticker.shown
            )[0]
          : undefined;
      const said = newest
        ? tickerText(newest)
        : (highlights?.pitch?.outcome ?? '');
      if (tickerLive.textContent !== said) {
        tickerLive.textContent = said;
      }
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
      paintEntry();
      if (focus) {
        input.focus({ preventScroll: true });
      }
    },
    showMenu: ({ controls, detail, status, title }) => {
      const heading = document.createElement('h2');
      heading.id = 'game-menu-title';
      heading.textContent = title;
      const detailLine = document.createElement('p');
      detailLine.className = 'menu-detail';
      detailLine.textContent = detail ?? '';
      detailLine.hidden = !detail;
      const list = document.createElement('div');
      list.className = 'menu-actions';
      list.append(...controls.map(control));
      const statusLine = document.createElement('p');
      statusLine.className = 'menu-status';
      statusLine.setAttribute('role', 'status');
      statusLine.textContent = status;
      menu.replaceChildren(heading, detailLine, list, statusLine);
      // The chosen radio, so arrow keys move from it; otherwise the first control.
      (
        list.querySelector<HTMLElement>('input[type="radio"]:checked') ??
        list.querySelector<HTMLElement>('button, input, select')
      )?.focus();
    }
  };

  /** Sends the page's events to `target`. */
  const connect = (target: App) => {
    menu.addEventListener('cancel', event => {
      if (target.menuCancel()) {
        event.preventDefault();
      }
    });
    menu.addEventListener('close', target.menuClosed);
    menuButton.addEventListener('click', target.openMenu);
    loadInput.addEventListener('change', async () => {
      const file = loadInput.files?.[0];
      if (!file) {
        return;
      }
      try {
        await target.importSave(() => file.text());
      } finally {
        loadInput.value = '';
      }
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      target.submit(input.value);
    });
    document.addEventListener('keydown', event => {
      // In the tabs beside the clips (#256), the arrows move between tabs
      // and never reach the playhead.
      const tab = document.activeElement?.closest<HTMLElement>('[role=tab]');
      if (
        tab &&
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        const tabs = [
          ...(tab.parentElement?.querySelectorAll<HTMLElement>('[role=tab]') ??
            [])
        ];
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next =
          tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
        if (next?.dataset.id) {
          target.tap(next.dataset.id, false);
          document
            .querySelector<HTMLElement>(
              `[data-view-control="${next.dataset.id}"]`
            )
            ?.focus({ preventScroll: true });
        }
        return;
      }
      if (
        target.keyDown({
          code: event.code,
          inputFocused: document.activeElement === input,
          key: event.key,
          modified: event.metaKey || event.ctrlKey || event.altKey,
          repeat: event.repeat,
          viewControlFocused: !!document.activeElement?.closest(
            '[data-view-control]'
          )
        })
      ) {
        event.preventDefault();
      }
    });
    input.addEventListener('input', event =>
      target.typed(
        'inputType' in event &&
          typeof event.inputType === 'string' &&
          event.inputType.startsWith('insert')
      )
    );
    document.addEventListener('pointerdown', target.pointerDown);
    // A touch may yet become a scroll, so a finger's tap waits for the
    // click the browser sends only when the touch didn't scroll.
    let touched = false;
    const pressed = (event: PointerEvent) => {
      touched = event.pointerType === 'touch';
      // On the original's pitch, or during the cup celebration, a finger
      // shortens the pauses, as on the original's screen.
      if (modernView.pressesScreen(event.target as Element)) {
        target.pressScreen();
      }
      const button = paneButton(event);
      const tap = button && tapOf(button);
      if (touched || tap?.kind !== 'answer' || button!.disabled || tap.text) {
        return;
      }
      // Submit on the way down, as a key does; keep focus off the button.
      event.preventDefault();
      target.tap(tap.id);
    };
    /** A click: from the keyboard, or a finger's tap that didn't scroll. */
    const clicked = (
      button: HTMLButtonElement,
      id: string,
      text: boolean,
      event: MouseEvent
    ) => {
      if (event.detail === 0) {
        // Activated from the keyboard, whose own key is already down.
        target.tap(id, false);
      } else if (touched && !button.disabled && !text) {
        target.tap(id, 'brief');
      }
    };
    // The context bar, the Home screen and every Modern screen take taps
    // on their buttons.
    for (const pane of [bar, modernView.home, ...modernView.panes]) {
      pane.addEventListener('pointerdown', pressed);
      pane.addEventListener('click', event => {
        const button = paneButton(event);
        const tap = button && tapOf(button);
        if (!tap) {
          return;
        }
        if (tap.kind === 'amount') {
          target.amount(tap.action);
        } else if (tap.kind === 'menu') {
          target.openMenu();
        } else if (pane === bar && tap.text) {
          // Typed answers use the soft keyboard, which opens only on a tap.
          input.focus({ preventScroll: true });
        } else {
          clicked(button!, tap.id, tap.text, event);
        }
      });
      // A name typed on a Modern screen is the answer.
      pane.addEventListener('submit', event => {
        event.preventDefault();
        const answer = answerOf(event.target as HTMLFormElement);
        if (answer !== undefined) {
          target.submit(answer);
        }
      });
    }
    machine.addEventListener('pointerdown', target.pressScreen);
    // A tap on the clips' pitch does nothing: the playhead's controls take
    // its place (ADR 0016).
    addEventListener('pointerup', target.pointerUp);
    addEventListener('pointercancel', target.pointerUp);
    document.addEventListener('keyup', target.keyUp);
    addEventListener('pagehide', target.pageHide);
    addEventListener('blur', target.blurred);
    document.addEventListener('visibilitychange', target.visibilityChanged);
  };
  return { connect, dom };
};
