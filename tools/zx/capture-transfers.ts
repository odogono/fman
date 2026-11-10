import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 10-bills.z80 from observe.ts saved mode. Export observations only.
const program = String.raw`import ast, hashlib, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source = sys.argv[1]
def values(sim):
    out = {}
    for line in VariableLister().list_variables(sim.memory).splitlines():
        name, _, value = line.partition('=')
        try:
            out[name] = ast.literal_eval(value.split(' (limit=')[0])
        except (ValueError, SyntaxError):
            pass
    return out

def keys(sim, pressed):
    tracer = KeyboardTracer(sim, pressed, 4, None)
    sim.set_tracer(tracer)
    tracer.run(65536, sim.registers[25] + 30 * 3500000, None, None, '$', '02X', '04X')
    assert not tracer.keys

def seed(sim):
    return sim.memory[23670] + 256 * sim.memory[23671]

records = []
for initial_seed in [0, 1, 42, 219, 65535]:
    for bid in [0, 10000, 50000, 999999]:
        snapshot = Snapshot.get(source)
        assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == '73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6'
        sim = from_snapshot(CSimulator, snapshot)
        assert sim.memory[23621] + 256 * sim.memory[23622] == 1030
        before = values(sim)
        assert before['ml'] == 1 and before['p1'] == 14 and before['d1'] == 3
        sim.memory[23670] = initial_seed & 255
        sim.memory[23671] = initial_seed >> 8
        keys(sim, ['ENTER'])
        offer = values(sim)
        assert sim.memory[23621] + 256 * sim.memory[23622] == 1170
        offer_seed = seed(sim)
        keys(sim, list(str(bid)) + ['ENTER'])
        after = values(sim)
        assert sim.memory[23621] + 256 * sim.memory[23622] == 1030
        records.append({
            'seed': initial_seed, 'bid': bid,
            'playerId': offer['r1'], 'offerSeed': offer_seed,
            'afterSeed': seed(sim), 'cash': after['m'],
            'status': after['p(24)'][offer['r1'] - 1],
            'value': after['v(24)'][offer['r1'] - 1],
        })
initial = {key: before[key] for key in ['m','l','d1','ml','p(24)','r(24)','y(24)','v(24)']}
print(json.dumps({'initial': initial, 'records': records}, indent=2))
`;
const [input, output = 'build/zx/transfers.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-transfers.ts <10-bills.z80> [output.json]'
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
  throw new Error('Original transfer capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote transfer observations to ${output}`);
