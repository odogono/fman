import type { HighlightFrame } from '../sim/highlights';

export const createBeeper = () => {
  let context: AudioContext | undefined;
  return {
    play: (tones: HighlightFrame['tones']) => {
      if (!context || context.state !== 'running') {
        return;
      }
      let when = context.currentTime;
      for (const tone of tones) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = 261.625_565 * 2 ** (tone.pitch / 12);
        gain.gain.value = 0.025;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(when);
        when += tone.duration;
        oscillator.stop(when);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    },
    unlock: () => {
      if (typeof AudioContext === 'undefined') {
        return;
      }
      context ??= new AudioContext();
      void context.resume().catch(() => {});
    }
  };
};
