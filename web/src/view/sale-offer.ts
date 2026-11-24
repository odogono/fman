import { offeredAnswers } from '../sim/offers';
import type { View } from '../sim/session';
import { clubName, type ClubName } from './home';
import { bidPlayerOf, type BidPlayer } from './modern-amount';

type Action = Readonly<{ enabled: boolean; id: string }>;

/**
 * Modern mode's sale offer: the player, the buyer and its offer against his
 * value, and what turning it down may cost.
 */
export type SaleOffer = Readonly<{
  accept: Action;
  amount: number;
  buyer: ClubName;
  /** `£400 under his value`, `£1,200 over his value`, `His value exactly`. */
  comparison: string;
  player: BidPlayer;
  refuse: Action;
  /** The original's hidden rule: a refusal injures him 2 times in 3. */
  warning: string;
}>;

const pounds = (value: number) => `£${value.toLocaleString('en-GB')}`;

export const saleOfferFor = (view: View): SaleOffer | undefined => {
  if (view.screen !== 'sale') {
    return undefined;
  }
  const { game, offer } = view;
  const player = game.players[offer.playerId - 1]!;
  const offered = new Set(offeredAnswers(view).map(answer => answer.id));
  const action = (id: string): Action => ({ enabled: offered.has(id), id });
  const gap = offer.amount - player.value;
  return {
    accept: action('sale.yes'),
    amount: offer.amount,
    buyer: clubName(game.clubs[offer.buyerId - 1]!),
    comparison:
      gap === 0
        ? 'His value exactly'
        : `${pounds(Math.abs(gap))} ${gap > 0 ? 'over' : 'under'} his value`,
    player: bidPlayerOf(player),
    refuse: action('sale.no'),
    warning: 'Turning it down may unsettle him: he could miss a match.'
  };
};
