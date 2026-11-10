import { spectrumClockHz, spectrumFrameT } from '../sim/frame-clock';

const frameMs = (1000 * spectrumFrameT) / spectrumClockHz;

const validateTimestamp = (now: number) => {
  if (!Number.isFinite(now)) {
    throw new RangeError('Frame timestamp must be finite');
  }
};

// Sample both callbacks and input dispatch on one monotonic browser timeline.
// Count from the origin to avoid accumulating rounding error across callbacks.
export const createFrameSampler = (started: number) => {
  validateTimestamp(started);
  let origin = started;
  let previous = started;
  let emitted = 0;
  return (now: number, running = true): number => {
    validateTimestamp(now);
    // RAF timestamps can precede performance.now() from a recent input.
    const latest = Math.max(previous, now);
    if (!running) {
      // Exclude a host-menu interval without throwing away fractional phase.
      origin += latest - previous;
      previous = latest;
      return 0;
    }
    previous = latest;
    let total = Math.floor((latest - origin) / frameMs);
    // Compare absolute boundaries too: subtracting a large origin can round
    // an exactly represented boundary down (e.g. 5019.968 - 5000).
    if (latest >= origin + (total + 1) * frameMs) {
      total++;
    } else if (latest < origin + total * frameMs) {
      total--;
    }
    // Moving the origin across a long menu interval can lose sub-millisecond
    // precision, but must never take back a frame already delivered to the sim.
    total = Math.max(emitted, total);
    const elapsed = total - emitted;
    emitted = total;
    return elapsed;
  };
};
