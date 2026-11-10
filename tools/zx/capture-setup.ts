import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Capture the original's setup exit before line 100 reseeds from FRAMES.
// Input is 23-colours.z80 produced by observe.ts in fresh mode.
const program = String.raw`
import ast, hashlib, json, sys
from pathlib import Path
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

snapshot = Snapshot.get(sys.argv[1])
ram = bytes(snapshot.ram())
assert hashlib.sha256(ram[7371:40513]).hexdigest() == '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
sim = from_snapshot(CSimulator, snapshot)
memory = sim.memory
initial = memory[23670] + 256 * memory[23671]
initial_variables = VariableLister().list_variables(memory)
assert 'm$="alex"' in initial_variables and 'l1=1' in initial_variables
assert 'p(24)=' + str([0] * 24) in initial_variables
tracer = KeyboardTracer(sim, ['0', 'ENTER'], 4, None)
sim.set_tracer(tracer)
limit = sim.registers[25] + 60 * 3500000
for _ in range(2000):
    tracer.run(6952, limit, None, None, '$', '02X', '04X')
    line = memory[23621] + 256 * memory[23622]
    if line == 8999:
        break
else:
    raise RuntimeError('Original setup exit was not reached')
assert not tracer.keys
variables = VariableLister().list_variables(memory)
def array(name):
    text = next(line for line in variables.splitlines() if line.startswith(name + '(24)='))
    return ast.literal_eval(text.split('=', 1)[1])
statuses, skills, energies, values = [array(name) for name in ['p', 'r', 'y', 'v']]
print(json.dumps({
    'sourceTapeSha256': '7fb5e9d4b8115bd4835ce9f1479ed498f05b52f2c435f40f089403ccadc72763',
    'initialSeed': initial, 'manager': 'alex', 'chosenClub': 1, 'level': 1, 'colour': 0,
    'seedBeforeRandomize': memory[23670] + 256 * memory[23671],
    'players': [{'status': statuses[i], 'skill': skills[i], 'energy': energies[i], 'value': values[i]} for i in range(24)]
}, indent=2))
`;

const [input, output = 'build/zx/fresh-setup.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-setup.ts <23-colours.z80> [output.json]'
  );
}
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    '-c',
    program,
    resolve(input)
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const result = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
  throw new Error('Original setup capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote setup observations to ${output}`);
