"""Capture reachable prompt/editor sounds with the shared, unpatched clock."""
import json
import math
from pathlib import Path
from skoolkit import CCMIOSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.trace import Tracer
from capture_timing import Capture, GAME_HASH, ROM_HASH, digest
from timing_clock import FRAME

class SoundCapture(Capture):
    def before(self, pc):
        super().before(pc)
        if pc == 6952:
            self.emit('statement', **self.state())

    def after(self, pc, instruction, started):
        if pc == 0x03F7 and self.beep is not None:
            self.beep['returnedT'] = self.r[25]

def encode(value):
    if int(value) == value:
        integer = int(value) & 65535
        return [0, 255 if value < 0 else 0, integer & 255, integer >> 8, 0]
    exponent = math.floor(math.log2(abs(value)))
    mantissa = math.floor(abs(value) * 2 ** (31 - exponent) + 0.5)
    return [exponent + 129, ((mantissa >> 24) & 127) | (128 if value < 0 else 0),
            (mantissa >> 16) & 255, (mantissa >> 8) & 255, mantissa & 255]


def operands(snapshot_path):
    # Separate synthetic ROM-unit probes. These do not run or patch a game session.
    result = []
    for duration, pitch in ([(.05, p) for p in range(1, 37)] +
                            [(.2, p) for p in range(10)] +
                            [(.15, -40), (.15, -30), (.08, -40), (.25, -50)]):
        sim = from_snapshot(CCMIOSimulator, Snapshot.get(snapshot_path))
        sim.set_tracer(Tracer(sim, 7, 0, 0, [0] * 16, 0, False))
        m, r = sim.memory, sim.registers
        m[40960:40970] = encode(duration) + encode(pitch)
        for address, value in [(23651, 40960), (23653, 40970), (23656, 23698)]:
            m[address:address + 2] = [value & 255, value >> 8]
        r[12] = 65200  # SP, synthetic caller stack in uncontended RAM
        r[26] = 0     # IFF, no keyboard ISR in this operand-only probe
        condition, _ = sim.trace(1016, 949, 1000000, 0, False,
                                 None, None, None, None, None)
        assert condition == 3, (duration, pitch, condition, r[24], list(r))
        result.append({'duration': duration, 'pitch': pitch,
                       'hl': r[7] + 256 * r[6], 'de': r[5] + 256 * r[4]})
    return {'entry': 'isolated ROM BEEP PC=1016 to BEEPER PC=949',
            'synthetic': 'calculator operands, workspace pointers, caller SP and IFF',
            'cases': result}


path = Path('tools/zx/inputs/sound.json')
script = json.loads(path.read_text())
assert digest(Path(script['source']['tape']).read_bytes()) == script['source']['tapeSha256']
runs = []
for spec in script['runs']:
    capture = SoundCapture({**script['defaults'], **spec})
    result = capture.run()
    for key in ('video', 'imageHashes', 'flashPhase'):
        del result[key]
    runs.append(result)
print(json.dumps({'schema': 1, 'clockHz': 3500000, 'frameT': FRAME,
    'model': 'SkoolKit 10.2 CCMIOSimulator PAL 48K', 'patches': [],
    'romSha256': ROM_HASH, 'basicSha256': GAME_HASH,
    'scriptSha256': digest(path.read_bytes()), 'runs': runs,
    'operandProbe': operands(script['defaults']['snapshot'])}, separators=(',', ':')))
