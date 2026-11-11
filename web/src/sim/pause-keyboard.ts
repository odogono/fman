/** The PAUSE-relevant ROM keyboard state, advanced by serviced interrupts.
 * Releasing a key does not clear the pending FLAGS bit 5.
 */
export type PauseKeyboardState = {
  key: string;
  pending: boolean;
  repeat: number;
  scanned: string;
};
export const createPauseKeyboard = (initial?: PauseKeyboardState) => {
  let key = initial?.key ?? '';
  let scanned = initial?.scanned ?? '';
  let repeat = initial?.repeat ?? 0;
  let pending = initial?.pending ?? false;
  const advance = (frames: number) => {
    if (frames <= 0) {
      return;
    }
    if (key !== scanned) {
      scanned = key;
      repeat = 35;
      if (key) {
        pending = true;
      }
      frames--;
    }
    if (key) {
      if (frames >= repeat) {
        pending = true;
        repeat = 5 - ((frames - repeat) % 5);
      } else {
        repeat -= frames;
      }
    }
  };
  return {
    advance,
    clear: () => {
      pending = false;
    },
    /** No key is down or awaiting its first scan, so a scan changes nothing. */
    get idle() {
      return !key && !scanned;
    },
    get pending() {
      return pending;
    },
    scan: () => advance(1),
    set: (value: string) => {
      key = value;
    },
    get state(): PauseKeyboardState {
      return { key, pending, repeat, scanned };
    }
  };
};
export type PauseKeyboard = ReturnType<typeof createPauseKeyboard>;
