import { mkdir } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { format, resolveConfig } from 'prettier';

import { mixSeed } from './random';
import { rulesets, type Ruleset, type RunRecord } from './run';
import { strategies, strategyNamed } from './strategies';
import {
  compare,
  comparisonMarkdown,
  parseSummary,
  summarise,
  toMarkdown
} from './summary';
import type { Job } from './worker';

const usage = `Usage:
  bun run baseline [--ruleset original] [--levels 1,4,7] [--strategies all]
                   [--runs 200] [--seasons 10] [--seed 1] [--out build/baseline]
                   [--workers N]
  bun run baseline:compare <a.json> <b.json>`;

const list = (text: string) => text.split(',').filter(Boolean);
const integer = (name: string, text: string, min: number, max: number) => {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`--${name} must be an integer from ${min} to ${max}`);
  }
  return value;
};

/** Plays every job on a pool of workers; results come back in job order. */
const playAll = async (jobs: readonly Job[], workers: number) => {
  const records: RunRecord[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  const started = performance.now();
  const work = () =>
    new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('worker.ts', import.meta.url));
      const send = () => {
        if (next === jobs.length) {
          worker.terminate();
          resolve();
          return;
        }
        worker.postMessage(jobs[next++]);
      };
      worker.onmessage = (
        event: MessageEvent<
          | { index: number; record: RunRecord }
          | { error: string; index: number }
        >
      ) => {
        const data = event.data;
        if ('error' in data) {
          worker.terminate();
          const job = jobs[data.index]!;
          reject(
            new Error(
              `Run ${data.index} (level ${job.level}, ${job.strategy}, seed ${job.seed}): ${data.error}`
            )
          );
          return;
        }
        records[data.index] = data.record;
        done++;
        if (done % 100 === 0 || done === jobs.length) {
          const seconds = (performance.now() - started) / 1000;
          process.stderr.write(
            `\r${done}/${jobs.length} runs, ${seconds.toFixed(0)} s`
          );
        }
        send();
      };
      worker.onerror = event => {
        worker.terminate();
        reject(new Error(event.message));
      };
      send();
    });
  await Promise.all(Array.from({ length: workers }, work));
  process.stderr.write('\n');
  return records;
};

const baseline = async (args: string[]) => {
  const { values } = parseArgs({
    args,
    options: {
      levels: { default: '1,4,7', type: 'string' },
      out: { default: 'build/baseline', type: 'string' },
      ruleset: { default: 'original', type: 'string' },
      runs: { default: '200', type: 'string' },
      seasons: { default: '10', type: 'string' },
      seed: { default: '1', type: 'string' },
      strategies: { default: 'all', type: 'string' },
      workers: { default: String(availableParallelism()), type: 'string' }
    },
    strict: true
  });
  if (!rulesets.includes(values.ruleset as Ruleset)) {
    throw new RangeError(
      `Unknown ruleset ${values.ruleset}; only ${rulesets.join(', ')} exists`
    );
  }
  const ruleset = values.ruleset as Ruleset;
  const levels = list(values.levels).map(l => integer('levels', l, 1, 7));
  const names =
    values.strategies === 'all'
      ? strategies.map(s => s.name)
      : list(values.strategies).map(name => strategyNamed(name).name);
  const runs = integer('runs', values.runs, 1, 100_000);
  const seasonLimit = integer('seasons', values.seasons, 1, 100);
  const seed = integer('seed', values.seed, 0, 2 ** 32 - 1);
  const workers = integer('workers', values.workers, 1, 256);

  // Run i has the same seed in every cell, so cells share their timing
  // draws and differ only by level and strategy.
  const jobs: Job[] = levels.flatMap(level =>
    names.flatMap(strategy =>
      Array.from({ length: runs }, (_, run) => ({
        index: 0,
        level,
        ruleset,
        seasonLimit,
        seed: mixSeed(seed, run),
        strategy
      }))
    )
  );
  jobs.forEach((job, index) => (job.index = index));

  const started = performance.now();
  const records = await playAll(jobs, Math.min(workers, jobs.length));
  const seconds = (performance.now() - started) / 1000;
  process.stderr.write(
    `${records.length} runs in ${seconds.toFixed(1)} s on ${workers} workers (${((seconds * workers) / records.length).toFixed(2)} s per run)\n`
  );

  await mkdir('build/baseline', { recursive: true });
  await Bun.write(
    join('build/baseline', `${ruleset}-runs.jsonl`),
    records.map(r => JSON.stringify(r)).join('\n') + '\n'
  );
  const summary = summarise(records, {
    levels,
    ruleset,
    runs,
    seasonLimit,
    seed,
    strategies: names
  });
  await mkdir(values.out, { recursive: true });
  await Bun.write(
    join(values.out, `${ruleset}.json`),
    JSON.stringify(summary) + '\n'
  );
  // Formatted as the repo formats markdown, so a committed baseline passes
  // the format check as generated.
  const markdownPath = join(values.out, `${ruleset}.md`);
  await Bun.write(
    markdownPath,
    await format(toMarkdown(summary), {
      ...(await resolveConfig(markdownPath)),
      filepath: markdownPath
    })
  );
  process.stderr.write(
    `Wrote ${join(values.out, `${ruleset}.md`)} and .json; raw runs in build/baseline/${ruleset}-runs.jsonl\n`
  );
};

const compareFiles = async ([a, b, ...rest]: string[]) => {
  if (!a || !b || rest.length) {
    throw new RangeError(usage);
  }
  const before = parseSummary(await Bun.file(a).text());
  const after = parseSummary(await Bun.file(b).text());
  process.stdout.write(
    comparisonMarkdown(before, after, compare(before, after))
  );
};

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'baseline') {
    await baseline(args);
  } else if (command === 'compare') {
    await compareFiles(args);
  } else {
    throw new RangeError(usage);
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
