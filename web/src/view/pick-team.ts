import { fixtureSides, teamStrength } from '../sim/league';
import type { Player } from '../sim/management';
import { tiringInjuries } from '../sim/ruleset';
import type { View } from '../sim/session';
import { inSquadOrder, playerCategory } from '../sim/squads';
import { answersFor } from './answers';
import { clubName, type ClubName } from './home';

/** One squad player as a pick team row. */
export type PickTeamRow = Readonly<{
  /**
   * The offered answer a tap submits, only while the original takes this
   * player's number: a reserve while it adds, a picked player while it drops.
   */
  answer?: string;
  energy: number;
  /** The status marker: `p`, `i` or, under tiring injuries, the weeks out. */
  marker: string;
  name: string;
  number: number;
  skill: number;
  status: 'picked' | 'injured' | 'reserve';
  /** The row's block: D, M or A by category, G for a goalkeeper. */
  tag: string;
  value: number;
}>;

export type PickTeamGroup = Readonly<{
  /** Defence 0, midfield 1, attack 2: the row ink. */
  category: number;
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
export type PickTeam = Readonly<{
  actions: readonly PickTeamAction[];
  groups: readonly PickTeamGroup[];
  /** What a tap on a live row does, on the selection prompt only. */
  hint?: string;
  picked: number;
  prompt: 'team' | 'selection';
  /** The team prompt's strengths: the managed club's, then the opponent's. */
  strengths?: Readonly<{
    club: ClubName;
    opponent: ClubName;
    rows: readonly (readonly [string, number, number])[];
  }>;
  /** Under tiring injuries the legend counts weeks out, not `i`. */
  weeksOut: boolean;
}>;

const groupTitles = ['Defence', 'Midfield', 'Attack'];
const strengthNames = ['Energy', 'Morale', 'Defence', 'Midfield', 'Attack'];

const rowFor = (
  player: Player,
  weeksOut: boolean,
  offered: ReadonlySet<string>
): PickTeamRow => {
  const answer = `selection.player.${player.id}`;
  const status =
    player.status === 2
      ? 'picked'
      : player.status === 3
        ? 'injured'
        : 'reserve';
  return {
    ...(offered.has(answer) ? { answer } : {}),
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
    skill: player.skill,
    status,
    tag: player.position === 'GK' ? 'G' : 'DMA'.charAt(playerCategory(player)),
    value: player.value
  };
};

export const pickTeamFor = (view: View): PickTeam | undefined => {
  if (view.screen !== 'team' && view.screen !== 'selection') {
    return undefined;
  }
  const { game, pickedCount: picked } = view;
  const weeksOut = tiringInjuries(game.ruleset);
  const offered = new Set(answersFor(view).map(answer => answer.id));
  const squad = inSquadOrder(game.players.filter(p => p.status > 0));
  const action = (
    id: string,
    label: string,
    tone: PickTeamAction['tone']
  ): PickTeamAction => ({ enabled: offered.has(id), id, label, tone });
  const groups = groupTitles.map((title, category) => ({
    category,
    players: squad
      .filter(player => playerCategory(player) === category)
      .map(player => rowFor(player, weeksOut, offered)),
    title
  }));
  if (view.screen === 'team') {
    const { club, opponent } = fixtureSides(game, view.fixture);
    const ours = teamStrength(game);
    return {
      actions: [
        action('team.change', 'Change team', 'red'),
        action('team.kick-off', 'Kick off', 'primary')
      ],
      groups,
      picked,
      prompt: 'team',
      strengths: {
        club: clubName(club),
        opponent: clubName(opponent),
        rows: strengthNames.map(
          (name, i) =>
            [name, ours[i]!, view.fixture.opponentStrength[i]!] as const
        )
      },
      weeksOut
    };
  }
  // Over eleven picked the original only drops, and 99 isn't taken.
  const dropping = picked > 11;
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
    weeksOut
  };
};
