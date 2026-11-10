import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';

import { beepRegisters } from '../../web/src/sim/beeper';
import reference from '../../web/src/sim/fixtures/spectrum-sound.json';
import script from './inputs/sound.json';

test('sound observations retain the pinned clock, script and unmodified game-session provenance', async () => {
  expect(reference.clockHz).toBe(3_500_000);
  expect(reference.frameT).toBe(69_888);
  expect(reference.model).toBe('SkoolKit 10.2 CCMIOSimulator PAL 48K');
  expect(reference.patches).toEqual([]);
  expect(reference.romSha256).toBe(
    'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
  );
  expect(reference.basicSha256).toBe(
    '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
  );
  expect(reference.scriptSha256).toBe(
    createHash('sha256')
      .update(
        await Bun.file(new URL('./inputs/sound.json', import.meta.url)).bytes()
      )
      .digest('hex')
  );
  expect(reference.runs.map(run => run.name)).toEqual(
    script.runs.map(run => run.name)
  );
  for (const run of reference.runs) {
    expect(run.snapshotSha256).toBe(script.defaults.snapshotSha256);
    expect(run.patches).toEqual([]);
    for (const beep of run.events.filter(
      event => event.kind === 'beep-enter'
    )) {
      const exit = run.events.find(
        event => event.kind === 'beep-exit' && event.enteredT === beep.t
      )!;
      expect(exit.seed).toBe(beep.seed);
    }
  }
});

test('isolated ROM operand probes verify every reachable goal, prompt, collision, kick, miss and cup pitch', () => {
  expect(reference.operandProbe.entry).toContain('isolated ROM BEEP');
  expect(reference.operandProbe.cases).toHaveLength(50);
  for (const { de, duration, hl, pitch } of reference.operandProbe.cases) {
    expect(beepRegisters(duration, pitch)).toEqual({ de, hl });
  }
});
