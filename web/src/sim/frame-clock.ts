// Spectrum FRAMES is a 24-bit counter. The view supplies elapsed frames;
// the simulation never reads a wall clock or assumes host rendering speed.
export const framePeriod = 2 ** 24;

// Nominal PAL 48K ULA cadence, verified by the contention-aware reference.
// ROM FRAMES counts serviced interrupts; disabled interrupts can miss ticks.
export const spectrumClockHz = 3_500_000;
export const spectrumFrameT = 69_888;

export const validateFrames = (frames: number): void => {
  if (!Number.isInteger(frames) || frames < 0 || frames >= framePeriod) {
    throw new RangeError('FRAMES must be a 24-bit unsigned integer');
  }
};

export const createFrameClock = (initialFrames = 0) => {
  validateFrames(initialFrames);
  let frames = initialFrames;
  return {
    advance: (elapsed: number): number => {
      if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
        throw new RangeError(
          'Elapsed frames must be a nonnegative safe integer'
        );
      }
      frames = (frames + (elapsed % framePeriod)) % framePeriod;
      return frames;
    },
    get frames() {
      return frames;
    }
  };
};
