import { expect, test } from 'bun:test';

import { createSession } from '../sim/session';
import { viewOn } from '../sim/view-on';
import { makeScreen } from './screen';

test('cup fixture, replay and score keep home/away order while the strength summary keeps the managed club first', () => {
  const session = createSession();
  session.skipPause();
  for (const text of ['alex', '1', '1', '0', '99', '', '99']) {
    session.submit(text);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  session.advance((65_536 - (session.view.frames % 65_536)) % 65_536);
  session.submit('99');
  session.submit('99');
  expect(makeScreen(session.view).lines[0]).toContain(
    'F.A.Cup Match - Round 1'
  );
  const { fixture } = viewOn(session, 'fixture');
  const club = session.view.game!.clubs[session.view.game!.club - 1]!.name;
  const opponent = session.view.game!.clubs[fixture.opponent - 1]!.name;
  expect(makeScreen(session.view).lines[2]).toContain(
    fixture.home
      ? `${club.padEnd(10)} v ${opponent.padEnd(10)}`
      : `${opponent.padEnd(10)} v ${club.padEnd(10)}`
  );
  session.submit('');
  const team = makeScreen(session.view);
  expect(team.lines[0]!.slice(10, 10 + club.length)).toBe(club);
  session.submit('99');
  session.advance(1_000_000);
  const result = makeScreen(session.view);
  expect(
    result.lines[1]!.slice(0, (fixture.home ? club : opponent).length)
  ).toBe(fixture.home ? club : opponent);
  session.submit('');
  expect(makeScreen(session.view).lines[0]).toContain('Replay-');
  session.submit('');
  expect(makeScreen(session.view).lines[2]).toContain(
    fixture.home
      ? `${opponent.padEnd(10)} v ${club.padEnd(10)}`
      : `${club.padEnd(10)} v ${opponent.padEnd(10)}`
  );
});
