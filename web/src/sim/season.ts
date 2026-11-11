import type { Club } from './catalogue';
import type { Game } from './management';
import { movementPrintReport } from './name-print-fault';
import { createRng } from './rng';
import { lastingSkill, tiringInjuries } from './ruleset';

export type ClubMovement = Readonly<{
  club: Club;
  from: number;
  kind: 'promoted' | 'relegated' | 'champions';
  to: number;
}>;

export const completeSeason = (game: Game) => {
  if (game.leagueMatches < 15 || !game.cupFinished) {
    throw new RangeError('The season is not complete');
  }
  const offset = (game.division - 1) * 16;
  const finalPosition = game.league[game.club - offset - 1]!.position;
  const bonus = (17 - finalPosition) * 5000 * (5 - game.division);
  const clubs = [...game.clubs];
  let club = game.club;
  const movements: ClubMovement[] = [];
  const seasons = game.seasons + 1;
  const ratingTotal =
    game.ratingTotal + 17 - finalPosition + game.cupRound * 2 * game.division;
  const interrupted = (printFault: string) => ({
    bonus,
    finalPosition,
    game: {
      ...game,
      cash: game.cash + bonus,
      club,
      clubs,
      ratingTotal,
      seasons
    },
    movements,
    printFault
  });
  const swap = (
    slot: number,
    target: number,
    kind: 'promoted' | 'relegated'
  ) => {
    movements.push({
      club: clubs[slot - 1]!,
      from: game.division,
      kind,
      to: Math.floor((target - 1) / 16) + 1
    });
    const printFault = movementPrintReport(clubs[slot - 1]!, kind);
    if (printFault) {
      return printFault;
    }
    [clubs[slot - 1], clubs[target - 1]] = [
      clubs[target - 1]!,
      clubs[slot - 1]!
    ];
    if (club === slot) {
      club = target;
    }
  };
  for (let i = 1; i <= 16; i++) {
    const rank = game.league[i - 1]!.position;
    if (rank <= 3 && game.division > 1) {
      const printFault = swap(offset + i, offset - rank, 'promoted');
      if (printFault) {
        return interrupted(printFault);
      }
    } else if (rank === 1 && game.division === 1) {
      movements.push({
        club: clubs[offset + i - 1]!,
        from: 1,
        kind: 'champions',
        to: 1
      });
      const printFault = movementPrintReport(
        clubs[offset + i - 1]!,
        'champions'
      );
      if (printFault) {
        return interrupted(printFault);
      }
    }
    if (rank >= 14 && game.division < 4) {
      const printFault = swap(
        offset + i,
        game.division * 16 + 17 - rank,
        'relegated'
      );
      if (printFault) {
        return interrupted(printFault);
      }
    }
  }
  const division = Math.floor((club - 1) / 16) + 1;
  const factor = 5 - division;
  const rng = createRng(game.seed);
  const lasting = lastingSkill(game.ruleset);
  // Under tiring injuries (#98) every injury heals at the season end.
  const healing = tiringInjuries(game.ruleset);
  const players = game.players.map(p => {
    // Skill drift draws one number, as the reroll does, so every later draw
    // is the same under both rules.
    const skill =
      lasting && p.status > 0
        ? Math.min(5, Math.max(1, p.skill + rng.int(-1, 1)))
        : rng.int(1, 5);
    const energy = rng.int(1, 20);
    const next = { ...p, energy, skill, value: skill * 5000 * factor };
    if (healing && p.status === 3) {
      const { weeksOut: _, ...healed } = next;
      return { ...healed, status: 1 as const };
    }
    return next;
  });
  return {
    bonus,
    finalPosition,
    game: {
      ...game,
      cash: game.cash + bonus,
      club,
      clubs,
      cupFinished: false,
      cupRound: 0,
      division,
      homeGate: 5000 * factor,
      league: game.league.map(() => ({
        against: 0,
        for: 0,
        points: 0,
        position: 0
      })),
      leagueHome: false,
      leagueMatches: 0,
      leaguePosition: 0,
      morale: 10,
      players,
      rating: Math.min(100, Math.floor(ratingTotal / seasons) * 2),
      ratingTotal,
      scheduleCounter: 1,
      seasons,
      seed: rng.seed
    },
    movements,
    printFault: undefined
  };
};
export type SeasonCompletion = ReturnType<typeof completeSeason>;
