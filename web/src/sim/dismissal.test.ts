import { expect, test } from 'bun:test';

import observations from './fixtures/dismissal.json';
import {
  createNewGame,
  isDismissed,
  payWeeklyBills,
  type Game,
  type Player
} from './management';

for (const observation of observations) {
  test(`original bills and NEW: division ${observation.division}, ${observation.scenario}`, () => {
    const fresh = createNewGame({
      club: 1,
      colour: 0,
      level: 1,
      manager: 'alex',
      seed: 0
    });
    const game: Game = {
      ...fresh,
      cash: observation.cash,
      debt: observation.debt,
      division: observation.division,
      players: fresh.players.map((p, i): Player => ({
        ...p,
        skill: observation.skills[i]!,
        status: observation.initialStatuses[i]! as Player['status']
      })),
      previousNet: 50_000,
      seed: 219
    };
    const paid = payWeeklyBills(game);
    expect(paid.game.cash).toBe(observation.completed.m);
    expect(paid.game.debt).toBe(observation.completed.l);
    expect(paid.game.previousNet).toBe(observation.completed.xp);
    expect(paid.bills.wages).toBe(observation.completed.w);
    expect(paid.bills.balance).toBe(observation.completed.i);
    expect(paid.bills.loanIncreased).toBe(
      observation.dismissalScreen.some(line => line.includes('LOAN INCREASED'))
    );
    expect(paid.game.seed).toBe(observation.seed);
    expect(isDismissed(paid.game)).toBe(observation.programCleared);
    expect(observation.programCleared).toBe(observation.variablesCleared);
    if (observation.programCleared) {
      expect(observation.seedAfterAcknowledge).toBe(0);
      expect(observation.framesAfterAcknowledge).toBeLessThan(
        observation.framesBeforeAcknowledge
      );
      expect(
        observation.afterAcknowledgeScreen
          .slice(0, 23)
          .every(line => line === '')
      ).toBe(true);
      expect(observation.afterAcknowledgeScreen[23]).toBe(
        '© 1982 Sinclair Research Ltd'
      );
    }
  });
}
