import { expect, test } from 'bun:test';

import { createJournal } from '../sim/journal';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from '../test/input';
import { modernScreenFor } from './modern-screen';
import { pickTeamFor } from './pick-team';
import { saleOfferFor } from './sale-offer';

/** A new Enhanced game at the menu, then `inputs`. */
const after = (...inputs: string[]) => {
  const journal = createJournal({ kind: 'title', ruleset: latestEnhanced });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1', ...inputs]) {
    submitInput(journal, text);
  }
  return journal.session.view;
};

const squad = after('a');
type SaleView = Extract<View, { screen: 'sale' }>;
const owned = squad.game!.players.filter(p => p.status > 0);
const seller = owned.find(p => p.status !== 3)!;
const sale = ((): SaleView => {
  const view = after('a', String(seller.id));
  if (view.screen !== 'sale') {
    throw new Error(`On ${view.screen}`);
  }
  return view;
})();

test('the squad and the sale offer show Modern screens', () => {
  expect(squad.screen).toBe('squad');
  expect(modernScreenFor(squad)?.kind).toBe('pick-team');
  expect(sale.screen).toBe('sale');
  expect(modernScreenFor(sale)?.kind).toBe('sale-offer');
});

test('every owned player is a row to tap and sell, with Done to go back', () => {
  const screen = pickTeamFor(squad)!;
  expect(screen.prompt).toBe('squad');
  expect(screen.hint).toBe('Tap a player to sell');
  const rows = screen.groups.flatMap(group => group.players);
  expect(rows.map(row => row.number).toSorted((a, b) => a - b)).toEqual(
    owned.map(p => p.id).toSorted((a, b) => a - b)
  );
  // Injured players too: the original answers them with its message.
  expect(rows.every(row => row.answer === `squad.player.${row.number}`)).toBe(
    true
  );
  expect(rows[0]!.label).toBe(
    `Sell ${rows[0]!.name}, number ${rows[0]!.number}`
  );
  expect(screen.actions).toEqual([
    { enabled: true, id: 'squad.back', label: 'Done', tone: 'primary' }
  ]);
  expect(screen.strengths).toBeUndefined();
});

test("the offer names the buyer and the amount against the player's value", () => {
  const { game, offer } = sale;
  const player = game.players[offer.playerId - 1]!;
  const screen = saleOfferFor(sale)!;
  expect(screen.player.number).toBe(player.id);
  expect(screen.player.value).toBe(player.value);
  expect(screen.buyer.name).toBe(game.clubs[offer.buyerId - 1]!.name.trim());
  expect(screen.amount).toBe(offer.amount);
  const gap = Math.abs(offer.amount - player.value).toLocaleString('en-GB');
  expect(screen.comparison).toBe(
    offer.amount === player.value
      ? 'His value exactly'
      : `£${gap} ${offer.amount > player.value ? 'over' : 'under'} his value`
  );
  expect(screen.accept).toEqual({ enabled: true, id: 'sale.yes' });
  expect(screen.refuse).toEqual({ enabled: true, id: 'sale.no' });
  expect(screen.warning).toBe(
    'Turning it down may unsettle him: he could miss a match.'
  );
});

const value = sale.game.players[sale.offer.playerId - 1]!.value;
const at = (amount: number) =>
  saleOfferFor({ ...sale, offer: { ...sale.offer, amount } })!.comparison;

test('the comparison reads over, under or exact', () => {
  expect(at(value + 1200)).toBe('£1,200 over his value');
  expect(at(value - 400)).toBe('£400 under his value');
  expect(at(value)).toBe('His value exactly');
});
