import type { View } from '../sim/session';
import { answersFor } from './answers';

type Done = Readonly<{ enabled: boolean; id: string }>;

/**
 * Modern mode's messages: the balance after a loan or repayment (#134), and
 * every plain text message, such as a refused bid or a transfer's result
 * (#135), worded as the original has it.
 */
export type ModernMessage =
  | Readonly<{ cash: number; debt: number; done: Done; kind: 'balance' }>
  | Readonly<{ done: Done; kind: 'text'; text: string }>;

const doneFor = (view: View, id: string): Done => ({
  enabled: answersFor(view).some(answer => answer.id === id),
  id
});

export const messageFor = (view: View): ModernMessage | undefined => {
  if (view.screen === 'transfer-result') {
    return {
      done: doneFor(view, 'transfer-result.continue'),
      kind: 'text',
      text: view.text.replaceAll(/\s+/g, ' ').trim()
    };
  }
  if (view.screen !== 'message') {
    return undefined;
  }
  const done = doneFor(view, 'message.continue');
  switch (view.message.kind) {
    case 'balance':
      return {
        cash: view.message.cash,
        debt: view.message.debt,
        done,
        kind: 'balance'
      };
    case 'text':
      return {
        done,
        kind: 'text',
        text: view.message.text.replaceAll(/\s+/g, ' ').trim()
      };
    case 'skill-level':
      return undefined;
  }
};
