import type { ModernMessage } from './modern-message';
import { actionButton, moneyRows } from './paint-parts';

/**
 * Modern mode's message screen: the balance after a loan or repayment, or a
 * plain text message in a black bar, then Continue.
 */
export const paintMessage = (pane: HTMLElement, message: ModernMessage) => {
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton('Continue', message.done.id, 'choice', message.done.enabled)
  );
  if (message.kind === 'balance') {
    pane.replaceChildren(
      moneyRows([
        ['Cash', message.cash],
        ['Loan', message.debt]
      ]),
      actions
    );
    return;
  }
  const text = document.createElement('p');
  text.className = 'message-text';
  text.textContent = message.text;
  pane.replaceChildren(text, actions);
};
