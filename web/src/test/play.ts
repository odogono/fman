import { createJournal, type Journal } from '../sim/journal';
import { latestEnhanced } from '../sim/ruleset';
import type { View } from '../sim/session';
import { submitInput } from './input';

/** What each screen answers on the way through a week, by default Enter. */
const inputs: Partial<Record<View['screen'], string>> = {
  menu: '99',
  sale: 'n',
  selection: '99',
  team: '99',
  transfer: '99'
};

/**
 * Plays a new game under the latest Enhanced rules, managing club 1 at
 * level 1, to the `week`th time it shows `screen`: picking no one new,
 * selling and buying nothing.
 */
export const playTo = <S extends View['screen']>(
  screen: S,
  week = 1
): Extract<View, { screen: S }> => {
  const journal: Journal = createJournal({
    kind: 'title',
    ruleset: latestEnhanced
  });
  journal.advance(137);
  journal.skipPause();
  for (const text of ['alex', '1', '1']) {
    submitInput(journal, text);
  }
  let seen = 0;
  for (let step = 0; step < 2000; step++) {
    const view = journal.session.view;
    if (view.screen === screen && ++seen === week) {
      return view as Extract<View, { screen: S }>;
    }
    if (view.screen === 'highlights') {
      for (
        let i = 0;
        i < 200 && journal.session.view.screen === 'highlights';
        i++
      ) {
        journal.advance(500);
      }
      continue;
    }
    submitInput(journal, inputs[view.screen] ?? '');
  }
  throw new Error(`Never reached ${screen} ${week}`);
};
