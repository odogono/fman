import { teamStrength } from '../sim/league';
import type { Session } from '../sim/session';
import { paintCupVictory } from './cup-victory';
import { paintLeagueTable } from './league-table';
import { paintSquad, type Paint } from './management-layouts';

export const paintMatch = (session: Session, put: Paint) => {
  const game = session.game!;
  const fixture = session.fixture!;
  const club = game.clubs[game.club - 1]!.name;
  const opponent = game.clubs[fixture.opponent - 1]!.name;
  const home = fixture.home ? club : opponent;
  const away = fixture.home ? opponent : club;
  const opponentPosition =
    game.league[fixture.opponent - (game.division - 1) * 16 - 1]?.position ?? 0;
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
          ? `F.A.Cup Match - Round ${game.cupRound === 7 ? 'Semi-Final' : game.cupRound === 8 ? 'Final' : game.cupRound}`
          : `League Match - Division ${game.division}`,
        { ink: fixture.kind === 'cup' ? 2 : 1 }
      );
      put(2, 6, `${home} v ${away}`);
      put(
        4,
        0,
        fixture.kind === 'cup'
          ? `Division ${fixture.home ? game.division : Math.floor((fixture.opponent - 1) / 16) + 1}`
          : `Lge.Pos. ${fixture.home ? game.leaguePosition : opponentPosition}`
      );
      put(
        4,
        20,
        String(
          fixture.kind === 'cup'
            ? fixture.home
              ? Math.floor((fixture.opponent - 1) / 16) + 1
              : game.division
            : fixture.home
              ? opponentPosition
              : game.leaguePosition
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
    case 'cup-celebration':
    case 'cup-result':
      if (session.cupWon) {
        paintCupVictory(
          put,
          session.cupCelebrationStep,
          Math.floor(session.frames / 16) % 2 === 1
        );
        if (session.screen === 'cup-result') {
          prompt = 'Hit ENTER to continue';
        }
        break;
      }
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
      paintLeagueTable(game, put, session.completion!.order);
      prompt = 'Hit ENTER to continue';
      break;
  }
  if (session.screen !== 'highlights') {
    put(21, 24, '(h=copy)', {
      bright: false,
      ink: 0,
      inverse: false,
      paper: 7
    });
  }
  return { label, numeric, prompt };
};
