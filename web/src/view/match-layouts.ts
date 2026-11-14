import type { Club } from '../sim/catalogue';
import { fixtureSides, teamStrength } from '../sim/league';
import { flashPhase, type View } from '../sim/session';
import { paintCupVictory } from './cup-victory';
import type { Paint } from './grid';
import type { LayoutResult, Layouts } from './layout';
import { paintLeagueTable } from './league-table';
import { paintSquad } from './management-layouts';
import { createPrintScreen } from './print-screen';
import { tickerLines } from './ticker-layout';

/** The ticker's lines below the score: rows 3 to 21. */
const tickerRows = 19;

/** The match screens print through one cursor, as the original does. */
type MatchPrint = Readonly<{
  output: ReturnType<typeof createPrintScreen>;
  /** Score line: home club and goals, then away club and goals. */
  score: (goals: readonly number[], home: Club, away: Club) => void;
  write: Paint;
}>;

/**
 * Prints a match screen through its own cursor, then paints it. Names
 * print bright unless `bright` is false, as on the fixture and the team
 * sheet. Every screen but the highlights offers the copy hint.
 */
const printMatch =
  <S extends MatchScreen>(
    draw: (
      view: Extract<View, { screen: S }>,
      print: MatchPrint
    ) => LayoutResult | void,
    bright = true
  ) =>
  (view: Extract<View, { screen: S }>, put: Paint): LayoutResult => {
    const output = createPrintScreen(bright);
    const write: Paint = (row, column, text, style = {}) => {
      output.at(row, column);
      output.reset(style);
      output.text(text);
    };
    const score = (goals: readonly number[], home: Club, away: Club) => {
      output.reset();
      output.club(home);
      output.tab(12);
      output.text(String(goals[0]));
      output.comma();
      output.club(away);
      output.tab(28);
      output.text(String(goals[1]));
      output.newline();
    };
    const result = draw(view, { output, score, write });
    output.paint(put);
    return { copy: true, label: 'Continue', ...result };
  };

const toContinue = { prompt: 'Hit ENTER to continue' };

type MatchScreen =
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

/** The cup's end for the season, or a win that leads to the next round. */
const paintCupEnd = (
  view: Extract<View, { screen: 'cup-celebration' | 'cup-result' }>,
  { write }: MatchPrint
): LayoutResult | void => {
  const prompt = view.screen === 'cup-result' ? toContinue : undefined;
  if (view.celebration !== undefined) {
    paintCupVictory(
      write,
      view.celebration,
      flashPhase(view),
      view.celebrationProgress
    );
    return prompt;
  }
  write(
    0,
    0,
    view.game.cupFinished
      ? "+++You're out of the Cup+++"
      : '****You are through to the next\n\nround!****',
    { ink: view.game.cupFinished ? 0 : 2, inverse: true }
  );
  return toContinue;
};

/** A matchday, from the fixture to the league table after it. */
export const matchLayouts: Layouts<MatchScreen> = {
  'cup-celebration': printMatch<'cup-celebration'>(paintCupEnd),
  'cup-result': printMatch<'cup-result'>(paintCupEnd),
  fixture: printMatch(({ fixture, game, roundName }, { write }) => {
    const { away, home } = fixtureSides(game, fixture);
    const opponentPosition =
      game.league[fixture.opponent - (game.division - 1) * 16 - 1]?.position ??
      0;
    const print = createPrintScreen();
    print.text(
      fixture.kind === 'cup'
        ? `F.A.Cup Match - Round ${roundName}`
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
    return toContinue;
  }, false),
  highlights: printMatch((view, { output, score, write }) => {
    const { game } = view;
    const { away, home } = fixtureSides(game, view.fixture);
    write(0, 0, 'MATCH HIGHLIGHTS');
    output.at(1, 0);
    const { highlights } = view;
    if (highlights.kind === 'moments') {
      const ticker = highlights.timeline;
      score(ticker.score, home, away);
      // Newest on top; the oldest lines leave the bottom for good.
      tickerLines(game, view.fixture, ticker.shown)
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
      return { copy: false };
    }
    const playback = highlights.timeline;
    score(playback.score, home, away);
    const current = playback.current;
    if (current && current.index >= current.attack.frames.length - 2) {
      write(3, 0, current.attack.goal ? 'GOAL!' : 'NO GOAL!');
    }
    return { copy: false };
  }),
  'other-matches': printMatch(({ completion, game }, { output, score }) => {
    output.text('OTHER MATCHES-', { inverse: true });
    output.newline();
    output.tab(8);
    output.text(`Division ${game.division}`);
    output.newline();
    completion.results.forEach(result =>
      score(
        result.score,
        game.clubs[result.home - 1]!,
        game.clubs[result.away - 1]!
      )
    );
    return toContinue;
  }),
  replay: printMatch((_view, { write }) => {
    write(0, 0, 'Replay-', { ink: 3 });
    return toContinue;
  }),
  result: printMatch((view, { output, score, write }) => {
    const { away, home } = fixtureSides(view.game, view.fixture);
    write(0, 0, '**** FINAL SCORE ****', { ink: 2, inverse: true });
    output.at(1, 0);
    score(view.score, home, away);
    output.text(`Gate receipts £${view.fixture.gate}`, {
      ink: 1,
      inverse: true
    });
    return toContinue;
  }),
  selection: printMatch((view, { write }) => {
    paintSquad(view.game, write, view.pickedCount, true);
    if (view.error) {
      write(19, 0, view.error, { ink: 2, inverse: true });
    }
    return {
      label:
        view.pickedCount > 11
          ? 'Player number to remove'
          : 'Player number to add, or 99 to continue',
      numeric: true
    };
  }),
  table: printMatch(({ completion, game }, { write }) => {
    paintLeagueTable(game, write, completion.order);
    return toContinue;
  }),
  team: printMatch(({ fixture, game, pickedCount }, { write }) => {
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
    print.text(`=${pickedCount}`, {
      inverse: false
    });
    print.newline();
    print.newline();
    print.text('Type c to change team', { ink: 1, inverse: true });
    print.newline();
    print.text('OR type 99 to continue', { bright: true, paper: 6 });
    print.paint(write);
    return { label: 'c to change the picked team, or 99 to play' };
  }, false)
};
