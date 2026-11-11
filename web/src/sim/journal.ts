import { framePeriod, spectrumFrameT } from './frame-clock';
import type { Game } from './management';
import type { PauseKeyboardState } from './pause-keyboard';
import { saveLimit, validGame } from './save';
import { createSession, type Effect, type Session } from './session';

/**
 * An input that changed the session. Consecutive advances are merged:
 * the frame clock, pauses and highlight playback all consume elapsed
 * frames additively, so one merged advance reaches the same state.
 */
export type JournalInput =
  | ['advance', number]
  | ['submit', string]
  | ['key', string]
  | ['skip']
  | ['saved']
  | ['reload'];

type Base =
  | {
      frames: number;
      game: Game;
      keyboard?: PauseKeyboardState;
      kind: 'menu';
      ulaFrames?: number;
    }
  | { kind: 'title' };

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
    session.resumeMenu(base.frames, base.game, base.ulaFrames, base.keyboard);
  }
  let start = base;
  let inputs: JournalInput[] = [];
  const checkpoint = () => {
    const view = session.view;
    if (view.screen === 'menu' && !view.paused) {
      start = {
        ...session.timingState,
        frames: view.frames,
        game: view.game,
        kind: 'menu'
      };
      inputs = [];
    }
  };
  const log = (input: JournalInput) => {
    inputs.push(input);
    checkpoint();
  };
  return {
    /** Returns whether the screen needs a repaint. */
    advance: (frames: number) => {
      if (frames <= 0) {
        return false;
      }
      const repaint = session.advance(frames);
      const last = inputs.at(-1);
      if (
        last?.[0] === 'advance' &&
        Number.isSafeInteger((last[1] + frames) * spectrumFrameT)
      ) {
        last[1] += frames;
      } else {
        inputs.push(['advance', frames]);
      }
      if (session.view.screen === 'menu' && !session.view.paused) {
        checkpoint();
      }
      return repaint;
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
    setKey: (key: string) => {
      if (session.timingState.keyboard.key === key) {
        return;
      }
      session.setKey(key);
      log(['key', key]);
    },
    skipPause: () => {
      session.skipPause();
      log(['skip']);
    },
    snapshot: () =>
      JSON.stringify({
        base: start,
        format: 'fman-web',
        inputs,
        version: 4
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
      return (
        v.length === 2 &&
        Number.isSafeInteger(v[1]) &&
        Number.isSafeInteger(v[1] * spectrumFrameT) &&
        v[1] > 0
      );
    case 'submit':
    case 'key':
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
 * Restores a web save: version 4 resumes the exact session; version 1
 * resumes at the reseed boundary before management. Versions 2 and 3 accept only
 * an idle menu checkpoint, since their animation durations cannot replay exactly.
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
    (value.version !== 4 && value.version !== 3 && value.version !== 2) ||
    Object.keys(value).length !== 4 ||
    !record(value.base) ||
    !Array.isArray(value.inputs) ||
    value.inputs.length > maxInputs ||
    !value.inputs.every(validInput)
  ) {
    throw invalid();
  }
  // Idle v2/v3 menu checkpoints retain their Game/FRAMES boundary. Active
  // journals used different sound/animation durations and cannot replay exactly.
  if (
    (value.version === 2 || value.version === 3) &&
    (value.inputs.length > 0 ||
      value.base.kind !== 'menu' ||
      (value.version === 2 && Object.keys(value.base).length !== 3))
  ) {
    throw invalid();
  }
  const base = value.base;
  let start: Base;
  if (base.kind === 'title' && Object.keys(base).length === 1) {
    start = { kind: 'title' };
  } else if (
    base.kind === 'menu' &&
    (Object.keys(base).length === 3 || Object.keys(base).length === 5) &&
    Object.keys(base).every(key =>
      ['frames', 'game', 'kind', 'ulaFrames', 'keyboard'].includes(key)
    ) &&
    Number.isInteger(base.frames) &&
    (base.frames as number) >= 0 &&
    (base.frames as number) < framePeriod &&
    validGame(base.game)
  ) {
    if (base.ulaFrames !== undefined || base.keyboard !== undefined) {
      if (
        !Number.isInteger(base.ulaFrames) ||
        (base.ulaFrames as number) < 0 ||
        (base.ulaFrames as number) >= framePeriod ||
        !record(base.keyboard) ||
        Object.keys(base.keyboard).length !== 4 ||
        typeof base.keyboard.key !== 'string' ||
        base.keyboard.key.length > 256 ||
        typeof base.keyboard.scanned !== 'string' ||
        base.keyboard.scanned.length > 256 ||
        typeof base.keyboard.pending !== 'boolean' ||
        !Number.isInteger(base.keyboard.repeat) ||
        (base.keyboard.repeat as number) < 0 ||
        (base.keyboard.repeat as number) > 35
      ) {
        throw invalid();
      }
    }
    start = {
      frames: base.frames as number,
      game: base.game,
      kind: 'menu',
      ...(base.ulaFrames !== undefined
        ? {
            keyboard: base.keyboard as PauseKeyboardState,
            ulaFrames: base.ulaFrames as number
          }
        : {})
    };
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
        case 'key':
          journal.setKey(input[1]);
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
