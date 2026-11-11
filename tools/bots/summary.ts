import { createHarnessRng, mixSeed, type HarnessRng } from './random';
import type { RunRecord } from './run';

/** A per-run number summarised across a cell's runs. */
type Metric = Readonly<{
  /** How the markdown shows it: a rate, a median with IQR, or a mean. */
  format: 'rate' | 'median' | 'mean';
  key: string;
  label: string;
  value: (run: RunRecord) => number | undefined;
}>;

const leagueMatches = (run: RunRecord) =>
  run.league.won + run.league.drawn + run.league.lost;
const perMatch = (run: RunRecord, value: number) =>
  leagueMatches(run) ? value / leagueMatches(run) : undefined;
const divisions = (run: RunRecord) => [
  ...run.seasons.map(s => s.division),
  run.final.division
];

export const metrics: readonly Metric[] = [
  {
    format: 'rate',
    key: 'dismissed',
    label: 'Dismissed',
    value: run => (run.end === 'dismissed' ? 1 : 0)
  },
  {
    format: 'median',
    key: 'seasons',
    label: 'Seasons completed',
    value: run => run.seasons.length
  },
  {
    format: 'median',
    key: 'bestDivision',
    label: 'Best division',
    value: run => Math.min(...divisions(run))
  },
  {
    format: 'median',
    key: 'finalDivision',
    label: 'Final division',
    value: run => run.final.division
  },
  {
    format: 'mean',
    key: 'promotions',
    label: 'Promotions',
    value: run => run.seasons.filter(s => s.movement === 'promoted').length
  },
  {
    format: 'mean',
    key: 'relegations',
    label: 'Relegations',
    value: run => run.seasons.filter(s => s.movement === 'relegated').length
  },
  {
    format: 'median',
    key: 'position',
    label: 'Mean league position',
    value: run =>
      run.seasons.length
        ? run.seasons.reduce((sum, s) => sum + s.position, 0) /
          run.seasons.length
        : undefined
  },
  {
    format: 'rate',
    key: 'winRate',
    label: 'League win rate',
    value: run => perMatch(run, run.league.won)
  },
  {
    format: 'mean',
    key: 'goalsFor',
    label: 'Goals for per league match',
    value: run => perMatch(run, run.league.goalsFor)
  },
  {
    format: 'mean',
    key: 'goalsAgainst',
    label: 'Goals against per league match',
    value: run => perMatch(run, run.league.goalsAgainst)
  },
  {
    format: 'mean',
    key: 'cupWins',
    label: 'Cup wins',
    value: run => run.seasons.filter(s => s.cupWon).length
  },
  {
    format: 'median',
    key: 'peakDebt',
    label: 'Peak debt (£)',
    value: run => run.peakDebt
  },
  {
    format: 'median',
    key: 'finalNet',
    label: 'Final cash − debt (£)',
    value: run => run.final.cash - run.final.debt
  },
  {
    format: 'mean',
    key: 'injuries',
    label: 'Injuries per season',
    value: run =>
      run.seasons.length ? run.injuries / run.seasons.length : undefined
  },
  {
    format: 'rate',
    key: 'shortHanded',
    label: 'Short-handed matches',
    value: run => (run.matches ? run.shortHanded / run.matches : undefined)
  }
];

export type Cell = {
  level: number;
  strategy: string;
  /** Each metric's per-run values, in run order, without missing values. */
  values: Record<string, number[]>;
};

export type Summary = {
  cells: Cell[];
  format: 'fman-baseline';
  levels: number[];
  ruleset: string;
  runs: number;
  seasonLimit: number;
  seed: number;
  strategies: string[];
  version: 1;
};

export const summarise = (
  records: readonly RunRecord[],
  options: Omit<Summary, 'cells' | 'format' | 'version'>
): Summary => ({
  cells: options.levels.flatMap(level =>
    options.strategies.map(strategy => {
      const runs = records.filter(
        r => r.level === level && r.strategy === strategy
      );
      return {
        level,
        strategy,
        values: Object.fromEntries(
          metrics.map(m => [
            m.key,
            runs
              .map(m.value)
              .filter((v): v is number => v !== undefined)
              .map(v => Math.round(v * 10_000) / 10_000)
          ])
        )
      };
    })
  ),
  format: 'fman-baseline',
  version: 1,
  ...options
});

const quantile = (sorted: readonly number[], q: number) => {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
};
const mean = (values: readonly number[]) =>
  values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : Number.NaN;

