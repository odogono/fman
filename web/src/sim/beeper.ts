import { spectrumFrameT } from './frame-clock';

export type Tone = { duration: number; pitch: number };
export type SoundEvent = {
  de: number;
  hl: number;
  id: string;
  /** BEEPER entry in the ULA clock domain, for contention. */
  phaseT: number;
  /** Absolute session time; independent of ROM FRAMES and browser callbacks. */
  startT: number;
};

/** The game's reachable integer pitches and positive BEEP durations. */
export const beepRegisters = (duration: number, pitch: number) => {
  const frequency = 261.625_565_300_598_6 * 2 ** (pitch / 12);
  return {
    de: Math.round(duration * frequency) - 1,
    hl: Math.round(437_500 / frequency - 30.125)
  };
};

const contention = (t: number) => {
  const phase =
    (((t % spectrumFrameT) + spectrumFrameT) % spectrumFrameT) - 14_335;
  return phase >= 0 && phase < 192 * 224 && phase % 224 < 128
    ? Math.max(0, 6 - (phase % 8))
    : 0;
};

/** OUT completion is the declared speaker-edge convention of the capture. */
export const beeperSignal = (hl: number, de: number, startT: number) => {
  // The initial BORDCR read is contended RAM; the loop itself lives in ROM.
  let t = startT + 221 - 16 * (hl % 4) + contention(startT + 85);
  const edges: number[] = [];
  const starts: number[] = [];
  for (let edge = 0; edge < 2 * (de + 1); edge++) {
    starts.push(t - startT);
    const delay = contention(t + 8); // OUT: N:1, C:3 for an uncontended even port.
    edges.push(t + 11 + delay - startT);
    if (edge < 2 * de + 1) {
      t += 4 * hl + 118 + delay;
    }
  }
  return { durationT: edges.at(-1)! + 57, edges, starts };
};
export const beeperT = (hl: number, de: number, startT: number) =>
  beeperSignal(hl, de, startT).durationT;
