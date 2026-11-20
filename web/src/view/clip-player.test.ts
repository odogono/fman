import { expect, test } from 'bun:test';

import { spectrumFrameT } from '../sim/frame-clock';
import { createJournal, openSave, type Journal } from '../sim/journal';
import { tickerLeadIn, tickerPause } from '../sim/ticker';
import { submitInput } from '../test/input';
import { clipScriptsFor } from './clip-match';
import { createClipPlayer } from './clip-player';

/** A game under moment highlights, kicked off into the ticker. */
const kickedOff = () => {
  const journal = createJournal({ kind: 'title', ruleset: 'enhanced-7' });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', '99', '', '99']) {
    submitInput(journal, text);
  }
  return journal;
};

const tickerOf = (journal: Journal) => {
  const view = journal.session.view;
  if (view.screen !== 'highlights' || view.highlights.kind !== 'moments') {
    throw new Error('No ticker');
  }
  return {
    fixture: view.fixture,
    game: view.game,
    ticker: view.highlights.timeline
  };
};

/** The match kicked off with its clips' lengths handed to the sim. */
const playing = () => {
  const journal = kickedOff();
  const player = createClipPlayer();
  const lengths = player.kickOff(journal.session.view)!;
  expect(journal.holdClips(lengths)).toBe(true);
  const { fixture, game, ticker } = tickerOf(journal);
  const scripts = clipScriptsFor(game, fixture, ticker.moments);
  if (scripts.length < 2) {
    throw new Error('Needs two moments');
  }
  const state = () => player.state(journal.session.view)!;
  return { journal, player, scripts, state };
};

test('at kick-off it gives one clip length per moment, and only then', () => {
  const journal = kickedOff();
  const player = createClipPlayer();
  const { fixture, game, ticker } = tickerOf(journal);
  // Without lengths the match plays as the plain ticker.
  expect(player.state(journal.session.view)).toBeUndefined();
  const lengths = player.kickOff(journal.session.view)!;
  expect(lengths).toEqual(
    clipScriptsFor(game, fixture, ticker.moments).map(s => s.length)
  );
  journal.holdClips(lengths);
  expect(tickerOf(journal).ticker.lengths).toEqual(lengths);
  // Held once, there is nothing more to hand over.
  expect(player.kickOff(journal.session.view)).toBeUndefined();
  // A match already under way never takes lengths.
  const late = kickedOff();
  late.advance(1);
  expect(player.kickOff(late.session.view)).toBeUndefined();
});

test('the 0-0 header shows both sides in shape under "Kick-off"', () => {
  const { journal, state } = playing();
  journal.advance(tickerLeadIn + 5);
  expect(state()).toMatchObject({
    phase: 'kick-off',
    progress: { drawer: false, full: false, shown: 0 },
    score: [0, 0]
  });
  expect(state().shot.frame.card?.text).toBe('Kick-off');
});

test('partway through a clip, its moment shows only once the clip reaches it', () => {
  const { journal, scripts, state } = playing();
  const first = scripts[0]!;
  journal.advance(tickerLeadIn + tickerPause + first.momentFrame - 1);
  expect(state().phase).toBe('clip');
  expect(state().progress.shown).toBe(0);
  expect(state().score).toEqual([0, 0]);
  // The ticker has already counted it; the clip has not.
  expect(tickerOf(journal).ticker.shown).toHaveLength(1);
  const at = tickerOf(journal).ticker.pauseElapsedT / spectrumFrameT;
  expect(state().shot.frame).toEqual(first.frame(at));
  journal.advance(1);
  expect(state().progress.shown).toBe(1);
  expect(state().score).toEqual(tickerOf(journal).ticker.score);
});

test('Skip shows every moment and the final score for the final hold', () => {
  const { journal, player, scripts, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + 30);
  journal.skipPause();
  // Skip alone ends the clips; the player is told so the full list shows.
  expect(state().progress.full).toBe(false);
  player.skip(journal.session.view);
  expect(state()).toMatchObject({
    phase: 'full-time',
    progress: { drawer: false, full: true, shown: scripts.length },
    score: tickerOf(journal).ticker.score
  });
  expect(state().shot.frame.card?.text).toBe('Full time');
});

test('left to play, the clips run to the "Full time" hold', () => {
  const { journal, scripts, state } = playing();
  const total = scripts.reduce((sum, s) => sum + s.length, 0);
  journal.advance(tickerLeadIn + tickerPause + total - 1);
  expect(state().phase).toBe('clip');
  journal.advance(1);
  expect(state()).toMatchObject({
    phase: 'full-time',
    progress: { full: false, shown: scripts.length }
  });
  expect(state().shot.frame.card?.text).toBe('Full time');
});

test('a match resumed mid-clip picks the clip up at the same frame', () => {
  const { journal, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + 400);
  const resumed = openSave(journal.snapshot());
  const after = createClipPlayer();
  expect(after.kickOff(resumed.session.view)).toBeUndefined();
  expect(after.state(resumed.session.view)).toEqual(state());
});

