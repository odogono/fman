import { openSave } from '../sim/journal';
import type { MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import { fitClipCanvas, paintClip } from './clip-canvas';
import { clipInputFor, inkColours, keeperColoursFor } from './clip-match';
import {
  clipFps,
  createClipScript,
  hashSeed,
  missOutcomes,
  restarts,
  saveOutcomes,
  type ClipInput,
  type ClipOutcome,
  type ClipPlayer,
  type ClipScript,
  type Line,
  type Restart
} from './clips';
import { named } from './ticker-layout';

// The clip debugger (#144): `web/clips.html`, served by `bun run dev` and
// left out of the build. It plays any clip the engine can make, or a moment
// from the autosave or a web save, with a frame-by-frame transport.

const root = document.querySelector<HTMLElement>('#debug')!;

/** The kits a club can wear: never green or yellow, as on the original pitch. */
const kitInks = [0, 1, 2, 3, 5, 7] as const;
const inkNames = [
  'Black',
  'Blue',
  'Red',
  'Magenta',
  'Green',
  'Cyan',
  'Yellow',
  'White'
];

const settings = {
  attack: 2,
  awayKit: 1,
  defence: 4,
  homeKit: 2,
  ids: false,
  keeper: true,
  kind: 'goal' as Moment['kind'],
  midfield: 4,
  minute: 30,
  outcome: 'seed' as ClipOutcome | 'seed',
  path: false,
  place: 0,
  restart: 'seed' as Restart | 'seed',
  seedBase: 1,
  side: 'home' as 'away' | 'home',
  speed: 1
};

/** A match loaded from a save, while its moments are being replayed. */
let loaded:
  | {
      fixture: MatchFixture;
      game: Game;
      moment: number;
      moments: readonly Moment[];
    }
  | undefined;

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

const labelled = (text: string, control: HTMLElement) =>
  element('label', {}, text, control);

const select = (
  options: readonly (readonly [string, string])[],
  value: string,
  change: (value: string) => void
) => {
  const made = element(
    'select',
    {},
    ...options.map(([v, text]) => element('option', { value: v }, text))
  );
  made.value = value;
  made.addEventListener('change', () => change(made.value));
  return made;
};

const number = (
  value: number,
  min: number,
  max: number,
  change: (n: number) => void
) => {
  const made = element('input', {
    max: String(max),
    min: String(min),
    type: 'number',
    value: String(value)
  });
  made.addEventListener('input', () => {
    const n = Number(made.value);
    if (Number.isFinite(n)) {
      change(Math.min(max, Math.max(min, Math.round(n))));
    }
  });
  return made;
};

const checkbox = (checked: boolean, change: (checked: boolean) => void) => {
  const made = element('input', { checked, type: 'checkbox' });
  made.addEventListener('change', () => change(made.checked));
  return made;
};

const side = (
  counts: Readonly<Record<'attack' | 'defence' | 'midfield', number>>,
  keeper: boolean,
  name: string
): ClipPlayer[] => {
  const lines: Line[] = [
    ...(keeper ? (['keeper'] as const) : []),
    ...Array<Line>(counts.defence).fill('defence'),
    ...Array<Line>(counts.midfield).fill('midfield'),
    ...Array<Line>(counts.attack).fill('attack')
  ];
  return lines.map((line, i) => ({ label: `${name} ${i + 1}`, line }));
};

/** The clip the settings describe: the home side is the managed club. */
const settingsInput = (): ClipInput => {
  const homeKit = inkColours[settings.homeKit]!;
  const awayKit = inkColours[settings.awayKit]!;
  const keepers = keeperColoursFor(homeKit, awayKit);
  const home = {
    keeper: keepers.home,
    kit: homeKit,
    players: side(settings, settings.keeper, 'Home')
  };
  const away = {
    keeper: keepers.away,
    kit: awayKit,
    players: side({ attack: 2, defence: 4, midfield: 4 }, true, 'Away')
  };
  const attack = settings.side === 'home' ? home : away;
  const forward = attack.players.findIndex(p => p.line === 'attack');
  const shooter = forward >= 0 ? forward : attack.players.length - 1;
  return {
    attack,
    attackingUp: (settings.side === 'home') === settings.minute < 46,
    defence: settings.side === 'home' ? away : home,
    kind: settings.kind,
    minute: settings.minute,
    ...(settings.outcome === 'seed' ? {} : { outcome: settings.outcome }),
    ...(settings.restart === 'seed' ? {} : { restart: settings.restart }),
    seed: hashSeed(
      [
        'debug',
        settings.place,
        settings.seedBase,
        settings.kind,
        settings.minute,
        settings.side
      ].join('|')
    ),
    shooter: Math.max(0, shooter)
  };
};

const outcomesFor = (kind: Moment['kind']): readonly ClipOutcome[] =>
  kind === 'goal' ? ['goal'] : kind === 'save' ? saveOutcomes : missOutcomes;

// The page: the pitch and transport on the left, the controls on the right.
const canvas = element('canvas', { className: 'clip-pitch' });
const context = canvas.getContext('2d')!;
const scrubber = element('input', {
  min: '0',
  step: '1',
  type: 'range',
  value: '0'
});
const frameLabel = element('span');
const playButton = element('button', { type: 'button' }, 'Pause');
const readout = element('pre');
const controls = element('div');
const saveStatus = element('p');

let script: ClipScript = createClipScript(settingsInput());
let path: { x: number; y: number }[] = [];
let at = 0;
let playing = true;

const rebuild = () => {
  const input = loaded
    ? clipInputFor(
        loaded.game,
        loaded.fixture,
        loaded.moments[loaded.moment]!,
        loaded.moment
      )
    : settingsInput();
  script = createClipScript(input);
  path = Array.from({ length: script.length }, (_, i) => script.frame(i).ball);
  at = 0;
  playing = true;
  scrubber.max = String(script.length - 1);
  const { moment, reaction, zoom } = script.phases;
  readout.textContent = [
    `length      ${script.length} frames (${(script.length / clipFps).toFixed(2)} s)`,
    `moment at   frame ${script.momentFrame}`,
    `outcome     ${script.outcome}`,
    `restart     ${script.restart}`,
    `phases      build-up 0, zoom ${zoom}, moment ${moment}, reaction ${reaction}`,
    `seed        ${input.seed}`,
    `shooter     ${input.attack.players[input.shooter]?.label ?? '-'}`,
    `ends        attacking ${input.attackingUp ? 'up' : 'down'}`,
    `keepers     ${input.attack.keeper} / ${input.defence.keeper}`,
    '',
    `passes (${script.passes.length})`,
    ...script.passes.map(
      p =>
        `  ${String(p.start).padStart(4)}–${String(p.end).padEnd(4)} ${p.from} → ${p.to}${p.kind === 'pass' ? '' : ` (${p.kind})`}`
    )
  ].join('\n');
  renderControls();
};

const renderControls = () => {
  const change =
    <K extends keyof typeof settings>(key: K) =>
    (value: (typeof settings)[K]) => {
      settings[key] = value;
      rebuild();
    };
  const kits = kitInks.map(ink => [String(ink), inkNames[ink]!] as const);
  const moment = element(
    'fieldset',
    { disabled: Boolean(loaded) },
    element('legend', {}, 'Moment'),
    labelled(
      'Kind',
      select(
        [
          ['goal', 'Goal'],
          ['save', 'Save'],
          ['near-miss', 'Near miss']
        ],
        settings.kind,
        value => {
          settings.kind = value as Moment['kind'];
          settings.outcome = 'seed';
          rebuild();
        }
      )
    ),
    labelled(
      'Outcome',
      select(
        [
          ['seed', 'From the seed'],
          ...outcomesFor(settings.kind).map(o => [o, o] as const)
        ],
        settings.outcome,
        value => change('outcome')(value as ClipOutcome | 'seed')
      )
    ),
    labelled(
      'Scored by',
      select(
        [
          ['home', 'Home'],
          ['away', 'Away']
        ],
        settings.side,
        value => change('side')(value as 'away' | 'home')
      )
    ),
    labelled('Minute', number(settings.minute, 1, 90, change('minute'))),
    labelled(
      'Restart',
      select(
        [['seed', 'From the seed'], ...restarts.map(o => [o, o] as const)],
        settings.restart,
        value => change('restart')(value as Restart | 'seed')
      )
    )
  );
  const kitsSet = element(
    'fieldset',
    { disabled: Boolean(loaded) },
    element('legend', {}, 'Kits'),
    labelled(
      'Home',
      select(kits, String(settings.homeKit), v => change('homeKit')(Number(v)))
    ),
    labelled(
      'Away',
      select(kits, String(settings.awayKit), v => change('awayKit')(Number(v)))
    )
  );
  const shape = element(
    'fieldset',
    { disabled: Boolean(loaded) },
    element('legend', {}, 'Home side (managed)'),
    labelled('Goalkeeper', checkbox(settings.keeper, change('keeper'))),
    labelled('Defence', number(settings.defence, 0, 10, change('defence'))),
    labelled('Midfield', number(settings.midfield, 0, 10, change('midfield'))),
    labelled('Attack', number(settings.attack, 0, 10, change('attack')))
  );
  const random = element('button', { type: 'button' }, 'Random seed');
  random.addEventListener('click', () => {
    settings.seedBase = Math.floor(Math.random() * 1_000_000);
    rebuild();
  });
  const seed = element(
    'fieldset',
    { disabled: Boolean(loaded) },
    element('legend', {}, 'Seed'),
    labelled('Place in list', number(settings.place, 0, 99, change('place'))),
    labelled('Seed', number(settings.seedBase, 0, 999_999, change('seedBase'))),
    random
  );
  const overlays = element(
    'fieldset',
    {},
    element('legend', {}, 'Overlays'),
    labelled(
      'Player ids',
      checkbox(settings.ids, value => (settings.ids = value))
    ),
    labelled(
      'Ball path',
      checkbox(settings.path, value => (settings.path = value))
    )
  );
  const autosave = element('button', { type: 'button' }, 'Load the autosave');
  autosave.addEventListener('click', () => {
    let text: string | null = null;
    try {
      text = localStorage.getItem('fman:autosave');
    } catch {
      text = null;
    }
    load(text, 'the autosave');
  });
  const file = element('input', {
    accept: '.json,.fman,application/json,text/plain',
    type: 'file'
  });
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    if (chosen) {
      void chosen.text().then(text => load(text, chosen.name));
    }
  });
  const saved = element(
    'fieldset',
    {},
    element('legend', {}, 'From a save'),
    autosave,
    ' ',
    labelled('Web save', file),
    saveStatus
  );
  if (loaded) {
    const { fixture, game, moments } = loaded;
    saved.append(
      labelled(
        'Moment',
        select(
          moments.map(
            (m, i) =>
              [
                String(i),
                `${m.minute}′ ${m.kind} – ${named(game, fixture, m).trim()}`
              ] as const
          ),
          String(loaded.moment),
          value => {
            loaded!.moment = Number(value);
            rebuild();
          }
        )
      )
    );
    const back = element('button', { type: 'button' }, 'Back to settings');
    back.addEventListener('click', () => {
      loaded = undefined;
      saveStatus.textContent = '';
      rebuild();
    });
    saved.append(back);
  }
  controls.replaceChildren(moment, kitsSet, shape, seed, overlays, saved);
};

