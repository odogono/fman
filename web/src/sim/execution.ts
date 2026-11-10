import costs from './execution-costs.json';
import { spectrumFrameT } from './frame-clock';
import type { HighlightFrame, SpriteDraw } from './highlights';

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

export const executionBudget = (from: string, to: string): Budget => {
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

/** ROM BEEP operand quantization; the playback clock accounts for its DI span. */
export const beepRegisters = (duration: number, pitch: number) => {
  const frequency = 261.625_565_300_598_6 * 2 ** (pitch / 12);
  return {
    de: Math.round(duration * frequency) - 1,
    hl: Math.round(437_500 / frequency - 30.125)
  };
};

const ioDelay = (t: number) => {
  const phase =
    (((t % spectrumFrameT) + spectrumFrameT) % spectrumFrameT) - 14_335;
  return phase >= 0 && phase < 192 * 224 && phase % 224 < 128
    ? Math.max(0, 6 - (phase % 8))
    : 0;
};
export const beeperT = (hl: number, de: number, startT: number): number => {
  let t = startT + 221 - 16 * (hl % 4);
  for (let edge = 0; edge < 2 * (de + 1); edge++) {
    t += ioDelay(t + 1);
    if (edge < 2 * de + 1) {
      t += 4 * hl + 118;
    }
  }
  return t + 68 - startT;
};

type Event = Omit<HighlightFrame, 'duration'> & { t: number };

/** A small execution-path scheduler, fed by the same branches as the sim. */
export const createExecution = (startT = 0) => {
  let t = startT;
  let current: string | undefined;
  let draws: SpriteDraw[] = [];
  let tone: HighlightFrame['tones'][number] | undefined;
  let drawing: number | undefined;
  type TextField = 'text' | 'trophy' | 'stars' | 'outcomeChars' | 'scoreChars';
  let printing: { field: TextField; offset: number } | undefined;
  const events: Event[] = [];
  const path: string[] = [];
  const emit = (at: number, fields: Partial<Event> = {}) => {
    events.push({ draws: [], kind: 'draw', t: at, tones: [], ...fields });
  };
  const at = (line: number, statement = 0) => {
    const next = `${line}:${statement}`;
    if (current) {
      const budget = executionBudget(current, next);
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
      events.sort((a, b) => a.t - b.t);
      const frames: HighlightFrame[] = events.map((event, index) => {
        const { t: eventT, ...frame } = event;
        return {
          ...frame,
          duration: ((events[index + 1]?.t ?? t) - eventT) / spectrumFrameT
        };
      });
      return frames;
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
