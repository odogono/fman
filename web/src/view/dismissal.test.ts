import { expect, test } from 'bun:test';

import observations from '../sim/fixtures/dismissal.json';
import {
  createNewGame,
  isDismissed,
  payWeeklyBills,
  type Player
} from '../sim/management';
import { createSession } from '../sim/session';
import { makeScreen } from './screen';

for (const observation of observations) {
  test(`original bill/dismissal text: division ${observation.division}, ${observation.scenario}`, () => {
    const fresh = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      seed: 0
    });
    const paid = payWeeklyBills({
      ...fresh,
      cash: observation.cash,
      debt: observation.debt,
      division: observation.division,
      players: fresh.players.map((p, i): Player => ({
        ...p,
        skill: observation.skills[i]!,
        status: observation.initialStatuses[i]! as Player['status']
      })),
      previousNet: 50_000
    });
    const session = {
      ...createSession(),
      bills: paid.bills,
      game: paid.game,
      screen: isDismissed(paid.game)
        ? ('dismissal' as const)
        : ('bills' as const)
    };
    expect(makeScreen(session).lines.map(line => line.trimEnd())).toEqual(
      observation.dismissalScreen.slice(0, 22)
    );
  });
}

test('the cleared ROM idle screen has 24 rows, copyright and no game input', () => {
  const display = makeScreen({ ...createSession(), screen: 'cleared' });
  const native = observations.find(r => r.programCleared)!;
  expect(display.lines.map(line => line.trimEnd())).toEqual(
    native.afterAcknowledgeScreen
  );
  expect(display.paused).toBe(true);
  expect(display.prompt).toBe('');
});
