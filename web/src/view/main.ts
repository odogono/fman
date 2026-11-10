import { createSession } from '../sim/session';
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
  <p class="build-note">Play league and cup matches, buy players and manage your club.<br />Season changes, dismissal, name editing and saves are coming next.</p>
  <p id="notice" class="notice" role="status"></p>
`;
const screen = document.querySelector<HTMLElement>('#screen')!;
const form = document.querySelector<HTMLFormElement>('#entry')!;
const input = document.querySelector<HTMLInputElement>('#command')!;
const prompt = document.querySelector<HTMLElement>('#prompt')!;
const transcript = document.querySelector<HTMLElement>('#transcript')!;
const notice = document.querySelector<HTMLElement>('#notice')!;
const session = createSession();
const canvas = document.querySelector<HTMLCanvasElement>('#pitch')!;
const context = canvas.getContext('2d')!;
const beeper = createBeeper();
let audioKey = '';

const render = (clearInput = true) => {
  const display = makeScreen(session);
  const fragment = document.createDocumentFragment();
  for (const cell of display.cells) {
    const span = document.createElement('span');
    span.textContent = cell.text;
    const palette = cell.bright ? 'bright' : 'normal';
    span.style.color = `var(--${palette}-${cell.inverse ? cell.paper : cell.ink})`;
    span.style.backgroundColor = `var(--${palette}-${cell.inverse ? cell.ink : cell.paper})`;
    fragment.append(span);
  }
  const current = session.playback?.current;
  if (session.screen === 'cup-celebration' && audioKey !== 'cup-victory') {
    beeper.play(cupVictoryTones);
    audioKey = 'cup-victory';
  }
  const playing = session.screen === 'highlights' && Boolean(current);
  canvas.hidden = !playing;
  screen.hidden = playing;
  if (playing && current) {
    const game = session.game!;
    paintAttack(
      context,
      current.attack,
      current.index,
      session.playback!.score,
      game.clubs[
        (session.fixture!.home ? game.club : session.fixture!.opponent) - 1
      ]!.name,
      game.clubs[
        (session.fixture!.home ? session.fixture!.opponent : game.club) - 1
      ]!.name
    );
    if (audioKey !== session.playback!.key) {
      beeper.play(current.frame.tones);
      audioKey = session.playback!.key;
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

form.addEventListener('submit', event => {
  event.preventDefault();
  beeper.unlock();
  const effect = session.submit(input.value);
  notice.textContent = '';
  if (effect?.type === 'copy') {
    input.value = '';
    window.print();
    input.focus({ preventScroll: true });
    return;
  }
  if (effect?.type === 'unavailable') {
    notice.textContent = `${effect.feature} is not available in this build.`;
  }
  render();
});
document.addEventListener('keydown', event => {
  if (
    session.paused &&
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
  const before = session.screen;
  const frame = session.playback?.key;
  const cup = session.cupDisplayKey;
  session.advance(elapsed);
  if (
    before !== session.screen ||
    frame !== session.playback?.key ||
    cup !== session.cupDisplayKey
  ) {
    render(before !== session.screen);
  }
  requestAnimationFrame(tick);
};
render();
requestAnimationFrame(tick);
