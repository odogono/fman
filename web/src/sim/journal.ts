import { framePeriod } from './frame-clock';
import type { Game } from './management';
import { saveLimit, validGame } from './save';
import { createSession, type Effect, type Session } from './session';

/**
 * An input that changed the session. Consecutive advances are merged:
 * the frame clock, pauses and highlight playback all consume elapsed
 * frames additively, so one merged advance reaches the same state.
 */
export type JournalInput =
  ['advance', number] | ['submit', string] | ['skip'] | ['saved'] | ['reload'];

type Base = { frames: number; game: Game; kind: 'menu' } | { kind: 'title' };

const maxInputs = 5000;
const invalid = () => new RangeError('Invalid Football Manager web save');
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A session plus the inputs since its last checkpoint, so the exact session
 * can be serialised and restored by replay. Whenever play reaches the
 * management menu the journal restarts from that game and frame counter.
 */
export const createJournal = (base: Base = { kind: 'title' }) => {
  const session = createSession();
  if (base.kind === 'menu') {
    session.resumeMenu(base.frames, base.game);
  }
  let start = base;
  let inputs: JournalInput[] = [];
  const checkpoint = () => {
    const view = session.view;
    if (view.screen === 'menu') {
      start = { frames: view.frames, game: view.game, kind: 'menu' };
      inputs = [];
    }
  };
  const log = (input: JournalInput) => {
    inputs.push(input);
    checkpoint();
  };
  return {
    advance: (frames: number) => {
      if (frames <= 0) {
        return;
      }
      session.advance(frames);
      const last = inputs.at(-1);
      if (last?.[0] === 'advance') {
        last[1] += frames;
      } else {
        inputs.push(['advance', frames]);
      }
    },
    reload: () => {
      const done = session.reload();
      if (done) {
        log(['reload']);
      }
      return done;
    },
    saved: () => {
      const done = session.saved();
      if (done) {
        log(['saved']);
      }
      return done;
    },
    session: session as Session,
    skipPause: () => {
      session.skipPause();
      log(['skip']);
    },
    snapshot: () =>
      JSON.stringify({
        base: start,
        format: 'fman-web',
        inputs,
        version: 2
      }),
    submit: (text: string): Effect | undefined => {
      const effect = session.submit(text);
      log(['submit', text]);
      return effect;
    }
  };
};
export type Journal = ReturnType<typeof createJournal>;

const validInput = (v: unknown): v is JournalInput => {
  if (!Array.isArray(v) || typeof v[0] !== 'string') {
    return false;
  }
  switch (v[0]) {
    case 'advance':
      return v.length === 2 && Number.isSafeInteger(v[1]) && v[1] > 0;
    case 'submit':
      return v.length === 2 && typeof v[1] === 'string' && v[1].length <= 256;
    case 'skip':
    case 'saved':
    case 'reload':
      return v.length === 1;
    default:
      return false;
  }
};

/**
 * Restores a web save: version 2 resumes the exact session; version 1
 * resumes at the reseed boundary before management, as before.
 */
export const openSave = (data: string): Journal => {
  if (data.length > saveLimit) {
    throw invalid();
  }
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw invalid();
  }
  if (record(value) && value.version === 1) {
    const saved = createSession();
    saved.load(data);
    const view = saved.view;
    if (view.screen !== 'menu') {
      throw invalid();
    }
    return createJournal({
      frames: view.frames,
      game: view.game,
      kind: 'menu'
    });
  }
  if (
    !record(value) ||
    value.format !== 'fman-web' ||
    value.version !== 2 ||
    Object.keys(value).length !== 4 ||
    !record(value.base) ||
    !Array.isArray(value.inputs) ||
    value.inputs.length > maxInputs ||
    !value.inputs.every(validInput)
  ) {
    throw invalid();
  }
  const base = value.base;
  let start: Base;
  if (base.kind === 'title' && Object.keys(base).length === 1) {
    start = { kind: 'title' };
  } else if (
    base.kind === 'menu' &&
    Object.keys(base).length === 3 &&
    Number.isInteger(base.frames) &&
    (base.frames as number) >= 0 &&
    (base.frames as number) < framePeriod &&
    validGame(base.game)
  ) {
    start = { frames: base.frames as number, game: base.game, kind: 'menu' };
  } else {
    throw invalid();
  }
  try {
    const journal = createJournal(start);
    for (const input of value.inputs as JournalInput[]) {
      switch (input[0]) {
        case 'advance':
          journal.advance(input[1]);
          break;
        case 'submit':
          journal.submit(input[1]);
          break;
        case 'skip':
          journal.skipPause();
          break;
        case 'saved':
          journal.saved();
          break;
        case 'reload':
          journal.reload();
          break;
      }
    }
    return journal;
  } catch {
    throw invalid();
  }
};
