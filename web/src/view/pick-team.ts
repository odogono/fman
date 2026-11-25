import {
  fixtureSides,
  removesOnly,
  teamStrength,
  type MatchFixture
} from '../sim/league';
import type { Game, Player } from '../sim/management';
import {
  countedSkill,
  letterFor,
  lineLetters,
  lineOrder,
  outOfPosition,
  playsIn,
  skillAt,
  type LineLetter
} from '../sim/natural-positions';
import { offeredAnswers } from '../sim/offers';
import {
  longestInjury,
  naturalPositions,
  tiringInjuries
} from '../sim/ruleset';
import type { View } from '../sim/session';
import { inSquadOrder, playerCategory } from '../sim/squads';
import { clubName, type ClubName } from './home';

/** One squad player as a pick team row. */
export type PickTeamRow = Readonly<{
  /**
   * The offered answer a tap submits, only while the original takes this
   * player's number: a reserve while it adds, a picked player while it drops.
   */
  answer?: string;
  energy: number;
  /** What a tap on the row does, read aloud, alongside its answer. */
  label?: string;
  /** The status marker: `p`, `i` or, under tiring injuries, the weeks out. */
  marker: string;
  name: string;
  number: number;
  /**
   * Under natural positions (#121), the lines he can be put in, each with
   * the offered answer that puts him there and the skill he'd count there.
   */
  placings?: readonly Placing[];
  /** Out of position (#121): the letter of the line he plays in, and what he counts there. */
  playsIn?: Readonly<{ counts: number; line: LineLetter }>;
  skill: number;
  status: 'picked' | 'injured' | 'reserve';
  /** The row's block: D, M or A by category, G for a goalkeeper. */
  tag: string;
  value: number;
}>;

/** A line a player can be put in, by an offered answer (#121). */
export type Placing = Readonly<{
  answer: string;
  counts: number;
  line: LineLetter;
}>;

export type PickTeamGroup = Readonly<{
  /** Defence 0, midfield 1, attack 2: the row ink. */
  category: number;
  /**
   * Under natural positions (#121) the groups are where players play: a
   * line, or the reserves and injured.
   */
  line?: LineLetter | 'reserves';
  players: readonly PickTeamRow[];
  title: string;
}>;

export type PickTeamAction = Readonly<{
  /** Only while the original takes it, not during a timed pause. */
  enabled: boolean;
  id: string;
  label: string;
  tone: 'primary' | 'red';
}>;

/**
 * Modern mode's pick team screen (#44), standing in for the original's team
 * prompt (change or kick off) and its selection prompt (add or drop).
 */
/** The two teams' strengths: the managed club's, then the opponent's. */
export type Strengths = Readonly<{
  club: ClubName;
  opponent: ClubName;
  rows: readonly (readonly [string, number, number])[];
}>;

export type PickTeam = Readonly<{
  actions: readonly PickTeamAction[];
  /**
   * Under natural positions (#121) on the selection prompt, players are
   * moved by dragging, or by choosing one and then a line.
   */
  arranging?: boolean;
  groups: readonly PickTeamGroup[];
  /** What a tap on a live row does, on the selection prompt only. */
  hint?: string;
  picked: number;
  /** The squad prompt stands in for "Sell or list your players". */
  prompt: 'team' | 'selection' | 'squad';
  /** The team prompt's strengths. */
  strengths?: Strengths;
  /**
   * Under tiring injuries the legend counts weeks out, not `i`, up to this
   * many (#98, #110); otherwise `undefined`.
   */
  weeksOut?: number;
}>;

const groupTitles = ['Defence', 'Midfield', 'Attack'];
const strengthNames = ['Energy', 'Morale', 'Defence', 'Midfield', 'Attack'];

const rowFor = (
  player: Player,
  weeksOut: boolean,
  offered: ReadonlySet<string>,
  prompt: 'selection' | 'squad',
  verb: 'Add' | 'Drop' | 'Sell'
): PickTeamRow => {
  const answer = `${prompt}.player.${player.id}`;
  const status =
    player.status === 2
      ? 'picked'
      : player.status === 3
        ? 'injured'
        : 'reserve';
  return {
    ...(offered.has(answer)
      ? {
          answer,
          label: `${verb} ${player.name.trim()}, number ${player.id}`
        }
      : {}),
    energy: player.energy,
    marker:
      status === 'picked'
        ? 'p'
        : status === 'injured'
          ? weeksOut
            ? String(player.weeksOut ?? 1)
            : 'i'
          : '',
    name: player.name.trim(),
    number: player.id,
    ...(outOfPosition(player)
      ? {
          playsIn: {
            counts: countedSkill(player),
            line: letterFor(player.plays!)
          }
        }
      : {}),
    skill: player.skill,
    status,
    tag: player.position === 'GK' ? 'G' : 'DMA'.charAt(playerCategory(player)),
    value: player.value
  };
};

