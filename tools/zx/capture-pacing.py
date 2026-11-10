"""Statement and character boundaries for the pacing model; no memory patches.

Extends the unchanged #24 keyboard scripts and contention-aware clock. Only numeric
observations are exported. Run with uv run --with skoolkit==10.2 python -B.
"""

import json
import sys
from pathlib import Path

from capture_timing import Capture, GAME_HASH, ROM_HASH, digest
from timing_clock import FRAME


class PacingCapture(Capture):
    def __init__(self, spec):
        super().__init__(spec)
        self.path = []

    def before(self, pc):
        super().before(pc)
        line = self.word(23621)
        if line not in (8, 9, 8966, 1090, 1092) and not (270 <= line <= 479 or 3200 <= line <= 3260 or 5000 <= line <= 5110 or 5213 <= line <= 5237):
            return
        if pc == 6952:
            self.path.append([self.r[25], 'statement', line, self.m[23623]])
            if line == 5000:
                self.emit('highlight-entry', **self.state(), values=self.values())
        elif pc == 2943:
            # PR-ALL: every printable character, after form/position resolution.
            self.path.append([self.r[25], 'print', line, self.m[23623]])
        elif pc == 0x24BA:
            self.path.append([self.r[25], 'line', line, self.m[23623]])

    def write_port(self, registers, port, value, offset):
        pass

    def after(self, pc, instruction, started):
        if pc == 0x03F7 and self.beep is not None:
            self.beep['returnedT'] = self.r[25]

    def run(self):
        result = super().run()
        events = []
        for event in result['events']:
            if event['kind'] in ('beep-enter', 'pause-exit'):
                events.append({k: v for k, v in event.items()
                               if k in ('kind', 't', 'returnedT', 'enteredT', 'hl', 'de', 'line', 'statement')})
            elif event['kind'] == 'highlight-entry':
                events.append(event)
        return {'name': result['name'], 'originT': self.origin,
                'events': events, 'path': self.path}


path = Path('tools/zx/inputs/pacing.json')
script = json.loads(path.read_text())
assert digest(Path(script['source']['tape']).read_bytes()) == script['source']['tapeSha256']
names = sys.argv[1:] or [r['name'] for r in script['runs']]
print(json.dumps({
    'schema': 1, 'model': '48K PAL', 'clockHz': 3500000, 'patches': [],
    'scriptSha256': digest(path.read_bytes()),
    'romSha256': ROM_HASH, 'basicSha256': GAME_HASH, 'frameT': FRAME,
    'runs': [PacingCapture({**script['defaults'], **spec}).run()
             for spec in script['runs'] if spec['name'] in names],
}, separators=(',', ':')))
