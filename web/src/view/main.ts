import { saveLimit } from '../sim/save';
import { createSession, type View } from '../sim/session';
import { createBeeper } from './beeper';
import { cupVictoryTones } from './cup-victory';
import { createFrameSampler } from './frame-sampler';
import { paintAttack } from './pitch';
import { makeScreen } from './screen';

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('Missing application root');
}
app.innerHTML = `
  <h1 class="sr-only">Football Manager</h1>
  <section class="machine" aria-label="ZX Spectrum Football Manager">
    <div id="screen" aria-hidden="true"></div><canvas id="pitch" width="256" height="176" aria-hidden="true" hidden></canvas>
    <form id="entry" autocomplete="off">
      <label for="command" id="prompt"></label><input id="command" name="command" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="256" />
    </form>
  </section>
  <pre id="transcript" class="sr-only" aria-live="polite" aria-atomic="true"></pre>
  <p class="build-note">Play league and cup matches, edit names and manage your club.<br />Use keep to download a web save.</p>
  <label class="save-load">Load web save <input id="load-save" type="file" accept=".json,.fman.json" /></label>
  <button id="reload" type="button" hidden>Load game again</button>
  <p id="notice" class="notice" role="status"></p>
`;
const screen = document.querySelector<HTMLElement>('#screen')!;
const form = document.querySelector<HTMLFormElement>('#entry')!;
const input = document.querySelector<HTMLInputElement>('#command')!;
const prompt = document.querySelector<HTMLElement>('#prompt')!;
const transcript = document.querySelector<HTMLElement>('#transcript')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
const reload = document.querySelector<HTMLButtonElement>('#reload')!;
const session = createSession();
const loadInput = document.querySelector<HTMLInputElement>('#load-save')!;
const canvas = document.querySelector<HTMLCanvasElement>('#pitch')!;
const context = canvas.getContext('2d')!;
const beeper = createBeeper();
let audioKey = '';

/** Changes whenever the tick must redraw without a change of screen. */
const displayKey = (view: View) =>
  view.screen === 'highlights'
    ? view.playback.key
    : (view.screen === 'cup-celebration' || view.screen === 'cup-result') &&
        view.celebration !== undefined
      ? `${view.celebration}:${Math.floor(view.frames / 16) % 2}`
      : '';

const render = (clearInput = true) => {
  const view = session.view;
  const display = makeScreen(view);
  const fragment = document.createDocumentFragment();
  for (const cell of display.cells) {
    const span = document.createElement('span');
    span.textContent = cell.text;
    const palette = cell.bright ? 'bright' : 'normal';
    span.style.color = `var(--${palette}-${cell.inverse ? cell.paper : cell.ink})`;
    span.style.backgroundColor = `var(--${palette}-${cell.inverse ? cell.ink : cell.paper})`;
    fragment.append(span);
  }
  const current =
    view.screen === 'highlights' ? view.playback.current : undefined;
  if (view.screen === 'cup-celebration' && audioKey !== 'cup-victory') {
    beeper.play(cupVictoryTones);
    audioKey = 'cup-victory';
  }
  const playing = Boolean(current);
  canvas.hidden = !playing;
  screen.hidden = playing;
  screen.classList.toggle('cleared', view.screen === 'cleared');
  screen.classList.toggle('full-screen', display.lines.length === 24);
  reload.hidden = view.screen !== 'cleared';
  if (view.screen === 'cleared') {
    notice.textContent = 'Game cleared. Load it again to start a new game.';
  }
  if (view.screen === 'names' && view.nameEditor.phase === 'fault') {
    notice.textContent =
      'Name editing stopped. Reload the page to start a new game.';
  }
  if (view.screen === 'highlights' && current) {
    const { fixture, game, playback } = view;
    paintAttack(
      context,
      current.attack,
      current.index,
      playback.score,
      game.clubs[(fixture.home ? game.club : fixture.opponent) - 1]!,
      game.clubs[(fixture.home ? fixture.opponent : game.club) - 1]!
    );
    if (audioKey !== playback.key) {
      beeper.play(current.frame.tones);
      audioKey = playback.key;
    }
  }
  screen.replaceChildren(fragment);
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
  if (!display.paused) {
    input.focus({ preventScroll: true });
  }
};

loadInput.addEventListener('change', async () => {
  const file = loadInput.files?.[0];
  if (!file) {
    return;
  }
  loadInput.disabled = true;
  try {
    if (file.size > saveLimit) {
      throw new RangeError('Save file is too large');
    }
    session.load(await file.text());
    audioKey = '';
    notice.textContent = 'Web save loaded.';
    render();
  } catch {
    notice.textContent =
      'Could not load this web save. The current game is unchanged.';
  } finally {
    loadInput.value = '';
    loadInput.disabled = false;
  }
});

reload.addEventListener('click', () => {
  if (session.reload()) {
    notice.textContent = '';
    audioKey = '';
    render();
  }
});

form.addEventListener('submit', event => {
  event.preventDefault();
  beeper.unlock();
  const effect = session.submit(input.value);
  notice.textContent = '';
  if (effect?.type === 'copy') {
    render();
    window.print();
    input.focus({ preventScroll: true });
    return;
  }
  if (effect?.type === 'save') {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(
        new Blob([effect.data], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'football.fman.json';
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
      session.saved();
      notice.textContent = 'Web save download requested.';
    } catch {
      notice.textContent = 'Could not download the web save. Try keep again.';
    } finally {
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }
  if (effect?.type === 'unavailable') {
    notice.textContent = `${effect.feature} is not available in this build.`;
  }
  render();
});
document.addEventListener('keydown', event => {
  if (event.target === loadInput) {
    return;
  }
  if (
    session.view.paused &&
    !event.repeat &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    session.skipPause();
    render();
  }
});

const sampleFrames = createFrameSampler(performance.now());
const tick = (now: number) => {
  const elapsed = sampleFrames(now);
  const before = session.view;
  session.advance(elapsed);
  const after = session.view;
  if (
    before.screen !== after.screen ||
    displayKey(before) !== displayKey(after)
  ) {
    render(before.screen !== after.screen);
  }
  requestAnimationFrame(tick);
};
render();
requestAnimationFrame(tick);
