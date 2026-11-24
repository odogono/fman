import type { ModernFixture } from './modern-fixture';
import { cell, clubLabel, continueRow } from './paint-parts';

/**
 * Modern mode's next fixture: both clubs with where each stands, home on the left, where the managed club plays, and for a cup
 * round its draw, then Pick team.
 */
export const paintFixture = (pane: HTMLElement, fixture: ModernFixture) => {
  // The top bar names the competition, so the card doesn't repeat it.
  const card = document.createElement('div');
  card.className = 'fixture-card';
  const side = ({ club, standing }: ModernFixture['home']) => {
    const element = document.createElement('div');
    element.className = 'fixture-side';
    element.append(clubLabel(club), cell('fixture-standing', standing));
    return element;
  };
  card.append(side(fixture.home), cell('fixture-v', 'v'), side(fixture.away));
  pane.replaceChildren(
    card,
    cell('fixture-venue', fixture.draw ?? fixture.venue),
    continueRow(fixture.done)
  );
};