/** The lines an answer on offer can put the player in (#121). */
const placingsFor = (
  player: Player,
  offered: ReadonlySet<string>
): readonly Placing[] =>
  lineOrder.flatMap(line => {
    const answer = `selection.place.${player.id}.${line}`;
    return offered.has(answer)
      ? [{ answer, counts: skillAt(player, lineLetters[line]), line }]
      : [];
  });

const lineTitles: Readonly<Record<LineLetter, string>> = {
  A: 'Attack',
  D: 'Defence',
  G: 'Goal',
  M: 'Midfield'
};

/**
 * Under natural positions (#121), the squad by where each picked player
 * plays, goal first, then the reserves and injured.
 */
const lineGroups = (
  squad: readonly Player[],
  row: (player: Player) => PickTeamRow,
  offered: ReadonlySet<string>
): PickTeamGroup[] => {
  const withPlacings = (player: Player): PickTeamRow => {
    const placings = placingsFor(player, offered);
    return { ...row(player), ...(placings.length ? { placings } : {}) };
  };
  return [
    ...lineOrder.map(line => ({
      category: line === 'M' ? 1 : line === 'A' ? 2 : 0,
      line,
      players: squad
        .filter(p => playsIn(p) === lineLetters[line])
        .map(withPlacings),
      title: lineTitles[line]
    })),
    {
      category: 0,
      line: 'reserves' as const,
      players: squad.filter(p => p.status !== 2).map(withPlacings),
      title: 'Reserves and injured'
    }
  ];
};

/** As on the original comparison screen: the managed club first. */
export const strengthsFor = (game: Game, fixture: MatchFixture): Strengths => {
  const { club, opponent } = fixtureSides(game, fixture);
  const ours = teamStrength(game);
  return {
    club: clubName(club),
    opponent: clubName(opponent),
    rows: strengthNames.map(
      (name, i) => [name, ours[i]!, fixture.opponentStrength[i]!] as const
    )
  };
};

export const pickTeamFor = (view: View): PickTeam | undefined => {
  if (
    view.screen !== 'team' &&
    view.screen !== 'selection' &&
    view.screen !== 'squad'
  ) {
    return undefined;
  }
  const { game, pickedCount: picked } = view;
  const prompt = view.screen === 'squad' ? 'squad' : 'selection';
  // Over eleven picked the original only drops, and 99 isn't taken.
  const dropping = removesOnly(game);
  const verb = prompt === 'squad' ? 'Sell' : dropping ? 'Drop' : 'Add';
  const weeksOut = tiringInjuries(game.ruleset);
  const longest = weeksOut ? { weeksOut: longestInjury(game.ruleset) } : {};
  const offered = new Set(offeredAnswers(view).map(answer => answer.id));
  const squad = inSquadOrder(game.players.filter(p => p.status > 0));
  const action = (
    id: string,
    label: string,
    tone: PickTeamAction['tone']
  ): PickTeamAction => ({ enabled: offered.has(id), id, label, tone });
  const row = (player: Player) =>
    rowFor(player, weeksOut, offered, prompt, verb);
  const natural = naturalPositions(game.ruleset);
  const groups = natural
    ? lineGroups(squad, row, offered)
    : groupTitles.map((title, category) => ({
        category,
        players: squad
          .filter(player => playerCategory(player) === category)
          .map(row),
        title
      }));
  if (view.screen === 'team') {
    return {
      actions: [
        action('team.change', 'Change team', 'red'),
        action('team.kick-off', 'Kick off', 'primary')
      ],
      groups,
      picked,
      prompt: 'team',
      strengths: strengthsFor(game, view.fixture),
      ...longest
    };
  }
  // Every owned player can be offered for sale, injured or not: the
  // original answers an injured one with its own message.
  if (view.screen === 'squad') {
    return {
      actions: [action('squad.back', 'Done', 'primary')],
      groups,
      hint: 'Tap a player to sell',
      picked,
      prompt: 'squad',
      ...longest
    };
  }
  if (natural) {
    // Over eleven, Done waits for a drop, as the original won't take 99.
    return {
      actions: [
        dropping
          ? {
              enabled: false,
              id: 'selection.done',
              label: `Drop ${picked - 11} to continue`,
              tone: 'primary'
            }
          : action('selection.done', 'Done – continue', 'primary')
      ],
      arranging: true,
      groups,
      hint: dropping
        ? `${picked} picked – drag one to the reserves`
        : 'Drag a player to a line, or tap him, then a line',
      picked,
      prompt: 'selection',
      ...longest
    };
  }
  return {
    actions: dropping
      ? []
      : [action('selection.done', 'Done – continue', 'primary')],
    groups,
    hint: dropping
      ? `${picked} picked – tap one to drop`
      : 'Tap a player to add',
    picked,
    prompt: 'selection',
    ...longest
  };
};
