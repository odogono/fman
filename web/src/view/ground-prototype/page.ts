import type { Moment } from '../../sim/moments';
import { fitClipCanvas, paintClip } from '../clip-canvas';
import { inkColours, keeperColoursFor } from '../clip-match';
import {
  clipFps,
  createClipScript,
  hashSeed,
  type ClipInput,
  type ClipPlayer,
  type ClipScript,
  type Line
} from '../clips';
import { grassPatterns, type GrassPattern } from './grass';
import { createGroundView } from './scene';

// The 3D ground prototype (#263): `web/ground.html`, served by `bun run dev`
// and left out of the build. It plays a clip over the 3D ground, beside
// today's flat clip of the same frame, with the camera's tilt to choose and
// the frame rate shown. Throwaway: it answers whether to go on.

const root = document.querySelector<HTMLElement>('#ground')!;

const settings = {
  compare: true,
  grass: 'stripes' as GrassPattern,
  kind: 'goal' as Moment['kind'],
  /** Heights lean up the screen, as the sprites draw them. */
  oblique: true,
  seed: 1,
  tilt: 0
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
) => {
  const made = document.createElement(tag);
  Object.assign(made, props);
  made.append(...children);
  return made;
};

const side = (name: string): ClipPlayer[] => {
  const lines: Line[] = [
    'keeper',
    ...Array<Line>(4).fill('defence'),
    ...Array<Line>(4).fill('midfield'),
    ...Array<Line>(2).fill('attack')
  ];
  return lines.map((line, i) => ({
    energy: 20,
    label: `${name} ${i + 1}`,
    line,
    skill: 3
  }));
};

/** A clip of the kind and seed chosen: the home side, in red, attacks. */
const inputFor = (): ClipInput => {
  const homeKit = inkColours[2]!;
  const awayKit = inkColours[1]!;
  const keepers = keeperColoursFor(homeKit, awayKit);
  const attack = {
    home: true,
    keeper: keepers.home,
    kit: homeKit,
    players: side('Home')
  };
  return {
    attack,
    attackingUp: true,
    defence: { keeper: keepers.away, kit: awayKit, players: side('Away') },
    kind: settings.kind,
    minute: 30,
    score: [1, 0],
    seed: hashSeed(['ground', settings.seed, settings.kind].join('|')),
    shooter: attack.players.findIndex(p => p.line === 'attack')
  };
};

const view3d = element('canvas', { className: 'ground-3d' });
const overlay = element('canvas', { className: 'ground-overlay' });
const flat = element('canvas', { className: 'ground-2d' });
const flatContext = flat.getContext('2d')!;
const ground = createGroundView(view3d, overlay);

const scrubber = element('input', {
  min: '0',
  step: '1',
  type: 'range',
  value: '0'
});
const playButton = element('button', { type: 'button' }, 'Pause');
const frameLabel = element('span');
const stats = element('pre');
const tiltLabel = element('span');
const tiltSlider = element('input', {
  max: '60',
  min: '0',
  step: '1',
  type: 'range',
  value: '0'
});

let script: ClipScript = createClipScript(inputFor());
let at = 0;
let playing = true;

const rebuild = () => {
  script = createClipScript(inputFor());
  scrubber.max = String(script.length - 1);
  at = 0;
  playing = true;
};

const setTilt = (tilt: number) => {
  settings.tilt = tilt;
  tiltSlider.value = String(tilt);
  tiltLabel.textContent = `${tilt}°`;
};

const preset = (text: string, tilt: number) => {
  const button = element('button', { type: 'button' }, text);
  button.addEventListener('click', () => setTilt(tilt));
  return button;
};

tiltSlider.addEventListener('input', () => setTilt(Number(tiltSlider.value)));
scrubber.addEventListener('input', () => {
  playing = false;
  at = Number(scrubber.value);
});
playButton.addEventListener('click', () => {
  if (at >= script.length - 1) {
    at = 0;
  }
  playing = !playing;
});