const number = (value: number) => {
  if (Number.isNaN(value)) {
    return '–';
  }
  if (Math.abs(value) >= 1000) {
    return Math.round(value).toLocaleString('en-GB');
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const show = (metric: Metric, values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  switch (metric.format) {
    case 'rate':
      return Number.isNaN(mean(values))
        ? '–'
        : `${(mean(values) * 100).toFixed(1)}%`;
    case 'mean':
      return number(mean(values));
    case 'median':
      return `${number(quantile(sorted, 0.5))} (${number(quantile(sorted, 0.25))}–${number(quantile(sorted, 0.75))})`;
  }
};

/** Tables for review: one per difficulty level, strategies as columns. */
export const toMarkdown = (summary: Summary) => {
  const lines = [
    `# Gameplay baseline: ${summary.ruleset} ruleset`,
    '',
    `${summary.runs} runs per level and strategy, ending at dismissal or after ${summary.seasonLimit} seasons. Harness seed ${summary.seed}. Generated by \`bun run baseline\`; see [the harness](../gameplay-baseline.md).`,
    '',
    'Rates and means are over runs; other values are the median (interquartile range).'
  ];
  for (const level of summary.levels) {
    const cells = summary.cells.filter(c => c.level === level);
    lines.push(
      '',
      `## Level ${level}`,
      '',
      `| Metric | ${cells.map(c => c.strategy).join(' | ')} |`,
      `| --- | ${cells.map(() => '---').join(' | ')} |`
    );
    for (const metric of metrics) {
      lines.push(
        `| ${metric.label} | ${cells.map(c => show(metric, c.values[metric.key] ?? [])).join(' | ')} |`
      );
    }
  }
  return `${lines.join('\n')}\n`;
};

export type Difference = {
  /** Mean of `b` minus mean of `a`. */
  difference: number;
  high: number;
  level: number;
  low: number;
  metric: string;
  strategy: string;
};

const bootstrapResamples = 2000;

/** The mean of a same-size sample drawn with replacement. */
const resampledMean = (values: readonly number[], rng: HarnessRng) => {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[rng.int(0, values.length - 1)]!;
  }
  return sum / values.length;
};

/**
 * Compares each metric's mean between matching cells, with a 95% bootstrap
 * interval for the difference. A difference is significant when its
 * interval excludes zero.
 */
export const compare = (a: Summary, b: Summary) => {
  const differences: Difference[] = [];
  for (const cellA of a.cells) {
    const cellB = b.cells.find(
      c => c.level === cellA.level && c.strategy === cellA.strategy
    );
    if (!cellB) {
      continue;
    }
    for (const metric of metrics) {
      const xs = cellA.values[metric.key] ?? [];
      const ys = cellB.values[metric.key] ?? [];
      if (!xs.length || !ys.length) {
        continue;
      }
      const rng = createHarnessRng(
        mixSeed(
          cellA.level,
          ...[...`${cellA.strategy}:${metric.key}`].map(c => c.charCodeAt(0))
        )
      );
      const deltas = Array.from(
        { length: bootstrapResamples },
        () => resampledMean(ys, rng) - resampledMean(xs, rng)
      ).sort((p, q) => p - q);
      differences.push({
        difference: mean(ys) - mean(xs),
        high: quantile(deltas, 0.975),
        level: cellA.level,
        low: quantile(deltas, 0.025),
        metric: metric.key,
        strategy: cellA.strategy
      });
    }
  }
  return differences;
};

export const significant = (d: Difference) => d.low > 0 || d.high < 0;

const metricLabel = (key: string) => metrics.find(m => m.key === key)!.label;

export const comparisonMarkdown = (
  a: Summary,
  b: Summary,
  differences: readonly Difference[]
) => {
  const flagged = differences.filter(significant);
  const lines = [
    `# ${a.ruleset} → ${b.ruleset}`,
    '',
    `${flagged.length} of ${differences.length} metric means differ beyond sampling noise (95% bootstrap interval excludes zero).`
  ];
  if (flagged.length) {
    lines.push(
      '',
      '| Level | Strategy | Metric | Change in mean | 95% interval |',
      '| --- | --- | --- | --- | --- |',
      ...flagged.map(
        d =>
          `| ${d.level} | ${d.strategy} | ${metricLabel(d.metric)} | ${d.difference > 0 ? '+' : ''}${number(d.difference)} | ${number(d.low)} to ${number(d.high)} |`
      )
    );
  }
  return `${lines.join('\n')}\n`;
};

export const parseSummary = (text: string): Summary => {
  const value = JSON.parse(text) as Partial<Summary>;
  if (value.format !== 'fman-baseline' || value.version !== 1) {
    throw new RangeError('Not a version 1 fman baseline summary');
  }
  return value as Summary;
};
