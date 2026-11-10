import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// Only generated numeric observations are exported, never ROM or game bytes.
const program = String.raw`
import hashlib, json, math, random, sys
from pathlib import Path
from skoolkit import CSimulator, ROM48
from skoolkit.trace import Tracer

rom = Path(ROM48).read_bytes()
assert hashlib.sha256(rom).hexdigest() == 'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42', 'Unexpected 48K ROM'
sim = CSimulator(list(rom) + [0] * 49152,
                 {'SP': 65200, 'IY': 23610}, {'iff': 0})
sim.set_tracer(Tracer(sim, 7, 0, 0, [0] * 16, 0, False))
memory = sim.memory
memory[23656:23658] = [146, 92]  # MEM: calculator scratch area

def word(address, value):
    memory[address:address + 2] = [value & 255, value >> 8]

def run(start, stop):
    condition, operations = sim.trace(start, stop, 100000, 0, False,
                                      None, None, None, None, None)
    assert condition == 3, (start, condition, operations)

def encode(value):
    if int(value) == value and -65535 <= value <= 65535:
        integer = int(value) & 65535
        return bytes([0, 255 if value < 0 else 0, integer & 255, integer >> 8, 0])
    exponent = math.floor(math.log2(abs(value)))
    mantissa = math.floor(abs(value) * 2 ** (31 - exponent) + 0.5)
    if mantissa == 2 ** 32:
        exponent += 1
        mantissa >>= 1
    return bytes([exponent + 129,
                  ((mantissa >> 24) & 127) | (128 if value < 0 else 0),
                  (mantissa >> 16) & 255, (mantissa >> 8) & 255, mantissa & 255])

def calculate(operation, operands):
    data = b''.join(operands)
    memory[40960:40960 + len(data)] = list(data)
    word(23651, 40960)  # STKBOT
    word(23653, 40960 + len(data))  # STKEND
    memory[32768:32771] = [239, operation, 56]  # RST 28; operation; end-calc
    run(32768, 32771)
    assert memory[23653] + 256 * memory[23654] == 40965
    return bytes(memory[40960:40965]).hex()

pairs = [(1, 10), (1, 3), (1, 1000), (3, 10), (7, 3), (0.1, 0.2),
         (1.5, 2), (-1.5, 2), (-0.1, 0.2), (-1.5, -2), (65535, 1),
         (-65000, -536), (100000, 5000), (107392, 9400), (0, 5),
         (1, 2**-32), (1, 2**-33), (1, -(2**-32)),
         (2**-128, 0.5), (2**-128, 1), (2**126, 0.5)]
sample_count = int(sys.argv[1])
samples = random.Random(1982)
for _ in range(sample_count):
    pairs.append((samples.uniform(-1000000, 1000000), samples.uniform(-20, 20)))
operations = []
for name, opcode in [('add', 15), ('subtract', 3), ('multiply', 4), ('divide', 5)]:
    for left, right in pairs:
        if name == 'divide' and left == 2**126:
            continue
        inputs = [encode(left), encode(right)]
        operations.append({'operation': name, 'inputs': [v.hex() for v in inputs],
                           'result': calculate(opcode, inputs)})
for name, opcode in [('add', 15), ('subtract', 3), ('multiply', 4), ('divide', 5)]:
    inputs = [bytes.fromhex('00ff000000'), encode(2)]
    operations.append({'operation': name, 'inputs': [v.hex() for v in inputs],
                       'result': calculate(opcode, inputs)})
for name, opcode in [('add', 15), ('subtract', 3), ('multiply', 4)]:
    inputs = [encode(2), bytes.fromhex('00ff000000')]
    operations.append({'operation': name, 'inputs': [v.hex() for v in inputs],
                       'result': calculate(opcode, inputs)})
operations.append({'operation': 'floor', 'inputs': ['00ff000000'],
                   'result': calculate(39, [bytes.fromhex('00ff000000')])})
for value in [0, 1.5, -1.5, 0.1, -0.1, 65535.5, -65535.5, 100000.5]:
    data = encode(value)
    operations.append({'operation': 'floor', 'inputs': [data.hex()],
                       'result': calculate(39, [data])})

# Enter the ROM's RND implementation just after syntax checking and stop
# immediately after it updates SEED and scales the result by 65536.
def rnd(seed):
    word(23670, seed)
    word(23651, 40960)
    word(23653, 40960)
    run(9725, 9765)
    return memory[23670] + 256 * memory[23671]

sequences = []
for initial in [0, 1, 42, 219, 65535]:
    seed = initial
    values = []
    for _ in range(8):
        seed = rnd(seed)
        values.append(seed)
    sequences.append({'initial': initial, 'seeds': values})
digest = hashlib.sha256()
for seed in range(65536):
    digest.update(rnd(seed).to_bytes(2, 'little'))

frame_vectors = []
randomize_vectors = []
for frames in [0, 65535, 65536, 65755, 16777215]:
    word(23672, frames & 65535)
    memory[23674] = frames >> 16
    run(56, 72)  # stop after incrementing FRAMES, before keyboard scanning
    after = memory[23672] + 256 * memory[23673] + 65536 * memory[23674]
    frame_vectors.append({'before': frames, 'after': after})
    for argument in [0, 42, 65535]:
        word(23672, frames & 65535)
        memory[23674] = frames >> 16
        memory[40960:40965] = list(encode(argument))
        word(23651, 40960)
        word(23653, 40965)
        run(7759, 7774)
        result = memory[23670] + 256 * memory[23671]
        randomize_vectors.append({'frames': frames, 'argument': argument, 'seed': result})

print(json.dumps({'romSha256': hashlib.sha256(rom).hexdigest(),
                  'skoolkit': '10.2', 'operations': operations,
                  'frames': frame_vectors, 'randomize': randomize_vectors,
                  'randomSequences': sequences,
                  'randomTransitionsSha256': digest.hexdigest()}, indent=2))
`;

const output = Bun.argv[2] ?? 'build/zx/compatibility.json';
const samples = Number(Bun.argv[3] ?? 0);
if (!Number.isInteger(samples) || samples < 0 || samples > 10_000) {
  throw new RangeError('Sample count must be between 0 and 10000');
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
    String(samples)
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const result = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
  throw new Error('ROM reference capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote numeric ROM observations to ${output}`);
