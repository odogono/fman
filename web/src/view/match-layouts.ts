import { teamStrength } from '../sim/league';
import type { Session } from '../sim/session';
import { paintSquad, type Paint } from './management-layouts';

export const paintMatch = (session: Session, put: Paint) => {
  const game = session.game!;
  const fixture = session.fixture!;
  const club = game.clubs[game.club - 1]!.name;
  const opponent = game.clubs[fixture.opponent - 1]!.name;
  const home = fixture.home ? club : opponent;
  const away = fixture.home ? opponent : club;
  let prompt = '';
  let label = 'Continue';
  let numeric = false;
  const score = (
    goals: readonly number[],
    homeName = home,
    awayName = away,
    row = 1
  ) => {
    put(row, 0, homeName);
    put(row, 12, String(goals[0]));
    put(row, 16, awayName);
    put(row, 28, String(goals[1]));
  };
  switch (session.screen) {
    case 'fixture':
      put(
        0,
        0,
        fixture.kind === 'cup'
          ? `F.A.Cup Match - Round ${game.cupRound}`
          : `League Match - Division ${game.division}`,
        { ink: fixture.kind === 'cup' ? 2 : 1 }
      );
      put(2, 6, `${home} v ${away}`);
      put(
        4,
        0,
        fixture.kind === 'cup'
          ? `Division ${fixture.home ? game.division : Math.floor((fixture.opponent - 1) / 16) + 1}`
          : `Lge.Pos. ${game.leaguePosition}`
      );
      put(
        4,
        20,
        String(
          fixture.kind === 'cup'
            ? fixture.home
              ? Math.floor((fixture.opponent - 1) / 16) + 1
              : game.division
            : 0
        )
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'team': {
      const strength = teamStrength(game);
      put(0, 10, club);
      put(0, 22, opponent);
      ['Energy', 'Morale', 'Defence', 'Midfield', 'Attack'].forEach(
        (name, index) => {
          put(index + 1, 0, name);
          put(index + 1, 13, String(strength[index]));
          put(index + 1, 25, String(fixture.opponentStrength[index]));
        }
      );
      put(
        6,
        0,
        `PLAYERS PICKED=${game.players.filter(p => p.status === 2).length}`,
        { inverse: true }
      );
      put(8, 0, 'Type c to change team', { ink: 1, inverse: true });
      put(9, 0, 'OR type 99 to continue', { bright: true, paper: 6 });
      label = 'c to change the picked team, or 99 to play';
      break;
    }
    case 'selection':
      paintSquad(game, put, true);
      if (session.selectionError) {
        put(19, 0, session.selectionError, { ink: 2, inverse: true });
      }
      label =
        game.players.filter(p => p.status === 2).length > 11
          ? 'Player number to remove'
          : 'Player number to add, or 99 to continue';
      numeric = true;
      break;
    case 'highlights': {
      const playback = session.playback!;
      put(0, 0, 'MATCH HIGHLIGHTS');
      score(playback.score);
      const current = playback.current;
      if (current && current.index >= current.attack.frames.length - 2) {
        put(3, 0, current.attack.goal ? 'GOAL!' : 'NO GOAL!');
      }
      break;
    }
    case 'result':
      put(0, 0, '**** FINAL SCORE ****', { ink: 2, inverse: true });
      score(session.highlights!.score);
      put(2, 0, `Gate receipts £${fixture.gate}`, { ink: 1, inverse: true });
      prompt = 'Hit ENTER to continue';
      break;
    case 'replay':
      put(0, 0, 'Replay-', { ink: 3 });
      prompt = 'Hit ENTER to continue';
      break;
    case 'cup-result':
      put(
        0,
        0,
        game.cupFinished
          ? "+++You're out of the Cup+++"
          : '****You are through to the next\n\nround!****',
        { ink: game.cupFinished ? 0 : 2, inverse: true }
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'other-matches':
      put(0, 0, 'OTHER MATCHES-', { inverse: true });
      put(1, 8, `Division ${game.division}`);
      session.completion!.results.forEach((result, index) =>
        score(
          result.score,
          game.clubs[result.home - 1]!.name,
          game.clubs[result.away - 1]!.name,
          index + 2
        )
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'table':
      put(0, 0, 'TEAM              F   A    PTS', {
        bright: true,
        ink: 7,
        paper: 1
      });
      session.completion!.order.forEach((index, row) => {
        const record = game.league[index]!;
        put(row + 1, 0, game.clubs[(game.division - 1) * 16 + index]!.name);
        put(row + 1, 18, String(record.for));
        put(row + 1, 22, String(record.against));
        put(row + 1, 28, String(record.points));
      });
      put(
        18,
        0,
        `Lge.Pos. ${game.leaguePosition}   League match no.=${game.leagueMatches}`
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'bills': {
      const bill = session.bills!;
      put(0, 0, '****WEEKLY BILLS****', { ink: 2, inverse: true });
      put(2, 0, `Wage Bill = £${bill.wages}`);
      put(3, 0, `Ground rent = £${bill.rent}`);
      put(4, 0, `Loan Interest = £${bill.interest}`);
      put(6, 0, `Weekly Balance = £${bill.balance}`, {
        ink: bill.balance < 0 ? 2 : 0
      });
      prompt = 'Hit ENTER to continue';
      break;
    }
  }
  if (session.screen !== 'highlights') {
    put(21, 24, '(h=copy)');
  }
  return { label, numeric, prompt };
};
