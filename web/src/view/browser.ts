import { version } from '../../../package.json';
import { fixtureSides } from '../sim/league';
import { flashPhase } from '../sim/session';
import {
  amountChips,
  amountStep,
  digitAllowed,
  formatAmount,
  type AmountAction,
  type AmountEntry
} from './amount-entry';
import type { App, Dom, MenuControl } from './app';
import type { BarButton } from './context-bar';
import { rasterText, rasterizeCells } from './glyphs';
import { paintAttack } from './pitch';

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
  }
};

/** A bar button that changes the amount being entered, not the game. */
const amountButton = (
  label: string,
  action: AmountAction,
  className: string,
  disabled = false
) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.className = className;
  element.disabled = disabled;
  element.dataset.action = JSON.stringify(action);
  return element;
};

/** The stepper and chips, or the keypad while an exact amount is typed. */
const amountPanel = (entry: AmountEntry) => {
  const shown = document.createElement('output');
  shown.className = 'amount wide';
  if (entry.typing !== undefined) {
    shown.textContent = `£${entry.typing}_`;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(digit =>
      amountButton(
        String(digit),
        { digit, type: 'digit' },
        'number',
        !digitAllowed(entry, digit)
      )
    );
    return [
      shown,
      ...digits,
      amountButton('Del', { type: 'back' }, 'number', !entry.typing),
      amountButton('Done', { type: 'done' }, 'number')
    ];
  }
  shown.className = 'amount';
  shown.textContent = formatAmount(entry.value);
  return [
    amountButton(
      '-',
      { delta: -amountStep, type: 'step' },
      'number',
      entry.value <= entry.min
    ),
    shown,
    amountButton(
      '+',
      { delta: amountStep, type: 'step' },
      'number',
      entry.value >= entry.max
    ),
    ...amountChips.map(chip =>
      amountButton(
        `+£${chip / 1000}k`,
        { delta: chip, type: 'step' },
        'number chip',
        entry.value >= entry.max
      )
    ),
    amountButton(
      'Max',
      { type: 'max' },
      'number chip',
      entry.value >= entry.max
    ),
    amountButton('Exact amount', { type: 'keypad' }, 'blue wide')
  ];
};

/** The context bar button an event came from, if any. */
const barButton = (event: Event) =>
  (event.target as Element).closest<HTMLButtonElement>('#context-bar button');

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
  <p class="build-note">Play league and cup matches, edit names and manage your club.<br />Play resumes where you left it. Press Esc or the menu button to save, load or start again.</p>
  <p id="notice" class="notice" role="status"></p>
  <p class="version">v${version}</p>
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
  const notice = find<HTMLElement>('#notice');
  const menuButton = find<HTMLButtonElement>('#menu-button');
  const menu = find<HTMLDialogElement>('#game-menu');
  const loadInput = find<HTMLInputElement>('#load-save');
  const screenTitle = find<HTMLElement>('#screen-title');
  const pitch = find<HTMLCanvasElement>('#pitch');
  const pitchContext = pitch.getContext('2d')!;
  const machine = find<HTMLElement>('.machine');
  const bar = find<HTMLElement>('#context-bar');
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
    render: ({
      amount,
      bar: buttons,
      clearInput,
      display,
      focus,
      title,
      view
    }) => {
      paintBar(buttons, amount);
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
      const current =
        view.screen === 'highlights' ? view.playback.current : undefined;
      const playing = Boolean(current && !current.frame.intro);
      pitch.hidden = !playing;
      screen.hidden = playing;
      screen.classList.toggle('cleared', view.screen === 'cleared');
      screen.classList.toggle('full-screen', display.lines.length === 24);
      if (view.screen === 'highlights' && current) {
        const { away, home } = fixtureSides(view.game, view.fixture);
        paintAttack(
          pitchContext,
          current.attack,
          current.index,
          view.playback.score,
          home,
          away,
          flashPhase(view)
        );
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
    showMenu: ({ controls, status, title }) => {
      const heading = document.createElement('h2');
      heading.id = 'game-menu-title';
      heading.textContent = title;
      const list = document.createElement('div');
      list.className = 'menu-actions';
      list.append(...controls.map(control));
      const statusLine = document.createElement('p');
      statusLine.className = 'menu-status';
      statusLine.setAttribute('role', 'status');
      statusLine.textContent = status;
      menu.replaceChildren(heading, list, statusLine);
      list.querySelector<HTMLElement>('button, input, select')?.focus();
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
      if (
        target.keyDown({
          code: event.code,
          inputFocused: document.activeElement === input,
          key: event.key,
          modified: event.metaKey || event.ctrlKey || event.altKey,
          repeat: event.repeat
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
    bar.addEventListener('pointerdown', event => {
      const button = barButton(event);
      if (!button?.dataset.id || button.dataset.kind === 'text') {
        return;
      }
      // Submit on the way down, as a key does; keep focus off the button.
      event.preventDefault();
      target.tap(button.dataset.id!);
    });
    bar.addEventListener('click', event => {
      const button = barButton(event);
      if (!button) {
        return;
      }
      if (button.dataset.action) {
        target.amount(JSON.parse(button.dataset.action) as AmountAction);
      } else if (button.dataset.kind === 'text') {
        // Typed answers use the soft keyboard, which opens only on a tap.
        input.focus({ preventScroll: true });
      } else if (event.detail === 0) {
        // Activated from the keyboard, whose own key is already down.
        target.tap(button.dataset.id!, false);
      }
    });
    machine.addEventListener('pointerdown', target.pressScreen);
    addEventListener('pointerup', target.pointerUp);
    addEventListener('pointercancel', target.pointerUp);
    document.addEventListener('keyup', target.keyUp);
    addEventListener('pagehide', target.pageHide);
    addEventListener('blur', target.blurred);
    document.addEventListener('visibilitychange', target.visibilityChanged);
  };
  return { connect, dom };
};
