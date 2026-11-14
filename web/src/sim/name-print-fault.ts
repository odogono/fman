import { coloursText, type Club } from './catalogue';
import type { Game } from './management';
import { encodeClubName, nameBytes } from './names';
import type { ScreenView } from './session';
import { PrintError, createPrintDecoder } from './spectrum-print';

/** PRINT faults do not undo the assignment which made a name visible. */
export const namePrintReport = (
  bytes: readonly number[],
  line: number,
  statement = 1
) => {
  const decoder = createPrintDecoder(() => {});
  try {
    decoder.string(bytes);
  } catch (error) {
    if (!(error instanceof PrintError)) {
      throw error;
    }
    return `${error.message}, ${line}:${statement}`;
  }
  return undefined;
};

export const scorePrintReport = (
  game: Game,
  home: number,
  away: number,
  goals: readonly number[],
  line: number
) =>
  namePrintReport(
    [
      ...encodeClubName(game.clubs[home - 1]!),
      23,
      12,
      0,
      ...nameBytes(String(goals[0])),
      6,
      ...encodeClubName(game.clubs[away - 1]!),
      23,
      28,
      0,
      ...nameBytes(String(goals[1])),
      13
    ],
    line
  );

export const tablePrintReport = (game: Game, index: number) => {
  const record = game.league[index]!;
  return namePrintReport(
    [
      ...encodeClubName(game.clubs[(game.division - 1) * 16 + index]!),
      23,
      18,
      0,
      ...nameBytes(String(record.for)),
      23,
      22,
      0,
      ...nameBytes(String(record.against)),
      23,
      28,
      0,
      ...nameBytes(String(record.points)),
      13
    ],
    7810
  );
};

export const movementPrintReport = (
  club: Club,
  kind: 'promoted' | 'relegated' | 'champions'
) =>
  namePrintReport(
    [
      ...encodeClubName(club),
      ...(kind === 'champions'
        ? [16, 2]
        : [32, 16, kind === 'promoted' ? 1 : 3]),
      ...nameBytes(' are '),
      13
    ],
    kind === 'promoted' ? 8520 : kind === 'relegated' ? 8620 : 8570
  );

/** Follow the byte suffixes in the game's PRINT statements, including TAB.
 * A truncated AT/TAB may consume those bytes instead of acting like text.
 */
export const screenPrintFault = (view: ScreenView): string | undefined => {
  if (!view.game) {
    return;
  }
  const game = view.game;
  const club = (id: number) => encodeClubName(game.clubs[id - 1]!);
  const player = (id: number) =>
    nameBytes(game.players[id - 1]!.name.padEnd(8));
  const text = nameBytes;
  const score = (
    home: number,
    away: number,
    goals: readonly number[],
    line: number
  ) => scorePrintReport(game, home, away, goals, line);
  switch (view.screen) {
    case 'status':
      return namePrintReport(
        [
          ...club(game.club),
          6,
          ...text(coloursText(game.colour, game.clubs[game.club - 1]!)),
          13
        ],
        3002
      );
    case 'squad':
    case 'selection':
    case 'transfer': {
      const players =
        view.screen === 'transfer'
          ? [game.players[view.playerId - 1]!]
          : game.players.filter(p => p.status > 0);
      for (const p of players) {
        const report = namePrintReport(
          [
            ...player(p.id),
            ...text(` ${p.id}`),
            23,
            15,
            0,
            ...text(String(p.skill)),
            23,
            20,
            0,
            ...text(String(p.energy)),
            23,
            24,
            0,
            ...text(`£${p.value}`),
            23,
            31,
            0,
            16,
            6,
            20,
            1,
            32,
            13
          ],
          2550
        );
        if (report) {
          return report;
        }
      }
      break;
    }
    case 'sale':
      return namePrintReport(
        [
          ...club(view.offer.buyerId),
          32,
          16,
          1,
          ...text(`have offered £${view.offer.amount}`),
          6,
          ...text(' for '),
          ...player(view.offer.playerId),
          13,
          13,
          ...text(
            `He is worth £${game.players[view.offer.playerId - 1]!.value}`
          ),
          13
        ],
        2485
      );
    case 'fixture': {
      const home = view.fixture.home ? game.club : view.fixture.opponent;
      const away = view.fixture.home ? view.fixture.opponent : game.club;
      return namePrintReport(
        [
          ...club(home),
          ...text(' v '),
          ...club(away),
          6,
          6,
          6,
          ...text(view.fixture.kind === 'cup' ? 'Division ' : 'Lge.Pos. ')
        ],
        4240
      );
    }
    case 'team':
      return namePrintReport(
        [...club(game.club), 23, 22, 0, ...club(view.fixture.opponent), 13],
        6605
      );
    case 'result':
    case 'highlights':
      return score(
        view.fixture.home ? game.club : view.fixture.opponent,
        view.fixture.home ? view.fixture.opponent : game.club,
        view.screen === 'result' ? view.score : view.highlights.timeline.score,
        1090
      );
    case 'other-matches':
      for (const result of view.completion.results) {
        const report = score(result.home, result.away, result.score, 7630);
        if (report) {
          return report;
        }
      }
      break;
    case 'table':
    case 'season-table':
      for (const i of view.screen === 'table'
        ? view.completion.order
        : game.league
            .map((_, index) => index)
            .sort(
              (a, b) => game.league[a]!.position - game.league[b]!.position
            )) {
        const report = tablePrintReport(game, i);
        if (report) {
          return report;
        }
      }
      break;
    case 'season-summary':
      for (const movement of view.season.movements) {
        const report = movementPrintReport(movement.club, movement.kind);
        if (report) {
          return report;
        }
      }
      break;
    case 'transfer-result':
      return namePrintReport([...text(view.text), 13], 8770);
    case 'message':
      if (view.message.kind === 'text') {
        return namePrintReport([...text(view.message.text), 13], 2510);
      }
      break;
  }
  return undefined;
};
