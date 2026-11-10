import { beeperSignal, type SoundEvent } from '../sim/beeper';
import { spectrumClockHz } from '../sim/frame-clock';
import { createSoundScheduler, type Signal } from './sound-scheduler';

/** Integrate the one-bit pulse over each output sample (including partial edges). */
export const sampleBeeper = (signal: Signal, sampleRate: number) => {
  const samples = new Float32Array(
    Math.ceil((signal.durationT * sampleRate) / spectrumClockHz)
  );
  const sampleT = spectrumClockHz / sampleRate;
  let edge = 0;
  let high = false;
  for (let i = 0; i < samples.length; i++) {
    let t = i * sampleT;
    const end = Math.min(signal.durationT, (i + 1) * sampleT);
    let area = 0;
    while (t < end) {
      const next = Math.min(end, signal.edges[edge] ?? Infinity);
      if (high) {
        area += next - t;
      }
      t = next;
      if (t === signal.edges[edge]) {
        high = !high;
        edge++;
      }
    }
    samples[i] = (0.05 * area) / sampleT;
  }
  return samples;
};

export const createBeeper = () => {
  let context: AudioContext | undefined;
  let scheduler: ReturnType<typeof createSoundScheduler> | undefined;
  let muted = false;
  let click: AudioBufferSourceNode | undefined;
  let clickEnd = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const play = (signal: Signal, when: number, offset: number) => {
    const audio = context!;
    const samples = sampleBeeper(signal, audio.sampleRate);
    const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    sources.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
    };
    source.start(when, offset);
    return { source, stop: () => source.stop() };
  };
  const reset = () => {
    scheduler?.reset();
    for (const source of sources) {
      source.stop();
    }
    sources.clear();
    click = undefined;
    clickEnd = 0;
  };
  return {
    click: () => {
      if (muted || context?.state !== 'running') {
        return;
      }
      click?.stop();
      const signal = beeperSignal(200, 0, 0);
      click = play(signal, context.currentTime, 0).source;
      clickEnd = context.currentTime + signal.durationT / spectrumClockHz;
    },
    set muted(value: boolean) {
      if (muted !== value) {
        reset();
      }
      muted = value;
    },
    reset,
    restart: () => scheduler?.reset(),
    sync: (events: readonly SoundEvent[], nowT: number) => {
      if (!muted && context?.state === 'running') {
        scheduler?.sync(events, nowT);
      }
    },
    unlock: () => {
      if (typeof AudioContext === 'undefined') {
        return;
      }
      if (!context) {
        context = new AudioContext();
        scheduler = createSoundScheduler({
          now: () => Math.max(context!.currentTime, clickEnd),
          play
        });
        context.addEventListener('statechange', () => {
          if (context?.state !== 'running') {
            reset();
          }
        });
      }
      return context.resume().catch(() => {});
    }
  };
};
