import { expect, test } from 'bun:test';

import { submitInput } from '../test/input';
import reference from './fixtures/frame-reseeding.json';
import { framePeriod, spectrumClockHz, spectrumFrameT } from './frame-clock';
import { createNewGame } from './management';
import { createSession, type Session } from './session';

const runNamed = (name: string) => {
  const run = reference.runs.find(run => run.name === name);
  if (!run) {
    throw new Error(`Missing frame reference: ${name}`);
  }
  return run;
};
const checkpoint = (name: string, kind: string, line: number, index = 0) => {
  const event = runNamed(name).events.filter(
    event => event.kind === kind && event.line === line
  )[index];
  if (event?.romFrames === undefined || event.seed === undefined) {
    throw new Error(`Missing ${kind} at ${name}:${line}`);
  }
  return { ...event, romFrames: event.romFrames, seed: event.seed };
};
const advanceTo = (session: Session, frames: number) => {
  session.advance((frames - session.view.frames + framePeriod) % framePeriod);
  // This test supplies observed serviced-interrupt counts. Playback now loses
  // interrupts during BEEPER; finish the supplied boundary after playback.
  session.advance((frames - session.view.frames + framePeriod) % framePeriod);
};
const setup = (name: string) => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  for (const text of ['alex', '1', '1']) {
    session.submit(text);
  }
  const observed = checkpoint(name, 'randomize-exit', 100);
  advanceTo(session, observed.romFrames);
  session.submit('0');
  expect(session.view.game!.seed).toBe(observed.seed);
  return session;
};

test('the browser cadence constants match the validated timing reference', () => {
  expect(spectrumClockHz).toBe(reference.clockHz);
  expect(spectrumFrameT).toBe(reference.frameT);
});

test('setup restores the raw starting seed before the timed line-100 reseed', () => {
  const before = checkpoint(
    'setup-status-save-continue',
    'randomize-enter',
    100
  );
  const game = createNewGame({
    club: 1,
    colour: 0,
    level: 1,
    manager: 'alex',
    seed: 0
  });
  expect(game.seed).toBe(before.seed);
  setup('setup-status-save-continue');
});

test('status returns preserve the original seed; post-SAVE yes reaches RANDOMIZE again', () => {
  const name = 'setup-status-save-continue';
  const session = setup(name);
  const status = checkpoint(name, 'checkpoint', 2000, 1);
  session.submit('s');
  advanceTo(session, status.romFrames);
  session.submit('');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.seed).toBe(status.seed);

  const save = checkpoint(name, 'checkpoint', 800);
  advanceTo(session, save.romFrames);
  expect(session.submit('keep')?.type).toBe('save');
  expect(session.view.game!.seed).toBe(save.seed);
  session.saved();
  const continued = checkpoint(name, 'randomize-exit', 100, 1);
  advanceTo(session, continued.romFrames);
  session.submit('yes');
  expect(session.view.game!.seed).toBe(continued.seed);
  expect(session.view.frames).toBe(continued.romFrames);

  // SAVE runs with DI: elapsed ULA frames are not serviced ROM interrupts.
  const question = checkpoint(name, 'checkpoint', 805);
  expect(Math.floor((question.t - save.t) / reference.frameT)).toBeGreaterThan(
    question.romFrames - save.romFrames
  );
});

test('a completed match and declined transfer return through the timed reseed boundary', () => {
  const name = 'match-management-return';
  const session = setup(name);
  for (const text of ['99', '', '99']) {
    submitInput(session, text);
  }
  const before = checkpoint(name, 'randomize-enter', 100, 1);
  advanceTo(session, before.romFrames);
  expect(session.view.screen).toBe('result');
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  expect(session.view.screen).toBe('transfer');
  expect(session.view.game!.seed).toBe(before.seed);
  const after = checkpoint(name, 'randomize-exit', 100, 1);
  // Align after the newly modeled result/table/bills/bid prompt waits.
  advanceTo(session, after.romFrames);
  session.submit('99');
  expect(session.view.screen).toBe('menu');
  expect(session.view.game!.seed).toBe(after.seed);
  expect(session.view.frames).toBe(after.romFrames);
});
