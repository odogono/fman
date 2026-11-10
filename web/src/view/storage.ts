// Browser storage for the autosave, save slots and options. Every access is
// guarded: private windows and full quotas throw, and play must continue.
export const slotCount = 5;
const autosaveKey = 'fman:autosave';
const optionsKey = 'fman:options';
const slotKey = (slot: number) => `fman:slot:${slot}`;

export type SlotEntry = { data: string; label: string; savedAt: string };
export type Options = { scale: 'auto' | 1 | 2 | 3; sound: boolean };
export const defaultOptions: Options = { scale: 'auto', sound: true };

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const readAutosave = () => read(autosaveKey);
export const writeAutosave = (data: string) => write(autosaveKey, data);

export const readSlot = (slot: number): SlotEntry | undefined => {
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
};
export const writeSlot = (slot: number, entry: SlotEntry) =>
  write(slotKey(slot), JSON.stringify(entry));

export const readOptions = (): Options => {
  try {
    const value = JSON.parse(read(optionsKey) ?? 'null');
    return {
      scale: [1, 2, 3].includes(value?.scale) ? value.scale : 'auto',
      sound: value?.sound !== false
    };
  } catch {
    return defaultOptions;
  }
};
export const writeOptions = (options: Options) =>
  write(optionsKey, JSON.stringify(options));