const kind = element(
  'select',
  {},
  ...(['goal', 'save', 'clearance', 'near-miss', 'injury'] as const).map(k =>
    element('option', { value: k }, k)
  )
);
kind.addEventListener('change', () => {
  settings.kind = kind.value as Moment['kind'];
  rebuild();
});
const seed = element('input', { min: '0', type: 'number', value: '1' });
seed.addEventListener('input', () => {
  settings.seed = Number(seed.value) || 0;
  rebuild();
});
const random = element('button', { type: 'button' }, 'Random seed');
random.addEventListener('click', () => {
  settings.seed = Math.floor(Math.random() * 1_000_000);
  seed.value = String(settings.seed);
  rebuild();
});
const oblique = element('input', { checked: true, type: 'checkbox' });
oblique.addEventListener('change', () => {
  settings.oblique = oblique.checked;
});
const grass = element(
  'select',
  {},
  ...grassPatterns.map(pattern =>
    element('option', { value: pattern }, pattern)
  )
);
const setGrass = (pattern: GrassPattern) => {
  settings.grass = pattern;
  grass.value = pattern;
  ground.setGrass(pattern);
};
grass.addEventListener('change', () => setGrass(grass.value as GrassPattern));
const compare = element('input', { checked: true, type: 'checkbox' });
compare.addEventListener('change', () => {
  settings.compare = compare.checked;
  flatBox.hidden = !compare.checked;
});

const flatBox = element('div', { className: 'box' }, flat);
root.append(
  element(
    'div',
    { className: 'controls' },
    element('label', {}, 'Angle ', preset('Top-down', 0), preset('Tilted', 35)),
    element('label', {}, 'Tilt ', tiltSlider, tiltLabel),
    element('label', {}, 'Kind ', kind),
    element('label', {}, 'Seed ', seed),
    element('label', {}, 'Grass ', grass),
    random,
    element('label', {}, oblique, ' Heights up the screen'),
    element('label', {}, compare, " Today's clip beside")
  ),
  element('div', { className: 'transport' }, playButton, scrubber, frameLabel),
  element(
    'div',
    { className: 'panes' },
    element('div', { className: 'box' }, view3d, overlay),
    flatBox
  ),
  stats
);
setTilt(0);
rebuild();

/** Frame times and paint times over the last second or so. */
const frameTimes: number[] = [];
const paintTimes: number[] = [];
const average = (list: readonly number[]) =>
  list.reduce((sum, n) => sum + n, 0) / Math.max(1, list.length);
const record = (list: number[], value: number) => {
  list.push(value);
  if (list.length > 60) {
    list.shift();
  }
};

const paint = () => {
  const frame = script.frame(Math.floor(at));
  const sides = { attack: script.input.attack, defence: script.input.defence };
  const box = view3d.parentElement!;
  const ratio = globalThis.devicePixelRatio || 1;
  const started = performance.now();
  ground.paint(
    frame,
    sides,
    { height: box.clientHeight, ratio, width: box.clientWidth },
    settings.tilt,
    settings.oblique
  );
  record(paintTimes, performance.now() - started);
  if (settings.compare) {
    paintClip(flatContext, frame, sides, fitClipCanvas(flat));
  }
  return frame;
};

let last = performance.now();
const tick = (now: number) => {
  record(frameTimes, now - last);
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    at += elapsed * clipFps;
    if (at >= script.length - 1) {
      at = 0;
    }
  }
  playButton.textContent = playing ? 'Pause' : 'Play';
  scrubber.value = String(Math.floor(at));
  const frame = paint();
  frameLabel.textContent = `${Math.floor(at)} / ${script.length - 1} · ${frame.phase}`;
  const fps = 1000 / average(frameTimes);
  stats.textContent = [
    `fps          ${fps.toFixed(1)}`,
    `3D paint     ${average(paintTimes).toFixed(2)} ms (CPU, incl. GL submit)`,
    `draw calls   ${ground.calls()}`,
    `render size  ${view3d.width} × ${view3d.height}`
  ].join('\n');
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

// For driving the page from the console or a preview.
Object.assign(globalThis, {
  groundDebug: {
    ground,
    paint: (frame: number) => {
      playing = false;
      at = frame;
      paint();
    },
    get script() {
      return script;
    },
    set: (changes: Partial<typeof settings>) => {
      Object.assign(settings, changes);
      setTilt(settings.tilt);
      seed.value = String(settings.seed);
      kind.value = settings.kind;
      setGrass(settings.grass);
      rebuild();
      playing = false;
    },
    tilt: setTilt
  }
});
