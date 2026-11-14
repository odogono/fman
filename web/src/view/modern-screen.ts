import type { View } from '../sim/session';
import { startAmount, type AmountEntry } from './amount-entry';
import { answersFor } from './answers';
import { amountPromptFor, type ModernAmount } from './modern-amount';
import {
  highlightsFor,
  type ClipProgress,
  type ModernHighlights
} from './modern-highlights';
import { messageFor, type ModernMessage } from './modern-message';
import { statusFor, statusOf, type ModernStatus } from './modern-status';
import { pickTeamFor, type PickTeam } from './pick-team';

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

const freshAmount = (view: View) => {
  const offered = answersFor(view).find(a => a.kind === 'amount');
  return offered?.kind === 'amount' ? startAmount(offered) : undefined;
};

/**
 * The Modern screen for a view, or `undefined` on screens Modern mode has no
 * design for, which show the original's with the context bar.
 */
export const modernScreenFor = (
  view: View,
  context: ModernScreenContext = {}
): ModernScreen | undefined => {
  switch (view.screen) {
    case 'menu':
      return { kind: 'home', status: statusOf(view.game) };
    case 'team':
    case 'selection': {
      const pickTeam = pickTeamFor(view);
      return pickTeam && { kind: 'pick-team', pickTeam };
    }
    case 'highlights': {
      const highlights = highlightsFor(view, context.clips);
      return highlights && { highlights, kind: 'highlights' };
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
