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
  if (view.screen !== 'highlights' || !('ticker' in view)) {
    throw new Error('No ticker');
  }
  return view;
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
  expect(state().shot.frame.caption).toBe('Kick-off');
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
  expect(state().shot.frame.caption).toBe('Full time');
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
  expect(state().shot.frame.caption).toBe('Full time');
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
