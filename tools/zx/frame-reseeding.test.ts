import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import reference from '../../web/src/sim/fixtures/frame-reseeding.json';

test('pins the separately scripted reseed capture to the validated original and clock', async () => {
  const script = Bun.file(
    new URL('./inputs/frame-reseeding.json', import.meta.url)
  );
  expect(reference.scriptSha256).toBe(
    createHash('sha256')
      .update(await script.bytes())
      .digest('hex')
  );
  expect(reference.schema).toBe(1);
  expect(reference.romSha256).toBe(
    'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
  );
  expect(reference.basicSha256).toBe(
    '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
  );
  const input = await script.json();
  expect(reference.runs.map(run => run.name)).toEqual(
    input.runs.map((run: { name: string }) => run.name)
  );
  for (const run of reference.runs) {
    expect(run.snapshotSha256).toBe(input.defaults.snapshotSha256);
    expect(run.patches).toEqual([]);
    expect(run.originT).toBe(run.initialRegisters[25]!);
  }
});

test('observes actual RANDOMIZE entry and SEED-store exit at both management boundaries', () => {
  for (const run of reference.runs) {
    const commands = run.events.filter(event =>
      ['randomize-enter', 'randomize-exit'].includes(event.kind)
    );
    expect(commands).toHaveLength(4);
    for (let i = 0; i < commands.length; i += 2) {
      const enter = commands[i]!;
      const exit = commands[i + 1]!;
      expect(enter.kind).toBe('randomize-enter');
      expect(exit.kind).toBe('randomize-exit');
      expect(enter.line).toBe(100);
      expect(exit.line).toBe(100);
      expect(exit.t).toBeGreaterThan(enter.t);
      expect(exit.romFrames).toBe(enter.romFrames);
      expect(exit.seed).toBe(exit.romFrames! & 65_535);
    }
  }
});
