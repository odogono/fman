import { readFileSync } from 'node:fs';

type Boundary = [number, string, number, number];
type Wait = { enteredT?: number; kind: string; returnedT?: number; t: number };
type Capture = {
  runs: { events: Wait[]; name: string; path: Boundary[] }[];
};
const interpreterElapsed = (
  t: number,
  origin: number,
  waits: readonly (readonly [number, number])[]
) =>
  t -
  origin -
  waits.reduce(
    (sum, [begin, finish]) => sum + Math.max(0, Math.min(t, finish) - begin),
    0
  );

/** Interpreter work between dispatches, with explicit waits removed. */
export const pacingCosts = (capture: Capture) => {
  const samples = new Map<string, number[][]>();
  for (const run of capture.runs) {
    for (let i = 0; i < run.path.length; i++) {
      const start = run.path[i]!;
      if (
        start[1] !== 'statement' ||
        (start[2] === 9 && start[3] === 8) ||
        (start[2] === 8966 && start[3] === 2) ||
        (start[2] === 3230 && start[3] === 1)
      ) {
        continue;
      }
      let j = i + 1;
      while (j < run.path.length && run.path[j]![1] !== 'statement') {
        j++;
      }
      const end = run.path[j];
      if (!end || end[0] - start[0] > 30_000_000) {
        continue;
      }
      const waits = run.events.flatMap(event => {
        if (event.kind !== 'beep-enter' && event.kind !== 'pause-exit') {
          return [];
        }
        const begin = event.kind === 'beep-enter' ? event.t : event.enteredT;
        const finish = event.kind === 'beep-enter' ? event.returnedT : event.t;
        return begin !== undefined &&
          finish !== undefined &&
          begin >= start[0] &&
          finish <= end[0]
          ? [[begin, finish] as const]
          : [];
      });
      const prints = run.path
        .slice(i + 1, j)
        .filter(e => e[1] === 'print' || e[1] === 'line');
      const key = `${start[2]}:${start[3]}>${end[2]}:${end[3]}`;
      const rows = samples.get(key) ?? [];
      rows.push([
        interpreterElapsed(end[0], start[0], waits),
        ...prints.map(
          p =>
            interpreterElapsed(p[0], start[0], waits) +
            (p[1] === 'print' ? 3000 : 0)
        )
      ]);
      samples.set(key, rows);
    }
  }
  return Object.fromEntries(
    [...samples]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        const size = Math.max(...rows.map(row => row.length));
        const budget = Array.from({ length: size }, (_, i) => {
          const values = rows
            .flatMap(row => (row[i] === undefined ? [] : [row[i]!]))
            .sort((a, b) => a - b);
          return values[Math.floor(values.length / 2)]!;
        });
        return [key, budget];
      })
  );
};

if (import.meta.main) {
  const input = Bun.argv[2] ?? 'build/zx/pacing.json';
  const capture: Capture = JSON.parse(readFileSync(input, 'utf8'));
  await Bun.write(
    'web/src/sim/execution-costs.json',
    JSON.stringify(pacingCosts(capture))
  );
}
