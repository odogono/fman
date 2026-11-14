import { expect, test } from 'bun:test';

import type { Moment } from './moments';
import { createPauseKeyboard } from './pause-keyboard';
import {
  createTicker,
  longestClip,
  tickerLeadIn,
  tickerPause,
  validClipLengths
} from './ticker';

const moments: readonly Moment[] = [
  { kind: 'goal', minute: 10, player: 23, side: 'club' },
  { kind: 'save', minute: 20, side: 'opponent' },
  { kind: 'goal', minute: 30, side: 'opponent' },
  { kind: 'near-miss', minute: 40, player: 17, side: 'club' }
];

test('each moment shows for one pause, then a final hold keeps them all', () => {
  const ticker = createTicker({ moments }, true, createPauseKeyboard());
  expect(ticker.shown).toEqual([]);
  ticker.advance(tickerLeadIn + tickerPause - 1);
  expect(ticker.shown).toEqual([]);
  for (let i = 1; i <= moments.length; i++) {
    ticker.advance(i === 1 ? 1 : tickerPause);
    expect(ticker.shown).toEqual(moments.slice(0, i));
  }
  ticker.advance(tickerPause);
  expect(ticker.shown).toEqual(moments);
  expect(ticker.done).toBe(false);
  ticker.advance(tickerPause);
  expect(ticker.done).toBe(true);
});

test('the score counts up as goals show, home first', () => {
  const away = createTicker({ moments }, false, createPauseKeyboard());
  expect(away.score).toEqual([0, 0]);
  away.advance(tickerLeadIn + tickerPause);
  expect(away.score).toEqual([0, 1]);
  away.advance(3 * tickerPause);
  expect(away.score).toEqual([1, 1]);
  const home = createTicker({ moments }, true);
  home.advance(tickerLeadIn + tickerPause);
  expect(home.score).toEqual([1, 0]);
});

test('a fresh keypress ends only the pause it lands in', () => {
  const keyboard = createPauseKeyboard();
  const ticker = createTicker({ moments }, true, keyboard);
  ticker.advance(10);
  keyboard.set('Space');
  ticker.advance(1);
  expect(ticker.shown).toHaveLength(1);
  keyboard.set('');
  ticker.advance(tickerPause - 1);
  expect(ticker.shown).toHaveLength(1);
  ticker.advance(1);
  expect(ticker.shown).toHaveLength(2);
});

test('a held key repeats, so holding it runs through the moments', () => {
  const keyboard = createPauseKeyboard();
  const ticker = createTicker({ moments }, true, keyboard);
  keyboard.set('Space');
  // The first scan comes before the first pause, which forgets it; the
  // repeats begin 35 scans later and come every 5, far sooner than the
  // six pauses would run on their own.
  ticker.advance(tickerLeadIn + 35);
  expect(ticker.shown).toHaveLength(1);
  ticker.advance(5 * (moments.length + 1));
  expect(ticker.done).toBe(true);
});

test('the Enter that kicked off cannot end the first pause', () => {
  // Pressed but not yet scanned, as a brief Enter is at kick-off.
  const keyboard = createPauseKeyboard({
    key: 'Enter',
    pending: false,
    repeat: 0,
    scanned: ''
  });
  const ticker = createTicker({ moments }, true, keyboard);
  ticker.advance(tickerLeadIn);
  keyboard.set('');
  ticker.advance(tickerPause - 1);
  expect(ticker.shown).toEqual([]);
});

test('skipping shows every moment but keeps the final hold', () => {
  const ticker = createTicker({ moments }, true, createPauseKeyboard());
  ticker.advance(5);
  ticker.skipPause();
  expect(ticker.shown).toEqual(moments);
  expect(ticker.score).toEqual([1, 1]);
  expect(ticker.done).toBe(false);
  ticker.advance(tickerPause - 1);
  expect(ticker.done).toBe(false);
  ticker.advance(1);
  expect(ticker.done).toBe(true);
});

test('skipping does nothing before the first pause, and ends the final hold', () => {
  const ticker = createTicker({ moments }, true, createPauseKeyboard());
  ticker.skipPause();
  expect(ticker.shown).toEqual([]);
  ticker.advance(tickerLeadIn);
  ticker.skipPause();
  ticker.skipPause();
  expect(ticker.done).toBe(true);
});

const clips = [120, 200, 160, 300];

test("clip lengths replace each moment's pause; the header and final hold keep 75", () => {
  const ticker = createTicker({ moments }, true, createPauseKeyboard(), clips);
  ticker.advance(tickerLeadIn + tickerPause - 1);
  expect(ticker.shown).toEqual([]);
  ticker.advance(1);
  for (let i = 1; i <= moments.length; i++) {
    expect(ticker.shown).toEqual(moments.slice(0, i));
    ticker.advance(clips[i - 1]! - 1);
    expect(ticker.shown).toEqual(moments.slice(0, i));
    expect(ticker.done).toBe(false);
    ticker.advance(1);
  }
  expect(ticker.shown).toEqual(moments);
  ticker.advance(tickerPause - 1);
  expect(ticker.done).toBe(false);
  ticker.advance(1);
  expect(ticker.done).toBe(true);
});

test('without clip lengths every pause keeps 75 frames', () => {
  const plain = createTicker({ moments }, true);
  expect(plain.lengths).toBeUndefined();
  expect(plain.endT).toBe(
    createTicker({ moments }, true, undefined, [75, 75, 75, 75]).endT
  );
});

test('a keypress ends a clip early and moves to the next moment', () => {
  const keyboard = createPauseKeyboard();
  const ticker = createTicker({ moments }, true, keyboard, clips);
  ticker.advance(tickerLeadIn + tickerPause + 10);
  expect(ticker.shown).toHaveLength(1);
  keyboard.set('Space');
  ticker.advance(1);
  expect(ticker.shown).toHaveLength(2);
  keyboard.set('');
  ticker.advance(clips[1]! - 1);
  expect(ticker.shown).toHaveLength(2);
  ticker.advance(1);
  expect(ticker.shown).toHaveLength(3);
});

test('skipping ends every clip but keeps the 75-frame final hold', () => {
  const ticker = createTicker({ moments }, true, createPauseKeyboard(), clips);
  ticker.advance(tickerLeadIn + tickerPause + 10);
  ticker.skipPause();
  expect(ticker.shown).toEqual(moments);
  ticker.advance(tickerPause - 1);
  expect(ticker.done).toBe(false);
  ticker.advance(1);
  expect(ticker.done).toBe(true);
});

test('clip lengths are whole, positive and bounded, one per moment', () => {
  expect(validClipLengths(clips, 4)).toBe(true);
  expect(validClipLengths(clips, 3)).toBe(false);
  expect(validClipLengths([1, longestClip], 2)).toBe(true);
  for (const bad of [0, -5, 1.5, longestClip + 1, Number.NaN, '75']) {
    expect(validClipLengths([75, bad], 2)).toBe(false);
  }
});
