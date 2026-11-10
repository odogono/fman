import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 24-fresh-menu.z80 from observe.ts fresh mode. Export observations only.
const program = String.raw`import hashlib
import ast, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source = sys.argv[1]
results = []
for seed in [0, 1, 42, 219, 65535]:
    snapshot = Snapshot.get(source)
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
    sim = from_snapshot(CSimulator, snapshot)
    m = sim.memory
    m[23670] = seed & 255
    m[23671] = seed >> 8

    def values():
        out = {}
        for line in VariableLister().list_variables(m).splitlines():
            name, _, value = line.partition("=")
            try:
                out[name] = ast.literal_eval(value.split(" (limit=")[0])
            except (ValueError, SyntaxError):
                pass
        return out

    def state():
        v = values()
        return {
            "seed": m[23670] + 256 * m[23671],
            "attackers": v["f(3,2)"],
            "defenders": v["g(3,2)"],
        }

    def keys(pressed):
        t = KeyboardTracer(sim, pressed, 4, None)
        sim.set_tracer(t)
        t.run(65536, sim.registers[25] + 120 * 3500000, None, None, "$", "02X", "04X")

    initial = values()
    assert initial['d1'] == 4 and initial['t1'] == 64 and initial['l1'] == 1 and initial['tco'] == 0
    assert initial['ml'] == 0 and initial['c'] == 0 and initial['m'] == 100000 and initial['l'] == 0
    assert initial['f(3,2)'] == [[0,0]] * 3 and initial['g(3,2)'] == [[0,0]] * 3
    keys(["9", "9", "ENTER"])
    fixture = values()
    fixture_seed = m[23670] + 256 * m[23671]
    keys(["ENTER"])
    team = values()
    t = KeyboardTracer(sim, ["9", "9", "ENTER"], 4, None)
    sim.set_tracer(t)
    limit = sim.registers[25] + 1200 * 3500000
    attacks = []
    previous = None
    entry = None
    highlight_seed = None
    for _ in range(100000):
        t.run(6952, limit, None, None, "$", "02X", "04X")
        if sim.registers[25] >= limit:
            raise RuntimeError("Timed out")
        line = m[23621] + 256 * m[23622]
        if line != previous:
            if line == 5000:
                highlight_seed = m[23670] + 256 * m[23671]
            if line in [300, 400]:
                entry = {
                    "direction": "right" if line == 400 else "left",
                    "initial": state(),
                    "trace": [],
                }
            if line in [359, 459] and entry:
                v = values()
                entry["trace"].append(v["d(4)"] + [m[23670] + 256 * m[23671]])
            if line in [349, 449]:
                v = values()
                entry["final"] = state()
                entry["score"] = v["s(2)"]
                attacks.append(entry)
                entry = None
            if line == 5110:
                break
        previous = line
    else:
        raise RuntimeError("Statement limit reached")
    final = values()
    highlight_final_seed = m[23670] + 256 * m[23671]
    keys([])
    keys(["ENTER"])
    keys(["ENTER"])
    keys(["ENTER"])
    completed = values()
    results.append(
        {
            "seed": seed,
            "fixtureSeed": fixture_seed,
            "opponent": fixture["v1"],
            "opponentStrength": fixture["u(5)"],
            "strength": team["a(5)"],
            "highlightSeed": highlight_seed,
            "attacks": attacks,
            "score": final["s(2)"],
            "finalSeed": highlight_final_seed,
            "completed": {
                "cash": completed["m"],
                "debt": completed["l"],
                "morale": completed["a(5)"][1],
                "gate": completed["g"],
                "wages": completed["w"],
                "rent": completed["x"],
                "interest": int(completed["l"] / 100),
                "balance": completed["i"],
                "position": completed["t(16)"][15],
                "seed": m[23670] + 256 * m[23671],
                "points": completed["z(17)"][:16],
                "for": completed["b(16)"],
                "against": completed["c(16)"],
                "positions": completed["t(16)"],
            },
        }
    )
    print(seed, len(attacks), final["s(2)"], file=sys.stderr)
print(json.dumps(results, indent=2))
`;
const [input, output = 'build/zx/first-matches.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-match.ts <24-fresh-menu.z80> [output.json]'
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
  throw new Error('Original match capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote match observations to ${output}`);
