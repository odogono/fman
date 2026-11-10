import type { Club } from '../sim/catalogue';
import { teamStrength, type MatchFixture } from '../sim/league';
import type { Game } from '../sim/management';
import { clubInk, clubText } from '../sim/names';
import type { View } from '../sim/session';
import { paintCupVictory } from './cup-victory';
import { paintLeagueTable } from './league-table';
import { paintSquad, type Paint } from './management-layouts';
import { createPrintScreen } from './print-screen';

export type MatchView = Extract<
  View,
  {
    screen:
      | 'fixture'
      | 'team'
      | 'selection'
      | 'highlights'
      | 'result'
      | 'replay'
      | 'cup-celebration'
      | 'cup-result'
      | 'other-matches'
      | 'table';
  }
>;

const sides = (game: Game, fixture: MatchFixture) => {
  const club = game.clubs[game.club - 1]!;
  const opponent = game.clubs[fixture.opponent - 1]!;
  return {
    away: fixture.home ? opponent : club,
    club,
    home: fixture.home ? club : opponent,
    opponent
  };
};

export const paintMatch = (view: MatchView, put: Paint) => {
  const game = view.game;
  let prompt = '';
  let label = 'Continue';
  let numeric = false;
  const score = (
    goals: readonly number[],
    homeName: Club,
    awayName: Club,
    row = 1
  ) => {
    const homeInk = clubInk(homeName),
      awayInk = clubInk(awayName, homeInk);
    put(row, 0, clubText(homeName), { ink: homeInk });
    put(row, 12, String(goals[0]), { ink: homeInk });
    put(row, 16, clubText(awayName), { ink: awayInk });
    put(row, 28, String(goals[1]), { ink: awayInk });
  };
  switch (view.screen) {
    case 'fixture': {
      const { fixture } = view;
      const { away, home } = sides(game, fixture);
      const opponentPosition =
        game.league[fixture.opponent - (game.division - 1) * 16 - 1]
          ?.position ?? 0;
      const print = createPrintScreen();
      print.text(
        fixture.kind === 'cup'
          ? `F.A.Cup Match - Round ${game.cupRound === 7 ? 'Semi-Final' : game.cupRound === 8 ? 'Final' : game.cupRound}`
          : `League Match - Division ${game.division}`,
        { ink: fixture.kind === 'cup' ? 2 : 1 }
      );
      print.newline();
      print.newline();
      print.tab(6);
      const homeInk = clubInk(home),
        awayInk = clubInk(away, homeInk);
      print.text(clubText(home), { ink: homeInk });
      print.text(' v ', { ink: homeInk });
      print.text(clubText(away), { ink: awayInk });
      for (let i = 0; i < 3; i++) {
        print.comma({ ink: awayInk });
      }
      const homePosition =
        fixture.kind === 'cup'
          ? fixture.home
            ? game.division
            : Math.floor((fixture.opponent - 1) / 16) + 1
          : fixture.home
            ? game.leaguePosition
            : opponentPosition;
      const awayPosition =
        fixture.kind === 'cup'
          ? fixture.home
            ? Math.floor((fixture.opponent - 1) / 16) + 1
            : game.division
          : fixture.home
            ? opponentPosition
            : game.leaguePosition;
      print.text(
        `${fixture.kind === 'cup' ? 'Division ' : 'Lge.Pos. '}${homePosition}`,
        { ink: awayInk }
      );
      print.tab(20, { ink: awayInk });
      print.text(String(awayPosition), { ink: awayInk });
      print.paint(put);
      prompt = 'Hit ENTER to continue';
      break;
    }
    case 'team': {
      const { fixture } = view;
      const { club, opponent } = sides(game, fixture);
      const print = createPrintScreen();
      print.tab(10);
      print.text(clubText(club), { ink: clubInk(club) });
      print.tab(22, { ink: clubInk(club) });
      print.text(clubText(opponent), { ink: clubInk(opponent, clubInk(club)) });
      print.newline();
      const strength = teamStrength(game);
      ['Energy', 'Morale', 'Defence', 'Midfield', 'Attack'].forEach(
        (name, index) => {
          print.text(name);
          print.tab(13);
          print.text(String(strength[index]));
          print.tab(25);
          print.text(String(fixture.opponentStrength[index]));
          print.newline();
        }
      );
      print.text('PLAYERS PICKED', { inverse: true });
      print.text(`=${game.players.filter(p => p.status === 2).length}`);
      print.newline();
      print.newline();
      print.text('Type c to change team', { ink: 1, inverse: true });
      print.newline();
      print.text('OR type 99 to continue', { bright: true, paper: 6 });
      print.paint(put);
      label = 'c to change the picked team, or 99 to play';
      break;
    }
    case 'selection':
      paintSquad(game, put, true);
      if (view.error) {
        put(19, 0, view.error, { ink: 2, inverse: true });
      }
      label =
        game.players.filter(p => p.status === 2).length > 11
          ? 'Player number to remove'
          : 'Player number to add, or 99 to continue';
      numeric = true;
      break;
    case 'highlights': {
      const { playback } = view;
      const { away, home } = sides(game, view.fixture);
      put(0, 0, 'MATCH HIGHLIGHTS');
      score(playback.score, home, away);
      const current = playback.current;
      if (current && current.index >= current.attack.frames.length - 2) {
        put(3, 0, current.attack.goal ? 'GOAL!' : 'NO GOAL!');
      }
      break;
    }
    case 'result': {
      const { away, home } = sides(game, view.fixture);
      put(0, 0, '**** FINAL SCORE ****', { ink: 2, inverse: true });
      score(view.score, home, away);
      put(2, 0, `Gate receipts £${view.fixture.gate}`, {
        ink: 1,
        inverse: true
      });
      prompt = 'Hit ENTER to continue';
      break;
    }
    case 'replay':
      put(0, 0, 'Replay-', { ink: 3 });
      prompt = 'Hit ENTER to continue';
      break;
    case 'cup-celebration':
    case 'cup-result':
      if (view.celebration !== undefined) {
        paintCupVictory(
          put,
          view.celebration,
          Math.floor((view.ulaFrames ?? view.frames) / 16) % 2 === 1,
          view.celebrationProgress
        );
        if (view.screen === 'cup-result') {
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
      view.completion.results.forEach((result, index) =>
        score(
          result.score,
          game.clubs[result.home - 1]!,
          game.clubs[result.away - 1]!,
          index + 2
        )
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'table':
      paintLeagueTable(game, put, view.completion.order);
      prompt = 'Hit ENTER to continue';
      break;
  }
  if (view.screen !== 'highlights') {
    put(21, 24, '(h=copy)', {
      bright: false,
      ink: 0,
      inverse: false,
      paper: 7
    });
  }
  return { label, numeric, prompt };
};