const load = (text: string | null, from: string) => {
  if (!text) {
    saveStatus.textContent = `Nothing in ${from}.`;
    return;
  }
  try {
    const view = openSave(text).session.view;
    if (view.screen !== 'highlights' || !('ticker' in view)) {
      saveStatus.textContent = `${from} isn't in a match's moment highlights.`;
      return;
    }
    loaded = {
      fixture: view.fixture,
      game: view.game,
      moment: 0,
      moments: view.ticker.moments
    };
    saveStatus.textContent = `Loaded ${from}.`;
    rebuild();
  } catch (error) {
    saveStatus.textContent = `Could not open ${from}: ${String(error)}`;
  }
};

const speeds = [
  ['0.25', '¼×'],
  ['1', '1×'],
  ['4', '4×']
] as const;
const step = (by: number) => {
  playing = false;
  at = Math.min(script.length - 1, Math.max(0, Math.round(at) + by));
};
const back = element('button', { type: 'button' }, '◀ Frame');
back.addEventListener('click', () => step(-1));
const forward = element('button', { type: 'button' }, 'Frame ▶');
forward.addEventListener('click', () => step(1));
const restart = element('button', { type: 'button' }, 'Restart');
restart.addEventListener('click', () => {
  at = 0;
  playing = true;
});
playButton.addEventListener('click', () => {
  if (at >= script.length - 1) {
    at = 0;
  }
  playing = !playing;
});
scrubber.addEventListener('input', () => {
  playing = false;
  at = Number(scrubber.value);
});
const transport = element(
  'div',
  { className: 'transport' },
  playButton,
  back,
  forward,
  restart,
  select(speeds, '1', value => (settings.speed = Number(value))),
  scrubber,
  frameLabel
);

root.append(
  element(
    'div',
    { className: 'debug' },
    element('div', {}, canvas, transport, readout),
    controls
  )
);
rebuild();

let last = performance.now();
const tick = (now: number) => {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (playing) {
    at += elapsed * clipFps * settings.speed;
    if (at >= script.length - 1) {
      at = script.length - 1;
      playing = false;
    }
  }
  playButton.textContent = playing ? 'Pause' : 'Play';
  scrubber.value = String(Math.round(at));
  const frame = script.frame(at);
  frameLabel.textContent = `${Math.floor(at)} / ${script.length - 1} · ${frame.phase}`;
  paintClip(
    context,
    frame,
    { attack: script.input.attack, defence: script.input.defence },
    fitClipCanvas(canvas),
    {
      ids: settings.ids,
      ...(settings.path ? { path } : {})
    }
  );
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
