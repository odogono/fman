import { expect, test } from 'bun:test';

import { createSession } from '../sim/session';
import { viewOn } from '../sim/view-on';
import { makeScreen } from './screen';

test('the market displays its player, current asking value and bid/copy prompts', () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  for (const input of ['alex', '1', '1', '0', '99', '', '99']) {
    session.submit(input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    session.submit('');
  }
  const player =
    session.view.game!.players[viewOn(session, 'transfer').playerId - 1]!;
  const display = makeScreen(session.view);
  expect(display.lines[0]).toBe('****Transfer Market****         ');
  expect(display.lines.join('\n')).toContain(player.name);
  expect(display.lines.join('\n')).toContain(`£${player.value}`);
  expect(display.lines.join('\n')).toContain('Type your bid (£)');
  expect(display.lines[21]).toContain('(h=copy)');
  expect(display.numeric).toBe(true);
  session.submit('0');
  session.submit('');
  const changed = session.view.game!.players[player.id - 1]!;
  expect(makeScreen(session.view).lines.join('\n')).toContain(
    `£${changed.value}`
  );
});
