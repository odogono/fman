import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 24-fresh-menu.z80 from observe.ts fresh mode. Controlled round-entry states; see docs/cup-progression.md.
const program = String.raw`import hashlib
import ast, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister
from pathlib import Path
import struct, zlib

source = sys.argv[1]
results = []
for cup_round, seed, forced in [(r,s,None) for r in range(2,9) for s in [0,1,42,219,65535]] + [(8,0,"win"),(8,0,"draw")]:
    snapshot = Snapshot.get(source)
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
    sim = from_snapshot(CSimulator, snapshot)
    m = sim.memory
    m[23670] = 0
    m[23671] = 0

    def values():
        out = {}
        for line in VariableLister().list_variables(m).splitlines():
            name, _, value = line.partition("=")
            try:
                out[name] = ast.literal_eval(value.split(" (limit=")[0])
            except (ValueError, SyntaxError):
                pass
        return out

    def keys(pressed, seconds=120):
        t = KeyboardTracer(sim, pressed, 4, None)
        sim.set_tracer(t)
        t.run(65536, sim.registers[25] + seconds * 3500000, None, None, "$", "02X", "04X")

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
    def put_integer(address, value):
        assert 0 <= value < 65536
        m[address:address + 5] = [0, 0, value & 255, value >> 8, 0]
    for name, value in [('ma',2),('ml',cup_round*2-1),('c',cup_round-1)]:
        put_integer(offsets.scalars[name],value)
    m[23670] = seed & 255
    m[23671] = seed >> 8
    before = values()
    def compact(v):
        return {key: v[key] for key in ['m','l','ml','ma','c','fa','g','xp','a(5)','p(24)','y(24)','f(3,2)','g(3,2)']}
    initial = compact(before)
    keys(["9", "9", "ENTER"])
    legs = []
    for leg in range(20):
        fixture = values()
        fixture_seed = m[23670] + 256 * m[23671]
        keys(["ENTER"])
        team = values()
        team_seed = m[23670] + 256 * m[23671]
        t = KeyboardTracer(sim, ["9", "9", "ENTER"], 4, None)
        sim.set_tracer(t)
        limit = sim.registers[25] + 1200 * 3500000
        for _ in range(100000):
            t.run(6952, limit, None, None, "$", "02X", "04X")
            if sim.registers[25] >= limit:
                raise RuntimeError("Cup highlight timeout")
            if m[23621] + 256 * m[23622] == 5110:
                break
        else:
            raise RuntimeError("Cup statement limit reached")
        if leg == 0 and forced:
            put_integer(offsets.arrays['s'], 1 if forced == 'draw' else 2 if fixture['h'] == 1 else 1)
            put_integer(offsets.arrays['s'] + 5, 1 if forced == 'draw' else 1 if fixture['h'] == 1 else 2)
        final = values()
        final_seed = m[23670] + 256 * m[23671]
        keys([])
        keys(["ENTER"])
        legs.append({
            'home': fixture['h'] == 1, 'opponent': fixture['v1'],
            'opponentStrength': fixture['u(5)'], 'gate': fixture['x9'],
            'fixtureSeed': fixture_seed, 'teamSeed': team_seed,
            'strength': team['a(5)'], 'statuses': team['p(24)'], 'energy': team['y(24)'],
            'score': final['s(2)'], 'finalSeed': final_seed,
            'attackers': final['f(3,2)'], 'defenders': final['g(3,2)'],
        })
        if final['s(2)'][0] != final['s(2)'][1]:
            if forced == 'win':
                # Native screen for private visual analysis; never exported as source.
                palette = [(0,0,0),(0,0,205),(205,0,0),(205,0,205),(0,205,0),(0,205,205),(205,205,0),(205,205,205)]
                rows = []
                for y in range(192):
                    row = bytearray([0])
                    for x in range(256):
                        attr = m[22528 + (y//8)*32 + x//8]
                        bits = m[16384 + (y//64)*2048 + (y%8)*256 + ((y%64)//8)*32 + x//8]
                        color = (attr & 7) if bits & (128 >> (x%8)) else ((attr>>3)&7)
                        rgb = palette[color]
                        row.extend((255 if c else 0 for c in rgb) if attr & 64 else rgb)
                    rows.append(row)
                def chunk(kind, data):
                    return struct.pack('>I',len(data)) + kind + data + struct.pack('>I',zlib.crc32(kind+data))
                png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR',struct.pack('>2I5B',256,192,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(b''.join(rows))) + chunk(b'IEND',b'')
                Path('roms/zx/analysis/native-cup-winner.png').write_bytes(png)
            break
        keys(["ENTER"])
    else:
        raise RuntimeError("Replay limit reached")
    keys(["ENTER"])
    completed = compact(values())
    completed['seed'] = m[23670] + 256 * m[23671]
    results.append({'round':cup_round,'seed': seed,'forced':forced, 'initial': initial, 'legs': legs, 'completed': completed})
    print(cup_round,seed,forced,[leg['score'] for leg in legs],file=sys.stderr)
print(json.dumps(results, indent=2))
`;
const [input, output = 'build/zx/later-cups.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-later-cups.ts <24-fresh-menu.z80> [output.json]'
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
  throw new Error('Original later-cup capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote cup observations to ${output}`);
