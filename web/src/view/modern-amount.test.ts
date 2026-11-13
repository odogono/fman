import { expect, test } from 'bun:test';

import { createSession } from '../sim/session';
import { viewOn } from '../sim/view-on';
import { submitInput } from '../test/input';
import { startAmount } from './amount-entry';
import { answersFor } from './answers';
import { amountPromptFor } from './modern-amount';
import { messageFor } from './modern-message';

/** The transfer market offered after the first match, as in `transfers.test.ts`. */
const atMarket = () => {
  const session = createSession(2 ** 24 - 5);
  session.advance(5);
  session.skipPause();
  for (const input of ['alex', '1', '1', '0', '99', '', '99']) {
    submitInput(session, input);
  }
  session.advance(1_000_000);
  for (let i = 0; i < 4; i++) {
    submitInput(session, '');
  }
  return session;
};

/** The bid as Modern mode shows it, with the amount entry freshly started. */
const bidFor = (session: ReturnType<typeof createSession>) => {
  const offered = answersFor(session.view).find(a => a.kind === 'amount');
  if (offered?.kind !== 'amount') {
    throw new Error('No bid offered');
  }
  return amountPromptFor(session.view, startAmount(offered))!;
};

test('a transfer bid shows the player, starts at his value and passes with 99', () => {
  const session = atMarket();
  const view = viewOn(session, 'transfer');
  const player = view.game.players[view.playerId - 1]!;
  const bid = bidFor(session);
  expect(bid).toMatchObject({
    cancel: { enabled: true, id: 'transfer.decline', label: 'Pass' },
    cash: view.game.cash,
    debt: view.game.debt,
    entry: { max: view.game.cash, value: player.value },
    kind: 'transfer',
    player: {
      energy: player.energy,
      name: player.name.trim(),
      number: player.id,
      skill: player.skill,
      value: player.value
    },
    submit: { enabled: true, id: 'transfer.bid', label: 'Place bid' }
  });
  expect(['D', 'M', 'A', 'G']).toContain(bid.player!.tag);
  // A bid of nothing can only be refused.
  expect(
    amountPromptFor(session.view, { ...bid.entry, value: 0 })?.submit.enabled
  ).toBe(false);
});

test('a refused bid shows its message, then asks again at the raised value', () => {
  const session = atMarket();
  const player = () =>
    session.view.game!.players[viewOn(session, 'transfer').playerId - 1]!;
  const before = player().value;
  submitInput(session, '0');
  expect(messageFor(session.view)).toEqual({
    done: { enabled: true, id: 'message.continue' },
    kind: 'text',
    text: 'YOUR BID IS REFUSED'
  });
  submitInput(session, '');
  expect(player().value).toBeGreaterThan(before);
  expect(bidFor(session).entry.value).toBe(player().value);
});

test('a player who joins says so, and the menu follows', () => {
  const session = atMarket();
  const { playerId } = viewOn(session, 'transfer');
  submitInput(session, String(session.view.game!.cash));
  expect(session.view.screen).toBe('transfer-result');
  const name = session.view.game!.players[playerId - 1]!.name.trim();
  expect(messageFor(session.view)).toEqual({
    done: { enabled: true, id: 'transfer-result.continue' },
    kind: 'text',
    text: `${name} has joined your team`
  });
  submitInput(session, '');
  expect(session.view.screen).toBe('menu');
});

test('a full squad hears why no player can be bought', () => {
  const message = messageFor({
    frames: 0,
    fullSquad: true,
    game: undefined as never,
    paused: false,
    screen: 'transfer-result',
    text: 'You cannot buy a player because you have 16 in your squad - thatis the maximum allowed under    F.A. rules.'
  });
  expect(message).toMatchObject({
    kind: 'text',
    text: 'You cannot buy a player because you have 16 in your squad - thatis the maximum allowed under F.A. rules.'
  });
});
