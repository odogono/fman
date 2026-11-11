import { beepRegisters, beeperT } from './beeper';
import costs from './execution-costs.json';
import { spectrumFrameT } from './frame-clock';
import type { HighlightFrame, SpriteDraw } from './highlights';

export { beepRegisters, beeperT } from './beeper';

type Budget = readonly number[];
const budgets: Readonly<Record<string, Budget>> = costs;

/** Measured interpreter work for a dispatch edge, independent of game seed. */
const measuredBudget = (from: string, to: string): Budget | undefined => {
  const exact = budgets[`${from}>${to}`];
  if (exact) {
    return exact;
  }
  // Unobserved branches still execute the same statement. Prefer an edge
  // with the same fall-through/jump shape; never select by captured RNG state.
  const candidates = Object.entries(budgets).filter(([key]) =>
    key.startsWith(`${from}>`)
  );
  const local = from.split(':')[0] === to.split(':')[0];
  const measured =
    candidates.find(
      ([key]) =>
        (key.split('>')[1]!.split(':')[0] === from.split(':')[0]) === local
    )?.[1] ?? candidates[0]?.[1];
  return measured;
};

// Budgets depend only on the edge, so each is resolved once.
const resolved = new Map<string, Budget>();

export const executionBudget = (from: string, to: string): Budget => {
  const key = `${from}>${to}`;
  let budget = resolved.get(key);
  if (!budget) {
    budget = resolveBudget(from, to);
    resolved.set(key, budget);
  }
  return budget;
};

const resolveBudget = (from: string, to: string): Budget => {
  const measured = measuredBudget(from, to);
  if (measured) {
    return measured;
  }
  const [line, statement] = from.split(':').map(Number);
  if (line! >= 300 && line! <= 479) {
    // The two attack routines have matching statement structure.
    const mirrored = measuredBudget(
      `${line! < 400 ? line! + 100 : line! - 100}:${statement}`,
      to
    );
    if (mirrored) {
      return mirrored;
    }
  }
  if (from === '5101:2') {
    const forcedAttack = measuredBudget('5010:2', to);
    if (forcedAttack) {
      return forcedAttack;
    }
  }
  throw new RangeError(`Unmeasured execution statement ${from}`);
};

// The scheduler runs thousands of statements per match, so it looks budgets
// up by a numeric edge rather than building a string key for each one. A
// statement's id is line × 1000 + statement: BASIC lines stay below 10000
// and statements below 1000, so ids stay below 10^7 and an edge below 10^14.
const statementId = (line: number, statement: number) =>
  line * 1000 + statement;
const edges = new Map<number, Budget>();

// An event becomes a frame once its duration is known. Times are kept
// beside the events, so a frame is the event itself and is not copied.
type Event = { -readonly [K in keyof HighlightFrame]?: HighlightFrame[K] };

/** A small execution-path scheduler, fed by the same branches as the sim. */
export const createExecution = (startT = 0) => {
  let t = startT;
  let current: string | undefined;
  let currentId = 0;
  let draws: SpriteDraw[] = [];
  let tone: HighlightFrame['tones'][number] | undefined;
  let drawing: number | undefined;
  type TextField = 'text' | 'trophy' | 'stars' | 'outcomeChars' | 'scoreChars';
  let printing: { field: TextField; offset: number } | undefined;
  const events: Event[] = [];
  const times: number[] = [];
  const path: string[] = [];
  const emit = (at: number, fields?: Event) => {
    events.push(
      fields
        ? { draws: [], kind: 'draw', tones: [], ...fields }
        : { draws: [], kind: 'draw', tones: [] }
    );
    times.push(at);
  };
  const at = (line: number, statement = 0) => {
    const next = `${line}:${statement}`;
    const nextId = statementId(line, statement);
    if (current) {
      const edge = currentId * 10_000_000 + nextId;
      let budget = edges.get(edge);
      if (!budget) {
        budget = executionBudget(current, next);
        edges.set(edge, budget);
      }
      if (printing) {
        for (const [i, offset] of budget.slice(1).entries()) {
          emit(t + Math.min(budget[0]!, offset), {
            [printing.field]: printing.offset + i + 1
          });
        }
      }
      for (const [i, draw] of draws.entries()) {
        emit(
          t +
            Math.min(
              budget[0]!,
              budget[i + 1] ??
                Math.floor((budget[0]! * (i + 1)) / (draws.length + 1))
            ),
          { draws: [draw] }
        );
      }
      if (drawing !== undefined) {
        const starts = budget.slice(1);
        for (const [i, begin] of starts.entries()) {
          const end = starts[i + 1] ?? budget[0]!;
          for (let sample = begin; sample < end; sample += spectrumFrameT) {
            emit(t + sample, {
              pitch:
                drawing + (i + (sample - begin) / (end - begin)) / starts.length
            });
          }
        }
        emit(t + budget[0]!, { pitch: drawing + 1 });
      }
      t += budget[0]!;
      if (tone) {
        const { de, hl } = beepRegisters(tone.duration, tone.pitch);
        const durationT = beeperT(hl, de, t);
        emit(t, { interrupts: false, tones: [tone] });
        t += durationT;
        emit(t);
      }
    }
    current = next;
    currentId = nextId;
    path.push(next);
    draws = [];
    tone = undefined;
    drawing = undefined;
    printing = undefined;
  };
  return {
    at,
    clearKey: () => emit(t, { clearKey: true }),
    draw: (draw: SpriteDraw) => draws.push(draw),
    drawing: (progress: number) => {
      drawing = progress;
    },
    finish: () => {
      // A stable sort by time, as events were emitted in order.
      const order = times.map((_, index) => index);
      order.sort((a, b) => times[a]! - times[b]!);
      return order.map((index, position) => {
        const event = events[index]!;
        const next = order[position + 1];
        event.duration =
          ((next === undefined ? t : times[next]!) - times[index]!) /
          spectrumFrameT;
        return event as HighlightFrame;
      });
    },
    mark: (checkpoint: NonNullable<HighlightFrame['checkpoint']>) =>
      emit(t, { checkpoint }),
    outcome: (kind: 'goal' | 'miss') =>
      emit(t, { kind, outcomeChars: 0, scoreChars: 0 }),
    path,
    pause: (frames: number) => {
      // FIND-INT2 precedes HALT. Natural expiry is after N interrupts, at
      // the end of the keyboard ISR, rather than N frames after entry.
      const enter = t + 5092;
      const exit =
        (Math.floor(enter / spectrumFrameT) + frames) * spectrumFrameT + 922;
      emit(enter, { kind: 'pause' });
      t += exit - enter;
      emit(exit);
    },
    pitch: (progress: number) => emit(t, { pitch: progress }),
    printing: (field: TextField, offset = 0) => {
      printing = { field, offset };
    },
    run: (line: number, start: number, end: number) => {
      for (let statement = start; statement <= end; statement++) {
        at(line, statement);
      }
    },
    get t() {
      return t;
    },
    tone: (value: HighlightFrame['tones'][number]) => {
      tone = value;
    }
  };
};
