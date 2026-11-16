import { expect, test } from 'bun:test';

import type { View } from '../sim/session';
import { playTo } from '../test/play';
import { celebrationSidesFor } from './clip-match';
import { cupReplayFor, cupResultFor } from './cup-screens';
import { modernScreenFor } from './modern-screen';

type CupView = Extract<View, { screen: 'cup-result' }>;

const decided = playTo('cup-result');
const { fixture, game } = decided;
const opponent = game.clubs[fixture.opponent - 1]!.name.trim();
const club = game.clubs[game.club - 1]!.name.trim();

/** The tie decided `ours`–`theirs` for the managed club. */
const tie = (ours: number, theirs: number, changes: Partial<CupView> = {}) => {
  const view: CupView = {
    ...decided,
    game: { ...game, cupFinished: ours < theirs },
    score: fixture.home ? [ours, theirs] : [theirs, ours],
    ...changes
  };
  return view;
};

test('the cup result, the replay notice and the celebration show Modern screens', () => {
  expect(modernScreenFor(decided)?.kind).toBe('cup-result');
  expect(modernScreenFor({ ...decided, screen: 'replay' })?.kind).toBe(
    'cup-replay'
  );
  expect(
    modernScreenFor({
      ...decided,
      celebration: 1,
      celebrationProgress: { stars: 0, text: 0, trophy: 40 },
      screen: 'cup-celebration'
    })?.kind
  ).toBe('cup-result');
});

test('a won tie names the next round and the win', () => {
  const screen = cupResultFor(tie(2, 1))!;
  expect(screen.outcome).toBe('through');
  expect(screen.headline).toBe(`Through to Round ${game.cupRound + 1}`);
  expect(screen.tie).toBe(`Beat ${opponent} 2–1`);
  expect(screen.title).toBe(`F.A. Cup – Round ${game.cupRound}`);
  expect(screen.done).toEqual({ enabled: true, id: 'cup-result.continue' });
});

const into = (round: number) =>
  cupResultFor(tie(1, 0, { game: { ...game, cupRound: round } }))!.headline;

test('the later rounds lead to the Semi-Final and the Final', () => {
  expect(into(6)).toBe('Through to the Semi-Final');
  expect(into(7)).toBe('Through to the Final');
});

test('a lost tie is out of the cup, naming the defeat', () => {
  const screen = cupResultFor(tie(0, 3))!;
  expect(screen.outcome).toBe('out');
  expect(screen.headline).toBe('Out of the F.A. Cup');
  expect(screen.tie).toBe(`Lost to ${opponent} 0–3`);
});

test('winning the final celebrates, with the progress the original draws', () => {
  const won = tie(2, 1, {
    celebration: 9,
    game: { ...game, cupFinished: true, cupRound: 8 }
  });
  const screen = cupResultFor(won)!;
  expect(screen.outcome).toBe('won');
  expect(screen.headline).toBe("You've won the F.A. Cup");
  expect(screen.tie).toBe(`Beat ${opponent} 2–1 in the Final`);
  // At the end, the scene holds on the lift, in the final's kits.
  expect(screen.celebration?.progress).toEqual({
    stars: 1,
    text: 1,
    trophy: 1
  });
  expect(screen.celebration?.sides).toEqual(
    celebrationSidesFor(won.game, fixture)
  );
  expect(screen.celebration?.clock).toBe(won.ulaFrames ?? won.frames);
  const playing: View = {
    ...won,
    celebration: 2,
    celebrationProgress: { stars: 72, text: 32, trophy: 160 },
    screen: 'cup-celebration',
    ulaFrames: 240
  };
  const shown = cupResultFor(playing)!;
  // Half the trophy's 320 cells, half the title's 64 characters, a quarter
  // of the 288 stars: the scene's run-in, lift and confetti follow them.
  expect(shown.celebration?.progress).toEqual({
    stars: 0.25,
    text: 0.5,
    trophy: 0.5
  });
  expect(shown.celebration?.clock).toBe(240);
  // The celebration takes no answer; a finger only shortens its pauses.
  expect(shown.done.enabled).toBe(false);
});

test('the replay notice names the replay, at the other ground', () => {
  const screen = cupReplayFor({ ...decided, screen: 'replay' })!;
  expect(screen.title).toBe(`F.A. Cup – Round ${game.cupRound}`);
  const [home, away] = fixture.home ? [opponent, club] : [club, opponent];
  expect([screen.home.name, screen.away.name]).toEqual([home, away]);
  expect(screen.done).toEqual({ enabled: true, id: 'replay.continue' });
});
