// Storage for the autosave, save slots and options. Every access is guarded:
// private windows and full quotas throw, and play must continue.
import { defaultRules, isRules, type Rules } from './rules';

export const slotCount = 5;
const autosaveKey = 'fman:autosave';
const optionsKey = 'fman:options';
const slotKey = (slot: number) => `fman:slot:${slot}`;

export type SlotEntry = {
  data: string;
  label: string;
  /** Absent on slots saved before rule choice, which hold Original games. */
  rules?: Rules;
  savedAt: string;
};
/** The presentation mode: the original screens, or screens redesigned for phones. */
export type Presentation = 'classic' | 'modern';
export type Options = {
  presentation: Presentation;
  /** The rules last chosen for a new game, pre-selected next time (ADR 0009). */
  rules: Rules;
  scale: 'auto' | 1 | 2 | 3;
  sound: boolean;
  /** Classic mode's context bar: shown on touch-first devices when `auto`. */
  touch: 'auto' | 'on' | 'off';
};
export const defaultOptions: Options = {
  presentation: 'modern',
  rules: defaultRules,
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
          presentation:
            value?.presentation === 'classic' ? 'classic' : 'modern',
          rules: isRules(value?.rules) ? value.rules : defaultRules,
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
          typeof value.savedAt === 'string' &&
          (value.rules === undefined || isRules(value.rules))
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
