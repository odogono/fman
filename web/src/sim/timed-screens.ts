import { createExecution } from './execution';
import { spectrumFrameT } from './frame-clock';
import type { HighlightFrame } from './highlights';
import type { PauseKeyboard } from './pause-keyboard';
import { createTimeline } from './timeline';

const screenPlayback = (
  events: readonly HighlightFrame[],
  keyboard: PauseKeyboard,
  phase: number
) => {
  let text = 0;
  let trophy = 0;
  let stars = 0;
  const timeline = createTimeline(
    events,
    keyboard,
    event => {
      text = event.text ?? text;
      trophy = event.trophy ?? trophy;
      stars = event.stars ?? stars;
    },
    phase
  );
  return {
    ...timeline,
    get current() {
      return timeline.current;
    },
    get done() {
      return timeline.done;
    },
    durationT: events.reduce(
      (sum, event) => sum + Math.round(event.duration * spectrumFrameT),
      0
    ),
    get elapsedT() {
      return timeline.elapsedT;
    },
    get endT() {
      return timeline.endT;
    },
    get index() {
      return timeline.index;
    },
    get progress() {
      return { stars, text, trophy };
    },
    get remainingT() {
      return timeline.remainingT;
    },
    get sounds() {
      return timeline.sounds;
    }
  };
};

/** Title entry retains the reference snapshot's half-frame phase. */
export const titlePlayback = (keyboard: PauseKeyboard) => {
  const phase = 34_943;
  const execution = createExecution(phase);
  execution.pitch(0); // An empty event at program entry, before CLS.
  execution.at(8);
  execution.at(8, 1);
  execution.clearKey();
  execution.printing('text');
  execution.at(8, 2);
  execution.pause(300);
  execution.at(9);
  return screenPlayback(execution.finish(), keyboard, phase);
};

export const errorPlayback = (
  keyboard: PauseKeyboard,
  text: string,
  frames: number,
  phase = 0
) => {
  const execution = createExecution(phase);
  execution.pitch(0);
  const manager = text.startsWith('Name is too long');
  const line = manager ? 9 : frames === 300 ? 3240 : 8966;
  const print = manager ? 11 : frames === 300 ? 2 : 5;
  const pause = manager ? 12 : frames === 300 ? 3 : 7;
  execution.at(line, manager ? 9 : frames === 300 ? 0 : 3);
  if (line === 8966) {
    execution.at(line, 4);
  }
  execution.at(line, print);
  execution.clearKey();
  execution.printing('text');
  execution.at(line, pause);
  execution.pause(frames);
  execution.at(line, pause + 1);
  const events = execution.finish();
  const printed = events.filter(event => event.text !== undefined).length;
  return screenPlayback(
    events.map(event =>
      event.text === undefined
        ? event
        : { ...event, text: Math.ceil((event.text * text.length) / printed) }
    ),
    keyboard,
    phase
  );
};

export const cupPlayback = (keyboard: PauseKeyboard, phase = 0) => {
  const execution = createExecution(phase);
  execution.pitch(0);
  execution.at(5213);
  execution.printing('trophy');
  execution.at(5214);
  execution.printing('text');
  execution.at(5216);
  for (let i = 1; i <= 9; i++) {
    execution.at(5216, 1);
    execution.printing('stars', (i - 1) * 32);
    execution.at(5216, 2);
    execution.tone({ duration: 0.2, pitch: i });
    execution.at(5216, 3);
  }
  execution.at(5218);
  return screenPlayback(execution.finish(), keyboard, phase);
};
export type TimedScreen = ReturnType<typeof titlePlayback>;
