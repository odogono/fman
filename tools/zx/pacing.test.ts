import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import costs from '../../web/src/sim/execution-costs.json';
import { pacingCosts } from './pacing-costs';

const capture = await Bun.file(
  new URL('../../web/src/sim/fixtures/spectrum-pacing.json', import.meta.url)
).json();
test('the statement budgets regenerate from the pinned, unpatched observations', async () => {
  const script = new Uint8Array(
    await Bun.file(
      new URL('./inputs/pacing.json', import.meta.url)
    ).arrayBuffer()
  );
  expect(capture.scriptSha256).toBe(
    createHash('sha256').update(script).digest('hex')
  );
  expect(capture.romSha256).toBe(
    'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
  );
  expect(capture.basicSha256).toBe(
    '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
  );
  expect(capture.model).toBe('48K PAL');
  expect(capture.clockHz).toBe(3_500_000);
  expect(capture.frameT).toBe(69_888);
  expect(capture.patches).toEqual([]);
  expect(
    Object.keys(costs).some(edge => /^(9:8|8966:2|3230:1)>/.test(edge))
  ).toBe(false);
  expect(pacingCosts(capture)).toEqual(costs);
  expect(
    Object.values(costs).every(row => row[0]! > 0 && row.every(t => t >= 0))
  ).toBe(true);
});

test('pacing extends the timing corpus without changing its original runs or snapshot', async () => {
  const script = await Bun.file(
    new URL('./inputs/pacing.json', import.meta.url)
  ).json();
  const reference = await Bun.file(
    new URL('./inputs/timing.json', import.meta.url)
  ).json();
  expect(script.source).toEqual(reference.source);
  expect(script.defaults.snapshotSha256).toBe(
    reference.defaults.snapshotSha256
  );
  for (const run of reference.runs) {
    expect(
      script.runs.find(
        (candidate: { name: string }) => candidate.name === run.name
      )
    ).toEqual(run);
  }
  expect(capture.runs.map((run: { name: string }) => run.name)).toEqual(
    script.runs.map((run: { name: string }) => run.name)
  );
});
