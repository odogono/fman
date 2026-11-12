import { presentDayClubs } from '../../web/src/sim/catalogue';
import { createRng } from '../../web/src/sim/rng';
import overrides from './overrides.json';
import { surnames } from './surnames';

// Writes the invented players of `club-squads` (#113, ADR 0012). The output is
// a pure function of this file, the surname list and the overrides, so running
// it again gives the same file; `generate.test.ts` checks that it does.

export type Position = 'DF' | 'FW' | 'GK' | 'MF';
export type SquadPlayer = Readonly<{ name: string; position: Position }>;
export type ClubSquads = Readonly<{
  freeAgents: readonly SquadPlayer[];
  squads: Readonly<Record<string, readonly SquadPlayer[]>>;
}>;

export const outputPath = 'web/src/sim/data/club-squads.json';

const seed = 2026;
// Common first initials; I, O, Q, U, V, X, Y and Z read oddly as a footballer's.
const initials = 'ABCDEFGHJKLMNPRSTW';

const positions = (counts: Readonly<Record<Position, number>>): Position[] =>
  (['GK', 'DF', 'MF', 'FW'] as const).flatMap(position =>
    Array.from({ length: counts[position] }, () => position)
  );
const squadPositions = positions({ DF: 4, FW: 3, GK: 1, MF: 4 });
const freeAgentPositions = positions({ DF: 40, FW: 40, GK: 8, MF: 40 });

export const generateSquads = (): ClubSquads => {
  const rng = createRng(seed);
  const names = new Set<string>();
  const renamed: Readonly<Record<string, string>> = overrides;

  // Draws a name no other player has. Within one squad no surname repeats,
  // so a club never fields two Smiths.
  const group = (list: readonly Position[], ownSurnames: boolean) => {
    const taken = new Set<string>();
    return list.map((position): SquadPlayer => {
      for (;;) {
        const surname = surnames[rng.int(0, surnames.length - 1)]!;
        const initial = initials[rng.int(0, initials.length - 1)]!;
        const drawn = `${initial}.${surname}`;
        if (names.has(drawn) || (ownSurnames && taken.has(surname))) {
          continue;
        }
        names.add(drawn);
        taken.add(surname);
        return { name: renamed[drawn] ?? drawn, position };
      }
    });
  };

  const squads = Object.fromEntries(
    presentDayClubs.map(club => [club.name, group(squadPositions, true)])
  );
  return { freeAgents: group(freeAgentPositions, false), squads };
};

const players = (list: readonly SquadPlayer[], indent: string) =>
  list.map(player => `${indent}${JSON.stringify(player)}`).join(',\n');

/** One player per line, so a diff of the file reads one player at a time. */
export const formatSquads = ({ freeAgents, squads }: ClubSquads) => {
  const clubs = Object.entries(squads)
    .map(
      ([club, list]) =>
        `    ${JSON.stringify(club)}: [\n${players(list, '      ')}\n    ]`
    )
    .join(',\n');
  return `{\n  "freeAgents": [\n${players(freeAgents, '    ')}\n  ],\n  "squads": {\n${clubs}\n  }\n}\n`;
};

if (import.meta.main) {
  await Bun.write(outputPath, formatSquads(generateSquads()));
  Bun.spawnSync(['bunx', 'prettier', '--write', outputPath]);
}
