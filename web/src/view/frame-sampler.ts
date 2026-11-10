// requestAnimationFrame timestamps mark the start of a frame and can precede
// performance.now() sampled during initialization. Never run the sim backwards.
export const createFrameSampler = (started: number) => {
  let previous = started;
  let pending = 0;
  return (now: number): number => {
    pending += Math.max(0, now - previous) / 20;
    previous = Math.max(previous, now);
    const frames = Math.floor(pending);
    pending -= frames;
    return frames;
  };
};
