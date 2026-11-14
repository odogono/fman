import {
  clubSquads,
  gracePeriodWeeks,
  presentDay,
  tiringInjuries,
  type Ruleset
} from './ruleset';
import { integer, kit, squadPlayer } from './save-checks';
import { positions } from './squads';

type Saved = Record<string, unknown>;

/** Fields a rule owns at one level of a saved game, and how to check them. */
type Owned<Check> = Readonly<{ keys: readonly string[]; valid: Check }>;

/**
 * The data one rule adds to a saved game: the fields it owns on the game,
 * its clubs and its players, and the save version they arrived in. Each
 * check holds both ways: the fields are valid while the rule is on, and
 * absent while it is off.
 */
export type RuleData = Readonly<{
  club?: Owned<
    (club: Saved, index: number, game: Saved, on: boolean) => boolean
  >;
  game?: Owned<(game: Saved, on: boolean, ruleset: Ruleset) => boolean>;
  /** The rule is on under this ruleset. */
  on: (ruleset: Ruleset) => boolean;
  player?: Owned<(player: Saved, on: boolean) => boolean>;
  /** The save version the data arrived in; older saves never carry it. */
  since?: number;
}>;

/** Every rule that adds data to a saved game. */
export const ruleData: Readonly<Record<string, RuleData>> = {
  /** Every club owns a squad (#113), drawn from a second random stream. */
  clubSquads: {
    club: {
      keys: ['squad'],
      // Every club but the managed one keeps its squad outside the places.
      valid: (club, index, game, on) =>
        on && index + 1 !== game.club
          ? Array.isArray(club.squad) && club.squad.every(squadPlayer)
          : club.squad === undefined
    },
    game: {
      keys: ['freeAgents', 'squadSeed'],
      valid: (game, on) =>
        on
          ? integer(game.squadSeed, 0, 65_535) &&
            Array.isArray(game.freeAgents) &&
            game.freeAgents.every(squadPlayer)
          : game.squadSeed === undefined && game.freeAgents === undefined
    },
    on: clubSquads,
    player: {
      keys: ['position'],
      valid: (player, on) =>
        on
          ? positions.includes(player.position as never)
          : player.position === undefined
    },
    since: 11
  },
  /** Debts over the credit limit get weeks to clear (#74). */
  gracePeriod: {
    game: {
      keys: ['graceWeeks'],
      valid: (game, on, ruleset) =>
        game.graceWeeks === undefined ||
        (on && integer(game.graceWeeks, 0, gracePeriodWeeks(ruleset) ?? -1))
    },
    on: ruleset => gracePeriodWeeks(ruleset) !== undefined,
    since: 8
  },
  /**
   * Present-day clubs wear their own kits (#91), in place of the colour
   * chosen at the start.
   */
  presentDay: {
    club: {
      keys: ['kit', 'paper'],
      valid: (club, _index, _game, on) =>
        on
          ? kit(club.kit) &&
            (club.paper === undefined || integer(club.paper, 0, 7))
          : club.kit === undefined && club.paper === undefined
    },
    game: {
      keys: ['colour'],
      valid: (game, on) =>
        on ? game.colour === undefined : game.colour === 0 || game.colour === 7
    },
    on: presentDay
  },
  /** An injured player misses up to three weeks (#98). */
  tiringInjuries: {
    on: tiringInjuries,
    player: {
      keys: ['weeksOut'],
      valid: (player, on) =>
        player.weeksOut === undefined ||
        (on && player.status === 3 && integer(player.weeksOut, 1, 3))
    },
    since: 10
  }
};
