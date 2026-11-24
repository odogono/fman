import { cell, continueRow, moneyRows } from './paint-parts';
import type { EndOfSeason, SeasonSummary } from './season-end';

/** Modern mode's end of the season: the league place and the cup run. */
export const paintEndOfSeason = (pane: HTMLElement, end: EndOfSeason) => {
  const facts = document.createElement('dl');
  facts.className = 'season-facts';
  for (const [term, value] of [
    ['League', end.league],
    ['F.A. Cup', end.cup]
  ] as const) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    facts.append(row);
  }
  pane.replaceChildren(facts, continueRow(end.done));
};

/**
 * Modern mode's season summary: what happened to the club, the bonus and
 * the rating, then the division's other moves.
 */
export const paintSeasonSummary = (
  pane: HTMLElement,
  summary: SeasonSummary
) => {
  const banner = cell(`season-banner ${summary.outcome}`, summary.headline);
  const facts = moneyRows([
    ['League success bonus', summary.bonus],
    ['Managerial rating', `${summary.rating} / 100`]
  ]);
  const parts: HTMLElement[] = [
    banner,
    facts,
    cell('season-bonus-for', `Bonus ${summary.bonusFor}`)
  ];
  for (const [label, names] of [
    [
      summary.outcome === 'promoted' ? 'Also promoted' : 'Promoted',
      summary.promoted
    ],
    [
      summary.outcome === 'relegated' ? 'Also relegated' : 'Relegated',
      summary.relegated
    ]
  ] as const) {
    if (names.length) {
      const line = document.createElement('p');
      line.className = 'season-moves';
      line.append(cell('season-moves-label', label), ` ${names.join(', ')}`);
      parts.push(line);
    }
  }
  parts.push(continueRow(summary.done));
  pane.replaceChildren(...parts);
};
