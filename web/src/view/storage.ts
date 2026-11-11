// Storage for the autosave, save slots and options. Every access is guarded:
// private windows and full quotas throw, and play must continue.
export const slotCount = 5;
const autosaveKey = 'fman:autosave';
const optionsKey = 'fman:options';
const slotKey = (slot: number) => `fman:slot:${slot}`;

export type SlotEntry = { data: string; label: string; savedAt: string };
export type Options = {
  scale: 'auto' | 1 | 2 | 3;
  sound: boolean;
  /** Classic mode's context bar: shown on touch-first devices when `auto`. */
  touch: 'auto' | 'on' | 'off';
};
export const defaultOptions: Options = {
  scale: 'auto',
  sound: true,
  touch: 'auto'
};

/** The key-value store underneath, such as `localStorage`; reaching it may throw too. */
export type StorageBackend = Pick<Storage, 'getItem' | 'setItem'>;

export const createStorage = (backend: () => StorageBackend) => {
  const read = (key: string) => {
    try {
      return backend().getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      backend().setItem(key, value);
      return true;
    } catch {
      return false;
    }
  };
  return {
    readAutosave: () => read(autosaveKey),
    readOptions: (): Options => {
      try {
        const value = JSON.parse(read(optionsKey) ?? 'null');
        return {
          scale: [1, 2, 3].includes(value?.scale) ? value.scale : 'auto',
          sound: value?.sound !== false,
          touch: ['on', 'off'].includes(value?.touch) ? value.touch : 'auto'
        };
      } catch {
        return defaultOptions;
      }
    },
    readSlot: (slot: number): SlotEntry | undefined => {
      try {
        const value = JSON.parse(read(slotKey(slot)) ?? 'null');
        return typeof value?.data === 'string' &&
          typeof value.label === 'string' &&
          typeof value.savedAt === 'string'
          ? value
          : undefined;
      } catch {
        return undefined;
      }
    },
    writeAutosave: (data: string) => write(autosaveKey, data),
    writeOptions: (options: Options) =>
      write(optionsKey, JSON.stringify(options)),
    writeSlot: (slot: number, entry: SlotEntry) =>
      write(slotKey(slot), JSON.stringify(entry))
  };
};
export type AppStorage = ReturnType<typeof createStorage>;
