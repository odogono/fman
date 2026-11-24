import { promptAnswers } from '../sim/offers';
import type { View } from '../sim/session';
import { startAmount, type AmountEntry } from './amount-entry';
import {
  cupReplayFor,
  cupResultFor,
  type CupReplay,
  type CupResult
} from './cup-screens';
import { fullTimeFor, type FullTime } from './full-time';
import {
  leagueTableFor,
  weekResultsFor,
  type LeagueTable,
  type WeekResults
} from './league-screens';
import { amountPromptFor, type ModernAmount } from './modern-amount';
import { billsFor, type ModernBills } from './modern-bills';
import { modernFixtureFor, type ModernFixture } from './modern-fixture';
import {
  highlightsFor,
  type ClipProgress,
  type ModernHighlights
} from './modern-highlights';
import { messageFor, type ModernMessage } from './modern-message';
import { statusFor, statusOf, type ModernStatus } from './modern-status';
import { namesFor, type ModernNames } from './name-screens';
import { pickTeamFor, type PickTeam } from './pick-team';
import { saleOfferFor, type SaleOffer } from './sale-offer';
import {
  endOfSeasonFor,
  seasonSummaryFor,
  type EndOfSeason,
  type SeasonSummary
} from './season-end';
import { setupFor, type ModernSetup } from './setup-screens';

/**
 * The Modern screen on show: a screen Modern mode draws in place of an
 * original screen, tagged by `kind`.
 */
export type ModernScreen =
  /** The Home screen, standing in for the menu, with the status beside it. */
  | Readonly<{ kind: 'home'; status: ModernStatus }>
  /** Standing in for the team and selection prompts and their bar. */
  | Readonly<{ kind: 'pick-team'; pickTeam: PickTeam }>
  /** Standing in for the original's highlights and the ticker's Skip. */
  | Readonly<{ highlights: ModernHighlights; kind: 'highlights' }>
  /** The status prompt, with its Done button. */
  | Readonly<{ kind: 'status'; status: ModernStatus }>
  /** A loan, repayment or transfer bid. */
  | Readonly<{ amount: ModernAmount; kind: 'amount' }>
  /** The final score, as the Full-time screen. */
  | Readonly<{ fullTime: FullTime; kind: 'full-time' }>
  /** The week's results, in place of the other matches. */
  | Readonly<{ kind: 'week-results'; weekResults: WeekResults }>
  /** The league table, each week and at the season end. */
  | Readonly<{ kind: 'league-table'; table: LeagueTable }>
  /** The weekly bills, and the dismissal over them. */
  | Readonly<{ bills: ModernBills; kind: 'bills' }>
  /** A cup round decided: through, out or won, after any celebration. */
  | Readonly<{ cupResult: CupResult; kind: 'cup-result' }>
  /** A drawn cup round, to be replayed at the other ground. */
  | Readonly<{ cupReplay: CupReplay; kind: 'cup-replay' }>
  /** The next fixture, before the team is picked. */
  | Readonly<{ fixture: ModernFixture; kind: 'fixture' }>
  /** The season's end, before its final table. */
  | Readonly<{ endOfSeason: EndOfSeason; kind: 'end-of-season' }>
  /** The season settled: promotion, the bonus and the rating. */
  | Readonly<{ kind: 'season-summary'; summary: SeasonSummary }>
  /** A club's offer for a player put up for sale. */
  | Readonly<{ kind: 'sale-offer'; offer: SaleOffer }>
  /** Setting up a game, changing its level, or playing on after a save. */
  | Readonly<{ kind: 'setup'; setup: ModernSetup }>
  /** Renaming clubs and players. */
  | Readonly<{ kind: 'names'; names: ModernNames }>
  /** A balance or a plain text message. */
  | Readonly<{ kind: 'message'; message: ModernMessage }>;

export type ModernScreenKind = ModernScreen['kind'];

/**
 * What the app knows beyond the view. `amount`: the amount being entered,
 * which starts afresh from the offered amount when absent. `clips`: under
 * sprite highlights, how far the clips have got and the score after them.
 */
export type ModernScreenContext = Readonly<{
  amount?: AmountEntry | undefined;
  clips?:
    Readonly<{ progress: ClipProgress; score: readonly number[] }> | undefined;
}>;

/** The amount the prompt starts at, known even while a pause holds input. */
const freshAmount = (view: View) => {
  const offered = promptAnswers(view).find(a => a.kind === 'amount');
  return offered?.kind === 'amount' ? startAmount(offered) : undefined;
};

/**
 * The Modern screen for a view, or `undefined` on screens Modern mode has no
 * design for, which show the original's with the context bar. A print
 * fault shows the original's too, where printing stopped.
 */
export const modernScreenFor = (
  view: View,
  context: ModernScreenContext = {}
): ModernScreen | undefined => {
  if (view.printFault) {
    return undefined;
  }
  switch (view.screen) {
    case 'menu':
      return { kind: 'home', status: statusOf(view.game) };
    case 'team':
    case 'selection':
    case 'squad': {
      const pickTeam = pickTeamFor(view);
      return pickTeam && { kind: 'pick-team', pickTeam };
    }
    case 'highlights': {
      const highlights = highlightsFor(view, context.clips);
      return highlights && { highlights, kind: 'highlights' };
    }
    case 'result': {
      const fullTime = fullTimeFor(view);
      return fullTime && { fullTime, kind: 'full-time' };
    }
    case 'other-matches': {
      const weekResults = weekResultsFor(view);
      return weekResults && { kind: 'week-results', weekResults };
    }
    case 'table':
    case 'season-table': {
      const table = leagueTableFor(view);
      return table && { kind: 'league-table', table };
    }
    case 'bills':
    case 'dismissal': {
      const bills = billsFor(view);
      return bills && { bills, kind: 'bills' };
    }
    case 'cup-result':
    case 'cup-celebration': {
      const cupResult = cupResultFor(view);
      return cupResult && { cupResult, kind: 'cup-result' };
    }
    case 'replay': {
      const cupReplay = cupReplayFor(view);
      return cupReplay && { cupReplay, kind: 'cup-replay' };
    }
    case 'fixture': {
      const fixture = modernFixtureFor(view);
      return fixture && { fixture, kind: 'fixture' };
    }
    case 'end-season': {
      const endOfSeason = endOfSeasonFor(view);
      return endOfSeason && { endOfSeason, kind: 'end-of-season' };
    }
    case 'season-summary': {
      const summary = seasonSummaryFor(view);
      return summary && { kind: 'season-summary', summary };
    }
    case 'sale': {
      const offer = saleOfferFor(view);
      return offer && { kind: 'sale-offer', offer };
    }
    case 'manager':
    case 'clubs':
    case 'level':
    case 'colours':
    case 'save-question': {
      const setup = setupFor(view);
      return setup && { kind: 'setup', setup };
    }
    case 'names': {
      const names = namesFor(view);
      return names && { kind: 'names', names };
    }
    case 'status': {
      const status = statusFor(view);
      return status && { kind: 'status', status };
    }
    case 'borrow':
    case 'repay':
    case 'transfer': {
      const entry = context.amount ?? freshAmount(view);
      const amount = amountPromptFor(view, entry);
      return amount && { amount, kind: 'amount' };
    }
    case 'message':
    case 'transfer-result': {
      const message = messageFor(view);
      return message && { kind: 'message', message };
    }
    default:
      return undefined;
  }
};
