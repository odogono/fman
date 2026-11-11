import { framePeriod, spectrumFrameT } from './frame-clock';
import type { Game } from './management';
import type { PauseKeyboardState } from './pause-keyboard';
import { isRuleset, type Ruleset } from './ruleset';
import { rulesetSaveVersion, saveLimit, saveVersion, savedGame } from './save';
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
  | ['press', string]
  | ['let-go']
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
  | { kind: 'title'; ruleset: Ruleset };

/**
 * How long a keypress stays down: a brief one comes up once the original
 * has scanned it; a held one until `release` (ADR 0006).
 */
export type Hold = 'brief' | 'held';

const maxInputs = 5000;
const invalid = () => new RangeError('Invalid Football Manager web save');
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A session plus the inputs since its last checkpoint, so the exact session
 * can be serialised and restored by replay. Whenever play reaches the
 * management menu the journal restarts from that game and frame counter.
 */
export const createJournal = (
  base: Base = { kind: 'title', ruleset: 'original' }
) => {
  const session = createSession(
    0,
    0,
    base.kind === 'title' ? base.ruleset : 'original'
  );
  if (base.kind === 'menu') {
    session.resumeMenu(base.frames, base.game, base.ulaFrames, base.keyboard);
  }
  let start = base;
  let inputs: JournalInput[] = [];
  /** The key down is a brief keypress, still awaiting its scan. */
  let brief = false;
  const keyboard = () => session.timingState.keyboard;
  // A checkpoint stores the key but not its hold, so none is taken while a
  // brief keypress is down; its release, inside an advance, takes one.
  const checkpoint = () => {
    const view = session.view;
    if (view.screen === 'menu' && !view.paused && !brief) {
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
  /** Lifts a brief keypress once the original has scanned it. */
  const settle = () => {
    const { key, scanned } = keyboard();
    if (brief && (!key || key === scanned)) {
      brief = false;
      session.setKey('');
    }
  };
  /** Sets a held key, or lifts it with `''`. */
  const setKey = (key: string) => {
    if (!brief && keyboard().key === key) {
      return;
    }
    brief = false;
    session.setKey(key);
    log(['key', key]);
  };
  const press = (key: string, hold: Hold) => {
    if (hold === 'held') {
      setKey(key);
      return;
    }
    brief = true;
    session.setKey(key);
    settle();
    log(['press', key]);
  };
  const step = (frames: number) => {
    const repaint = session.advance(frames);
    settle();
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
  };
  /** Turns a held keypress brief, as its key-up can no longer arrive. */
  const letGo = () => {
    if (brief || !keyboard().key) {
      return;
    }
    brief = true;
    settle();
    log(['let-go']);
  };
  return {
    /**
     * Returns whether the screen needs a repaint. A brief keypress is
     * stepped frame by frame until it comes up, so it lifts on its scan.
     */
    advance: (frames: number) => {
      let repaint = false;
      for (; brief && frames > 0; frames--) {
        repaint = step(1) || repaint;
      }
      return frames > 0 ? step(frames) || repaint : repaint;
    },
    letGo,
    /** A key goes down, replacing any key already down. */
    press,
    /** The key or finger lifted: lifts a held keypress only. */
    release: () => {
      if (!brief && keyboard().key) {
        setKey('');
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
        version: saveVersion
      }),
    /**
     * Submits an answer, pressing Enter as a keyboard does when no key is
     * already down (ADR 0006); without `enter`, presses no key.
     */
    submit: (text: string, enter?: Hold): Effect | undefined => {
      if (enter && !keyboard().key) {
        press('Enter', enter);
      }
      const effect = session.submit(text);
      log(['submit', text]);
      return effect;
    }
  };
};
export type Journal = ReturnType<typeof createJournal>;

const validInput = (v: unknown, version: number): v is JournalInput => {
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
    case 'press':
      return (
        version >= 5 &&
        v.length === 2 &&
        typeof v[1] === 'string' &&
        v[1].length <= 256
      );
    case 'let-go':
      return version >= 5 && v.length === 1;
    case 'skip':
    case 'saved':
    case 'reload':
      return v.length === 1;
    default:
      return false;
  }
};

/**
 * Restores a web save: journals from version 4 resume the exact session,
 * letting go of any held keypress; a kept game (version 1, or 6 and up with a
 * frame counter) resumes at the reseed boundary before management. Games
 * stored before version 6, and title-screen journals before version 7, play
 * the original rules. Versions 2 and 3 accept
 * only an idle menu checkpoint, since their animation durations cannot replay
 * exactly.
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
  if (
    record(value) &&
    (value.version === 1 ||
      ([rulesetSaveVersion, saveVersion].includes(value.version as number) &&
        'frames' in value))
  ) {
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
    ![2, 3, 4, 5, rulesetSaveVersion, saveVersion].includes(
      value.version as number
    ) ||
    Object.keys(value).length !== 4 ||
    !record(value.base) ||
    !Array.isArray(value.inputs) ||
    value.inputs.length > maxInputs ||
    !value.inputs.every(input => validInput(input, value.version as number))
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
  const game = savedGame(base.game, value.version as number);
  let start: Base;
  if (
    base.kind === 'title' &&
    (value.version as number) < saveVersion &&
    Object.keys(base).length === 1
  ) {
    // Title-screen journals from before version 7 predate rule choice.
    start = { kind: 'title', ruleset: 'original' };
  } else if (
    base.kind === 'title' &&
    value.version === saveVersion &&
    Object.keys(base).length === 2 &&
    isRuleset(base.ruleset)
  ) {
    start = { kind: 'title', ruleset: base.ruleset };
  } else if (
    base.kind === 'menu' &&
    (Object.keys(base).length === 3 || Object.keys(base).length === 5) &&
    Object.keys(base).every(key =>
      ['frames', 'game', 'kind', 'ulaFrames', 'keyboard'].includes(key)
    ) &&
    Number.isInteger(base.frames) &&
    (base.frames as number) >= 0 &&
    (base.frames as number) < framePeriod &&
    game !== undefined
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
      game,
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
          journal.press(input[1], 'held');
          break;
        case 'press':
          journal.press(input[1], 'brief');
          break;
        case 'let-go':
          journal.letGo();
          break;
        case 'saved':
          journal.saved();
          break;
        case 'reload':
          journal.reload();
          break;
      }
    }
    // Keys and fingers held when the session was saved have since lifted.
    journal.letGo();
    return journal;
  } catch {
    throw invalid();
  }
};
