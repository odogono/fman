import { openSave } from '../sim/journal';
import type { MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import type { Moment } from '../sim/moments';
import { fitClipCanvas, paintClip } from './clip-canvas';
import { checkClip, clipIssueKinds, type ClipIssue } from './clip-checks';
import { clipInputFor, inkColours, keeperColoursFor } from './clip-match';
import {
  clearanceOutcomes,
  clipFps,
  createClipScript,
  finishes,
  hashSeed,
  missOutcomes,
  restarts,
  saveOutcomes,
  type ClipInput,
  type ClipOutcome,
  type ClipPlayer,
  type ClipScript,
  type Finish,
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
  awayEnergy: 20,
  awayKit: 1,
  defence: 4,
  finish: 'seed' as Finish | 'seed',
  homeEnergy: 20,
  homeKit: 2,
  ids: false,
  keeper: true,
  kind: 'goal' as Moment['kind'],
  midfield: 4,
  minute: 30,
  outcome: 'seed' as ClipOutcome | 'seed',
  path: false,
  place: 0,
  problems: false,
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
  name: string,
  energy: number
): ClipPlayer[] => {
  const lines: Line[] = [
    ...(keeper ? (['keeper'] as const) : []),
    ...Array<Line>(counts.defence).fill('defence'),
    ...Array<Line>(counts.midfield).fill('midfield'),
    ...Array<Line>(counts.attack).fill('attack')
  ];
  return lines.map((line, i) => ({ energy, label: `${name} ${i + 1}`, line }));
};

/** The clip the settings describe: the home side is the managed club. */
const settingsInput = (seedBase = settings.seedBase): ClipInput => {
  const homeKit = inkColours[settings.homeKit]!;
  const awayKit = inkColours[settings.awayKit]!;
  const keepers = keeperColoursFor(homeKit, awayKit);
  const home = {
    home: true,
    keeper: keepers.home,
    kit: homeKit,
    players: side(settings, settings.keeper, 'Home', settings.homeEnergy)
  };
  const away = {
    keeper: keepers.away,
    kit: awayKit,
    players: side(
      { attack: 2, defence: 4, midfield: 4 },
      true,
      'Away',
      settings.awayEnergy
    )
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
    ...(settings.finish === 'seed' ? {} : { finish: settings.finish }),
    seed: hashSeed(
      [
        'debug',
        settings.place,
        seedBase,
        settings.kind,
        settings.minute,
        settings.side
      ].join('|')
    ),
    shooter: Math.max(0, shooter)
  };
};

const outcomesFor = (kind: Moment['kind']): readonly ClipOutcome[] =>
  kind === 'goal'
    ? ['goal']
    : kind === 'save'
      ? saveOutcomes
      : kind === 'clearance'
        ? clearanceOutcomes
        : missOutcomes;

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
const problemList = element('ol', { className: 'problems' });
const survey = element('pre');

let script: ClipScript = createClipScript(settingsInput());
let issues: ClipIssue[] = [];
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
  issues = checkClip(script);
  problemList.replaceChildren(
    ...issues.map(issue => {
      const jump = element(
        'button',
        { type: 'button' },
        `${issue.start}–${issue.end}`
      );
      jump.addEventListener('click', () => {
        playing = false;
        at = issue.start;
      });
      return element('li', {}, jump, ` ${issue.kind}: ${issue.message}`);
    })
  );
  at = 0;
  playing = true;
  scrubber.max = String(script.length - 1);
  const { moment, reaction, zoom } = script.phases;
  readout.textContent = [
    `length      ${script.length} frames (${(script.length / clipFps).toFixed(2)} s)`,
    `moment at   frame ${script.momentFrame}`,
    `outcome     ${script.outcome}`,
    `restart     ${script.restart}`,
    `finish      ${script.finish}`,
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
    ),
    '',
    `problems (${issues.length})${issues.length ? '' : ': none'}`
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
          ['clearance', 'Clearance'],
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
    ),
    // A corner is always headed, and a clearance always a shot.
    labelled(
      'Finish',
      select(
        [['seed', 'From the seed'], ...finishes.map(o => [o, o] as const)],
        settings.finish,
        value => change('finish')(value as Finish | 'seed')
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
  // Tiredness shows in the zoomed view, more often late on (#146).
  const energySet = element(
    'fieldset',
    { disabled: Boolean(loaded) },
    element('legend', {}, 'Energy'),
    labelled('Home', number(settings.homeEnergy, 1, 20, change('homeEnergy'))),
    labelled('Away', number(settings.awayEnergy, 1, 20, change('awayEnergy')))
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
    ),
    labelled(
      'Problems',
      checkbox(settings.problems, value => (settings.problems = value))
    )
  );
  const surveyButton = element(
    'button',
    { type: 'button' },
    loaded ? "Check this match's moments" : 'Check 200 seeds'
  );
  surveyButton.addEventListener('click', runSurvey);
  const checks = element(
    'fieldset',
    {},
    element('legend', {}, 'Checks'),
    surveyButton,
    survey
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
  controls.replaceChildren(
    moment,
    kitsSet,
    energySet,
    shape,
    seed,
    overlays,
    checks,
    saved
  );
};

/**
 * Checks many clips at once: 200 seeds from the one set, with the other
 * settings as they are, or every moment of a loaded match. It counts the
 * clips each problem shows in, and lists the first seeds with any to open.
 */
const runSurvey = () => {
  const counts = new Map(clipIssueKinds.map(kind => [kind, 0]));
  const flagged: { open: () => void; text: string }[] = [];
  const clips = loaded
    ? loaded.moments.map((m, i) => ({
        input: clipInputFor(loaded!.game, loaded!.fixture, m, i),
        open: () => {
          loaded!.moment = i;
          rebuild();
        },
        text: `moment ${i}`
      }))
    : Array.from({ length: 200 }, (_, k) => {
        const seedBase = (settings.seedBase + k) % 1_000_000;
        return {
          input: settingsInput(seedBase),
          open: () => {
            settings.seedBase = seedBase;
            rebuild();
          },
          text: `seed ${seedBase}`
        };
      });
  let anything = 0;
  for (const clip of clips) {
    const kinds = new Set(
      checkClip(createClipScript(clip.input)).map(i => i.kind)
    );
    for (const kind of kinds) {
      counts.set(kind, counts.get(kind)! + 1);
    }
    if (kinds.size) {
      anything++;
      flagged.push({
        open: clip.open,
        text: `${clip.text}: ${[...kinds].join(', ')}`
      });
    }
  }
  survey.replaceChildren(
    [
      `${anything} of ${clips.length} clips show a problem`,
      ...[...counts]
        .filter(([, n]) => n)
        .map(([kind, n]) => `  ${kind.padEnd(22)} ${n}`)
    ].join('\n'),
    ...flagged.slice(0, 12).flatMap(({ open, text }) => {
      const button = element('button', { type: 'button' }, 'Open');
      button.addEventListener('click', open);
      return ['\n', button, ` ${text}`];
    })
  );
};

const load = (text: string | null, from: string) => {
  if (!text) {
    saveStatus.textContent = `Nothing in ${from}.`;
    return;
  }
  try {
    const view = openSave(text).session.view;
    if (view.screen !== 'highlights' || view.highlights.kind !== 'moments') {
      saveStatus.textContent = `${from} isn't in a match's moment highlights.`;
      return;
    }
    loaded = {
      fixture: view.fixture,
      game: view.game,
      moment: 0,
      moments: view.highlights.timeline.moments
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
    element('div', {}, canvas, transport, readout, problemList),
    controls
  )
);
rebuild();

// The clip on show and the frame, for poking at from the browser's console;
// `paint` draws a frame at once, even in a background tab that gets no
// animation frames.
Object.assign(globalThis, {
  clipDebug: {
    get at() {
      return at;
    },
    paint: (frame: number) =>
      paintClip(
        context,
        script.frame(frame),
        { attack: script.input.attack, defence: script.input.defence },
        fitClipCanvas(canvas)
      ),
    get script() {
      return script;
    }
  }
});

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
      ...(settings.path ? { path } : {}),
      ...(settings.problems
        ? {
            problems: issues
              .filter(i => i.start <= at && at <= i.end + 1)
              .map(i => ({
                players: i.players,
                text: `${i.kind}: ${i.message}`
              }))
          }
        : {})
    }
  );
  requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
