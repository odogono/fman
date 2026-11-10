import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 24-fresh-menu.z80 from observe.ts fresh mode. First match uses seed 0; cup and continued league seeds are controlled.
const program = String.raw`import hashlib
import ast, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source = sys.argv[1]
results = []
for cup_seed, seed in [(c, s) for c in [0, 1] for s in [0, 1, 42, 219, 65535]]:
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

    initial = values()
    assert initial['d1'] == 4 and initial['t1'] == 64 and initial['l1'] == 1 and initial['tco'] == 0
    assert initial['ml'] == 0 and initial['c'] == 0 and initial['m'] == 100000 and initial['l'] == 0
    assert initial['f(3,2)'] == [[0,0]] * 3 and initial['g(3,2)'] == [[0,0]] * 3
    keys(["9", "9", "ENTER"])
    keys(["ENTER"])
    keys(["9", "9", "ENTER"], 1200)
    for _ in range(3):
        keys(["ENTER"])
    # Bills -> transfer -> management; explicitly control the next cup seed.
    keys(["ENTER"])
    keys(["9", "9", "ENTER"])
    m[23670] = cup_seed & 255
    m[23671] = cup_seed >> 8
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
            break
        keys(["ENTER"])
    else:
        raise RuntimeError("Replay limit reached")
    keys(["ENTER"])
    def league_state():
        v = values()
        return {key: v[key] for key in ['m','l','ml','ma','c','fa','g','xp','a(5)','p(24)','y(24)','f(3,2)','g(3,2)','z(17)','b(16)','c(16)','t(16)','h1','r(24)','v(24)']}
    initial = league_state()
    keys(["ENTER"])
    keys(["9", "9", "ENTER"])
    matches = []
    count = 14 if cup_seed == 1 and seed == 0 else 2
    for index in range(count):
        # Control the seed after the outer RANDOMIZE, independently of timing.
        m[23670] = seed & 255
        m[23671] = seed >> 8
        keys(["9", "9", "ENTER"])
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
                raise RuntimeError("League highlight timeout")
            if m[23621] + 256 * m[23622] == 5110:
                break
        else:
            raise RuntimeError("League statement limit reached")
        final = values()
        final_seed = m[23670] + 256 * m[23671]
        keys([])
        for _ in range(3):
            keys(["ENTER"])
        completed = values()
        matches.append({
            'home': fixture['h'] == 1, 'opponent': fixture['v1'],
            'opponentStrength': fixture['u(5)'], 'gate': fixture['x9'],
            'fixtureSeed': fixture_seed, 'teamSeed': team_seed,
            'strength': team['a(5)'], 'statuses': team['p(24)'], 'energy': team['y(24)'],
            'score': final['s(2)'], 'finalSeed': final_seed,
            'attackers': final['f(3,2)'], 'defenders': final['g(3,2)'],
            'completed': {key: completed[key] for key in ['m','l','ml','ma','g','xp','a(5)','z(17)','b(16)','c(16)','t(16)','i','w','x']},
            'completedSeed': m[23670] + 256 * m[23671],
        })
        if index + 1 < count:
            keys(["ENTER"])
            keys(["9", "9", "ENTER"])
    results.append({'cupSeed': cup_seed, 'seed': seed, 'initial': initial, 'matches': matches})
    print(cup_seed, seed, len(matches), file=sys.stderr)
print(json.dumps(results, indent=2))
`;
const [input, output = 'build/zx/league-progression.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-league.ts <24-fresh-menu.z80> [output.json]'
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
  throw new Error('Original league capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote league observations to ${output}`);
