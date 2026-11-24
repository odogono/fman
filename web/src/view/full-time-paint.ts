import type { FullTime } from './full-time';
import type { ClubName } from './home';
import { actionButton, appendScoreboard, cell, moneyRows } from './paint-parts';

/** One club's scorers on the Full-time screen, as `Smith 12′, 77′`. */
const scorerList = (
  scorers: FullTime['goals'] & {},
  side: 0 | 1,
  club: ClubName
) => {
  const list = document.createElement('ul');
  list.className = 'full-time-scorers';
  list.setAttribute('aria-label', `${club.name} scorers`);
  list.append(
    ...scorers[side].map(scorer => {
      const item = document.createElement('li');
      if (scorer.name) {
        item.append(cell('full-time-scorer', scorer.name), ' ');
      }
      item.append(cell('full-time-minutes', scorer.minutes.join(', ')));
      return item;
    })
  );
  return list;
};

/**
 * Modern mode's Full-time screen: the scoreboard at full time, the goals
 * under each club, the managed club's injuries, the gate receipts, then
 * Continue.
 */
export const paintFullTime = (pane: HTMLElement, fullTime: FullTime) => {
  const title = cell('full-time-title', fullTime.title);
  const board = document.createElement('div');
  board.className = 'full-time-board';
  board.setAttribute(
    'aria-label',
    `Full time: ${fullTime.home.name} ${fullTime.score[0]}, ${fullTime.away.name} ${fullTime.score[1]}`
  );
  appendScoreboard(board, fullTime);
  const parts: HTMLElement[] = [title, board];
  if (fullTime.goals?.some(side => side.length)) {
    const goals = document.createElement('div');
    goals.className = 'full-time-goals';
    goals.append(
      scorerList(fullTime.goals, 0, fullTime.home),
      scorerList(fullTime.goals, 1, fullTime.away)
    );
    parts.push(goals);
  }
  if (fullTime.replay) {
    parts.push(cell('full-time-replay', 'Drawn – a replay to come'));
  }
  if (fullTime.injuries?.length) {
    const injuries = document.createElement('ul');
    injuries.className = 'full-time-injuries';
    injuries.setAttribute('aria-label', 'Injured');
    injuries.append(
      ...fullTime.injuries.map(({ matches, name }) => {
        const item = document.createElement('li');
        item.append(
          cell('full-time-injury', 'Injured'),
          ` ${name}, out for ${matches} ${matches === 1 ? 'match' : 'matches'}`
        );
        return item;
      })
    );
    parts.push(injuries);
  }
  const actions = document.createElement('div');
  actions.className = 'pick-actions';
  actions.append(
    actionButton('Continue', fullTime.done.id, 'choice', fullTime.done.enabled)
  );
  parts.push(moneyRows([['Gate receipts', fullTime.gate]]), actions);
  pane.replaceChildren(...parts);
};
