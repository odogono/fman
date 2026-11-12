import type { Club } from '../sim/catalogue';
import { fixtureSides, teamStrength } from '../sim/league';
import { flashPhase, type View } from '../sim/session';
import { paintCupVictory } from './cup-victory';
import type { Paint } from './grid';
import { paintLeagueTable } from './league-table';
import { paintSquad } from './management-layouts';
import { createPrintScreen } from './print-screen';
import { tickerLines } from './ticker-layout';

/** The ticker's lines below the score: rows 3 to 21. */
const tickerRows = 19;

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

export const paintMatch = (view: MatchView, put: Paint) => {
  const game = view.game;
  let prompt = '';
  let label = 'Continue';
  let numeric = false;
  const output = createPrintScreen(
    view.screen !== 'fixture' && view.screen !== 'team'
  );
  const write: Paint = (row, column, text, style = {}) => {
    output.at(row, column);
    output.reset(style);
    output.text(text);
  };
  const score = (goals: readonly number[], homeName: Club, awayName: Club) => {
    output.reset();
    output.club(homeName);
    output.tab(12);
    output.text(String(goals[0]));
    output.comma();
    output.club(awayName);
    output.tab(28);
    output.text(String(goals[1]));
    output.newline();
  };
  switch (view.screen) {
    case 'fixture': {
      const { fixture } = view;
      const { away, home } = fixtureSides(game, fixture);
      const opponentPosition =
        game.league[fixture.opponent - (game.division - 1) * 16 - 1]
          ?.position ?? 0;
      const print = createPrintScreen();
      print.text(
        fixture.kind === 'cup'
          ? `F.A.Cup Match - Round ${view.roundName}`
          : `League Match - Division ${game.division}`,
        { ink: fixture.kind === 'cup' ? 2 : 1 }
      );
      print.newline();
      print.newline();
      print.tab(6);
      print.club(home);
      print.text(' v ');
      print.club(away);
      for (let i = 0; i < 3; i++) {
        print.comma();
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
        `${fixture.kind === 'cup' ? 'Division ' : 'Lge.Pos. '}${homePosition}`
      );
      print.tab(20);
      print.text(String(awayPosition));
      print.paint(write);
      prompt = 'Hit ENTER to continue';
      break;
    }
    case 'team': {
      const { fixture } = view;
      const { club, opponent } = fixtureSides(game, fixture);
      const print = createPrintScreen();
      print.tab(10);
      print.club(club);
      print.tab(22);
      print.club(opponent);
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
      print.text(`=${view.pickedCount}`, {
        inverse: false
      });
      print.newline();
      print.newline();
      print.text('Type c to change team', { ink: 1, inverse: true });
      print.newline();
      print.text('OR type 99 to continue', { bright: true, paper: 6 });
      print.paint(write);
      label = 'c to change the picked team, or 99 to play';
      break;
    }
    case 'selection':
      paintSquad(game, write, view.pickedCount, true);
      if (view.error) {
        write(19, 0, view.error, { ink: 2, inverse: true });
      }
      label =
        view.pickedCount > 11
          ? 'Player number to remove'
          : 'Player number to add, or 99 to continue';
      numeric = true;
      break;
    case 'highlights': {
      const { away, home } = fixtureSides(game, view.fixture);
      write(0, 0, 'MATCH HIGHLIGHTS');
      output.at(1, 0);
      if ('ticker' in view) {
        score(view.ticker.score, home, away);
        // Newest on top; the oldest lines leave the bottom for good.
        tickerLines(game, view.fixture, view.ticker.shown)
          .slice(0, tickerRows)
          .forEach((line, i) => {
            write(3 + i, 0, `${line.minute} `);
            output.text(
              line.word,
              line.kind === 'goal' ? { ink: 2, inverse: true } : {}
            );
            output.reset();
            output.text(
              ` ${line.name}${line.score === undefined ? '' : ` ${line.score}`}`
            );
          });
        break;
      }
      const { playback } = view;
      score(playback.score, home, away);
      const current = playback.current;
      if (current && current.index >= current.attack.frames.length - 2) {
        write(3, 0, current.attack.goal ? 'GOAL!' : 'NO GOAL!');
      }
      break;
    }
    case 'result': {
      const { away, home } = fixtureSides(game, view.fixture);
      write(0, 0, '**** FINAL SCORE ****', { ink: 2, inverse: true });
      output.at(1, 0);
      score(view.score, home, away);
      output.text(`Gate receipts £${view.fixture.gate}`, {
        ink: 1,
        inverse: true
      });
      prompt = 'Hit ENTER to continue';
      break;
    }
    case 'replay':
      write(0, 0, 'Replay-', { ink: 3 });
      prompt = 'Hit ENTER to continue';
      break;
    case 'cup-celebration':
    case 'cup-result':
      if (view.celebration !== undefined) {
        paintCupVictory(
          write,
          view.celebration,
          flashPhase(view),
          view.celebrationProgress
        );
        if (view.screen === 'cup-result') {
          prompt = 'Hit ENTER to continue';
        }
        break;
      }
      write(
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
      output.text('OTHER MATCHES-', { inverse: true });
      output.newline();
      output.tab(8);
      output.text(`Division ${game.division}`);
      output.newline();
      view.completion.results.forEach(result =>
        score(
          result.score,
          game.clubs[result.home - 1]!,
          game.clubs[result.away - 1]!
        )
      );
      prompt = 'Hit ENTER to continue';
      break;
    case 'table':
      paintLeagueTable(game, write, view.completion.order);
      prompt = 'Hit ENTER to continue';
      break;
  }
  if (view.screen !== 'highlights' && !view.printFault) {
    write(21, 24, '(h=copy)', {
      bright: false,
      ink: 0,
      inverse: false,
      paper: 7
    });
  }
  output.paint(put);
  return { label, numeric, prompt };
};
