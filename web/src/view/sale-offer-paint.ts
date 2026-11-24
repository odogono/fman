import {
  actionButton,
  bidPlayer,
  cell,
  clubLabel,
  pounds
} from './paint-parts';
import type { SaleOffer } from './sale-offer';

/**
 * Modern mode's sale offer: the player, the buyer's offer against his value,
 * then Accept, and Refuse with what turning it down may cost.
 */
export const paintSaleOffer = (pane: HTMLElement, offer: SaleOffer) => {
  const line = document.createElement('p');
  line.className = 'sale-line';
  line.append(clubLabel(offer.buyer), ` offer ${pounds(offer.amount)}`);
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  const accept = actionButton(
    'Accept',
    offer.accept.id,
    'choice',
    offer.accept.enabled
  );
  const refuse = actionButton(
    'Refuse',
    offer.refuse.id,
    'choice',
    offer.refuse.enabled
  );
  refuse.className = 'red';
  actions.append(accept, refuse);
  pane.replaceChildren(
    bidPlayer(offer.player),
    line,
    cell('sale-comparison', offer.comparison),
    actions,
    cell('sale-warning', offer.warning)
  );
};
