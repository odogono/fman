import type { Club } from './catalogue';
import data from './data/club-squads.json';
import type { Player } from './management';
import { createRng, type Rng } from './rng';

// Squads for every club (#113, ADR 0012), under `clubSquads`. The managed
// club still sees the original's 24 numbered places, holding its squad and
// the transfer list, so every draw the original makes over its 24 players
// runs over the places unchanged. Everything this module adds draws from a
// second stream, the squad seed, so the Spectrum RND sequence sees exactly
// the draws it would without squads.

export type Position = 'DF' | 'FW' | 'GK' | 'MF';
export const positions: readonly Position[] = ['GK', 'DF', 'MF', 'FW'];

/** A player outside the 24 places: in another club's squad, or a free agent. */
export type SquadPlayer = Readonly<{
  name: string;
  position: Position;
  skill: number;
}>;

type Listed = Readonly<{ name: string; position: Position }>;
const listed = data as Readonly<{
  freeAgents: readonly Listed[];
  squads: Readonly<Record<string, readonly Listed[]>>;
}>;

/** The squads every club keeps beyond the 24 places, back to this size each season. */
const squadSize = 12;

/** Defence 0, midfield 1 or attack 2; a goalkeeper counts as a defender. */
export const playerCategory = (player: Player) =>
  player.position === undefined
    ? Math.floor((player.id - 1) / 8)
    : player.position === 'MF'
      ? 1
      : player.position === 'FW'
        ? 2
        : 0;

/** Seeds the squad stream from the game's seed, away from the RND sequence. */
const squadSeedFor = (seed: number) => seed ^ 0xa5_a5;

const take = <T>(rng: Rng, list: T[]) =>
  list.splice(rng.int(0, list.length - 1), 1)[0]!;

const rolled = (rng: Rng) => (player: Listed) => ({
  name: player.name,
  position: player.position,
  skill: rng.int(1, 5)
});

/**
 * A new game's squads. `chosen` holds the places the original's loop drew
 * for the managed club, in draw order: its 12 players go into them in place
 * order, so the 12th place drawn, the reserve, may hold any of them. Free
 * agents fill the other places. The draws for the places' skill and energy
 * are the caller's, from the RND sequence, as the original makes them.
 */
export const startingSquads = (
  clubs: readonly Club[],
  managed: number,
  chosen: readonly number[],
  seed: number
) => {
  const rng = createRng(squadSeedFor(seed));
  const own = listed.squads[clubs[managed - 1]!.name]!;
  const places: (Listed | undefined)[] = new Array(24).fill(undefined);
  for (const [i, place] of [...chosen].sort((a, b) => a - b).entries()) {
    places[place] = own[i];
  }
  const free = [...listed.freeAgents];
  const filled = places.map(place => place ?? take(rng, free));
  const roll = rolled(rng);
  return {
    clubs: clubs.map((club, i) =>
      i + 1 === managed
        ? club
        : { ...club, squad: listed.squads[club.name]!.map(roll) }
    ),
    freeAgents: free.map(roll),
    places: filled,
    squadSeed: rng.seed
  };
};

/** A free agent drawn into an empty place, as an unowned player. */
const intoPlace = (
  rng: Rng,
  freeAgents: SquadPlayer[],
  id: number,
  factor: number
): Player => {
  const { name, position, skill } = take(rng, freeAgents);
  return {
    energy: rng.int(1, 20),
    id,
    name,
    position,
    skill,
    status: 0,
    value: skill * 5000 * factor
  };
};

const outOfPlace = ({ name, position, skill }: Player): SquadPlayer => ({
  name,
  position: position!,
  skill
});

/**
 * A sold player joins the buying club's squad, and a free agent from outside
 * the places takes his place. Sold to the managed club itself, as the
 * original's random buyer allows, he stays in his place as a listed free
 * agent instead, so he can be offered back as in the original.
 */
export const joinBuyer = (
  clubs: readonly Club[],
  freeAgents: readonly SquadPlayer[],
  players: readonly Player[],
  sold: Player,
  buyer: number,
  factor: number,
  seed: number
) => {
  const rng = createRng(seed);
  const free = [...freeAgents];
  const place = intoPlace(rng, free, sold.id, factor);
  return {
    clubs: clubs.map((club, i) =>
      i + 1 === buyer
        ? { ...club, squad: [...(club.squad ?? []), outOfPlace(sold)] }
        : club
    ),
    freeAgents: free,
    players: players.map(p => (p.id === sold.id ? place : p)),
    squadSeed: rng.seed
  };
};

/**
 * The season end's first steps, before the original's draws over the places:
 * clubs release their most recent signings back to twelve, and the transfer
 * list's free agents return to the free agents for new ones to be drawn into
 * their places.
 */
export const releaseAndRelist = (
  clubs: readonly Club[],
  freeAgents: readonly SquadPlayer[],
  players: readonly Player[],
  factor: number,
  seed: number
) => {
  const rng = createRng(seed);
  const released = clubs.flatMap(club => club.squad?.slice(squadSize) ?? []);
  const free = [
    ...freeAgents,
    ...released,
    ...players.filter(p => p.status === 0).map(outOfPlace)
  ];
  const relisted = players.map(p =>
    p.status === 0 ? intoPlace(rng, free, p.id, factor) : p
  );
  return {
    clubs: clubs.map(club =>
      club.squad && club.squad.length > squadSize
        ? { ...club, squad: club.squad.slice(0, squadSize) }
        : club
    ),
    freeAgents: free,
    players: relisted,
    squadSeed: rng.seed
  };
};

/**
 * The season end's last step, after the original's draws over the places:
 * players in other clubs' squads drift under lasting skill, as the managed
 * club's do, and free agents reroll, as listed ones do.
 */
export const renewSkill = (
  clubs: readonly Club[],
  freeAgents: readonly SquadPlayer[],
  lasting: boolean,
  seed: number
) => {
  const rng = createRng(seed);
  const drift = (player: SquadPlayer) => ({
    ...player,
    skill: lasting
      ? Math.min(5, Math.max(1, player.skill + rng.int(-1, 1)))
      : rng.int(1, 5)
  });
  return {
    clubs: clubs.map(club =>
      club.squad ? { ...club, squad: club.squad.map(drift) } : club
    ),
    freeAgents: freeAgents.map(player => ({ ...player, skill: rng.int(1, 5) })),
    squadSeed: rng.seed
  };
};