test('the drawer opens only once a moment shows, and Skip closes it', () => {
  const { journal, player, scripts, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + 5);
  player.showDrawer(journal.session.view, true);
  journal.advance(scripts[0]!.momentFrame);
  expect(state().progress).toMatchObject({ drawer: false, shown: 1 });
  player.showDrawer(journal.session.view, true);
  expect(state().progress.drawer).toBe(true);
  // It stays open as the next clip plays.
  journal.advance(scripts[0]!.length);
  expect(state().progress.drawer).toBe(true);
  player.showDrawer(journal.session.view, false);
  expect(state().progress.drawer).toBe(false);
  player.showDrawer(journal.session.view, true);
  journal.skipPause();
  player.skip(journal.session.view);
  expect(state().progress).toMatchObject({ drawer: false, full: true });
  // A new player, as on a resumed page, starts with it closed.
  expect(createClipPlayer().state(journal.session.view)!.progress.drawer).toBe(
    false
  );
});

/** A keypress or tap: it ends the clip on show. */
const tap = (journal: Journal) => {
  journal.press('Space', 'held');
  journal.advance(1);
  journal.release();
};

test('played through, a clip wipes into the next across their ends', () => {
  const { journal, scripts, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + scripts[0]!.length - 10);
  const out = state().shot;
  expect(out.wipe?.to?.frame).toEqual(scripts[1]!.frame(0));
  journal.advance(10);
  const into = state().shot;
  expect(into.frame).toEqual(scripts[1]!.frame(0));
  expect(into.wipe?.from?.frame).toEqual(
    scripts[0]!.frame(scripts[0]!.length - 1)
  );
  expect(into.wipe!.progress).toBeGreaterThan(out.wipe!.progress);
});

test('a tap ends a clip with a whole wipe from where it was, and a tap mid-wipe cuts', () => {
  const { journal, scripts, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + 100);
  const left = state().shot;
  expect(left.wipe).toBeUndefined();
  tap(journal);
  const into = state().shot;
  expect(into.frame).toEqual(scripts[1]!.frame(0));
  expect(into.wipe?.from?.frame).toEqual(left.frame);
  expect(into.wipe!.progress).toBeLessThan(0.1);
  journal.advance(10);
  expect(state().shot.wipe?.from).toBe(into.wipe!.from);
  // Tapped again mid-wipe, it jumps to the newest picture.
  tap(journal);
  const cut = state().shot;
  expect(cut.wipe).toBeUndefined();
  journal.advance(10);
  expect(state().shot.wipe).toBeUndefined();
});

test('Skip wipes from the clip on show into the "Full time" hold', () => {
  const { journal, player, state } = playing();
  journal.advance(tickerLeadIn + tickerPause + 100);
  const left = state().shot;
  journal.skipPause();
  player.skip(journal.session.view);
  const shot = state().shot;
  expect(shot.frame.card?.text).toBe('Full time');
  expect(shot.wipe?.from?.frame).toEqual(left.frame);
});

test('a save holding other clip lengths wipes on the lengths it holds', () => {
  const journal = kickedOff();
  const player = createClipPlayer();
  const lengths = player.kickOff(journal.session.view)!;
  // As if the clips were made longer since the save: the first runs on.
  const held = [lengths[0]! + 100, ...lengths.slice(1)];
  journal.holdClips(held);
  const state = () => player.state(journal.session.view)!;
  journal.advance(tickerLeadIn + tickerPause + lengths[0]! - 10);
  expect(state().shot.wipe).toBeUndefined();
  journal.advance(100);
  const out = state().shot;
  expect(out.wipe?.to).toBeDefined();
  expect(out.wipe!.progress).toBeCloseTo(10 / 40);
  // Past the clip's own end, its last frame holds.
  expect(out.frame).toEqual(
    clipScriptsFor(
      tickerOf(journal).game,
      tickerOf(journal).fixture,
      tickerOf(journal).ticker.moments
    )[0]!.frame(lengths[0]! - 1)
  );
});

test('rewound from full time, the last clip plays again while the hold waits', () => {
  const { journal, player, scripts, state } = playing();
  const total = scripts.reduce((sum, s) => sum + s.length, 0);
  journal.advance(tickerLeadIn + tickerPause + total + 5);
  expect(state().phase).toBe('full-time');
  const elapsed = tickerOf(journal).ticker.elapsedT;
  player.rewind(journal.session.view);
  expect(player.holding(journal.session.view)).toBe(true);
  expect(state()).toMatchObject({
    phase: 'clip',
    progress: { playing: scripts.length - 1 }
  });
  expect(state().bar?.at).toBe(0);
  const last = scripts.at(-1)!;
  // Pause and Next wait for full time; Continue ends it.
  player.playPause(journal.session.view);
  expect(state().progress.paused).toBe(true);
  player.playPause(journal.session.view);
  expect(player.advance(journal.session.view, last.length)).toBe(true);
  expect(state().phase).toBe('full-time');
  expect(player.advance(journal.session.view, 10)).toBe(false);
  expect(tickerOf(journal).ticker.elapsedT).toBe(elapsed);
});
