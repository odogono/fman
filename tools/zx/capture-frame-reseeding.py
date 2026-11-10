"""Compact, separately scripted clock/reseed observations using #24's adapter.

No video or speaker edges are needed here. SAVE still executes in full, with
no tape acceleration, and interrupts remain under the original ROM's control.
"""

import json
import sys
from pathlib import Path

from capture_timing import Capture, GAME_HASH, ROM_HASH, digest
from timing_clock import FRAME, verify_clock


class FrameCapture(Capture):
    def before(self, pc):
        super().before(pc)
        # RANDOMIZE's runtime entry and the instruction after its SEED store.
        if pc in (7759, 7774):
            self.emit('randomize-enter' if pc == 7759 else 'randomize-exit',
                      **self.state())

    def write_port(self, registers, port, value, offset):
        # Nothing intercepts or accelerates SAVE; just omit its tape waveform.
        pass

    def after(self, pc, instruction, started):
        pass

    def run(self):
        result = super().run()
        result['events'] = [e for e in result['events']
                            if e['kind'] not in ('beep-enter', 'beep-exit')]
        result['maxInputLatenessT'] = result['sampling']['maxInputLatenessT']
        for key in ('video', 'imageHashes', 'outfe', 'flashPhase', 'sampling'):
            del result[key]
        return result


path = Path(sys.argv[1])
script = json.loads(path.read_text())
assert script['schema'] == 1
assert digest(Path(script['source']['tape']).read_bytes()) == script['source']['tapeSha256']
print(json.dumps({
    'schema': 1, 'model': 'SkoolKit 10.2 CCMIOSimulator PAL 48K',
    'romSha256': ROM_HASH, 'basicSha256': GAME_HASH,
    'scriptSha256': digest(path.read_bytes()), 'source': script['source'],
    'clockHz': 3500000, 'frameT': FRAME, 'intActiveT': 32,
    'clockVerification': verify_clock(),
    'runs': [FrameCapture({**script['defaults'], **spec}).run() for spec in script['runs']],
}, separators=(',', ':')))
