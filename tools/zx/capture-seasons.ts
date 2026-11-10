import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 10-bills.z80 from observe.ts saved mode; controlled season-entry states.
const program = String.raw`import hashlib
import ast, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source = sys.argv[1]
results = []
initial = None
for division, rank, seed in [(d,r,s) for d in range(1,5) for r in [1,3,8,14,16] for s in [0,1,42,219,65535]]:
    snapshot = Snapshot.get(source)
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == '73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6'
    sim = from_snapshot(CSimulator,snapshot)
    m = sim.memory
    def values():
        out = {}
        for line in VariableLister().list_variables(m).splitlines():
            name, _, value = line.partition('=')
            try:
                out[name] = ast.literal_eval(value.split(' (limit=')[0])
            except (ValueError,SyntaxError):
                pass
        return out
    def keys(pressed):
        tracer = KeyboardTracer(sim,pressed,4,None)
        sim.set_tracer(tracer)
        tracer.run(65536,sim.registers[25]+60*3500000,None,None,'$','02X','04X')
        assert not tracer.keys
    class Offsets(VariableLister):
        def __init__(self):
            super().__init__()
            self.scalars = {}
            self.arrays = {}
        def _get_short_num_var(self, name, i):
            self.scalars[name] = i + 1
            return super()._get_short_num_var(name, i)
        def _get_long_num_var(self, name, i):
            end, line = super()._get_long_num_var(name, i)
            self.scalars[line.partition('=')[0]] = end - 5
            return end, line
        def _get_num_array_var(self, name, i):
            self.arrays[name] = i + 4 + 2 * m[i + 3]
            return super()._get_num_array_var(name, i)
    offsets = Offsets()
    offsets.list_variables(m)
    def put_integer(address,value):
        assert 0 <= value < 65536
        m[address:address+5] = [0,0,value & 255,value >> 8,0]
    cup_round = 1 if seed in [0,1] else 8
    for name,value in [('d1',division),('lt',(division-1)*16),('t1',(division-1)*16+8),('d2',5-division),('ml',15),('fa',1),('c',cup_round),('s',48),('s5',3)]:
        put_integer(offsets.scalars[name],value)
    positions = list(range(1,17))
    positions[7], positions[rank-1] = positions[rank-1], positions[7]
    for i,position in enumerate(positions):
        put_integer(offsets.arrays['t']+i*5,position)
    # Keep the end-of-season table's display order consistent with those ranks.
    class CharOffsets(VariableLister):
        def _get_char_array_var(self,name,i):
            if name == 'u':
                start = i+4+2*m[i+3]
                m[start:start+16] = [i+1 for i in sorted(range(16),key=lambda i:positions[i])]
            return super()._get_char_array_var(name,i)
    CharOffsets().list_variables(m)
    put_integer(offsets.arrays['p'],3)
    m[23670] = seed & 255
    m[23671] = seed >> 8
    before = values()
    if initial is None:
        initial = {key:before[key] for key in ['m','l','xp','p(24)','r(24)','y(24)','v(24)','f(3,2)','g(3,2)']}
    keys(['ENTER'])
    assert m[23621]+256*m[23622] == 1030
    keys(['ENTER'])
    assert m[23621]+256*m[23622] == 1030
    keys(['ENTER'])
    assert m[23621]+256*m[23622] == 1030
    after = values()
    assert after['ml'] == 0 and after['c'] == 0
    final_seed = m[23670]+256*m[23671]
    club_order = [before['t$(64,12)'].index(name)+1 for name in after['t$(64,12)']]
    keys(['ENTER'])
    keys(['s','ENTER'])
    rating = values()['s1']
    keys(['ENTER'])
    m[23670] = seed & 255
    m[23671] = seed >> 8
    keys(['9','9','ENTER'])
    opening = values()
    opening_seed = m[23670] + 256 * m[23671]
    keys(['ENTER'])
    opening_team = values()
    opening_observation = {'opponent':opening['v1'],'home':opening['h']==1,'gate':opening['x9'],'strength':opening['u(5)'],'seed':opening_seed,'teamSeed':m[23670]+256*m[23671],'statuses':opening_team['p(24)'],'energy':opening_team['y(24)']}
    results.append({'division':division,'rank':rank,'seed':seed,'cupRound':cup_round,'positions':positions,
        'clubOrder':club_order,'rating':rating,'finalSeed':final_seed,'opening':opening_observation,
        'completed':{key:after[key] for key in ['t1','d1','m','l','g','xp','s','s5','p(24)','r(24)','y(24)','v(24)','f(3,2)','g(3,2)','ma','ml','c','fa','h1','z(17)','b(16)','c(16)','t(16)']}})
    print(division,rank,seed,after['d1'],file=sys.stderr)
print(json.dumps({'initial':initial,'cases':results},indent=2))
`;
const [input, output = 'build/zx/seasons.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-seasons.ts <10-bills.z80> [output.json]'
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
  throw new Error('Original season capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote season observations to ${output}`);
