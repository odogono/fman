"""Optional research adapter. Never imported by the web app.

Only observations leave this process; original RAM/code remain in roms/.
See docs/spectrum-timing.md for the versioned trace and sampling contract.
"""

import ast
import base64
import hashlib
import json
import sys
import zlib
from pathlib import Path

from skoolkit import CCMIOSimulator
from skoolkit.basic import VariableLister
from skoolkit.kbtracer import KEYS
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot

from timing_clock import CONFIG, FRAME, verify_clock

ROM_HASH = 'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
GAME_HASH = '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
PIXELS = {}


def digest(data):
    return hashlib.sha256(bytes(data)).hexdigest()


def read_keyboard(pressed, port):
    value = 255
    if port & 1 == 0:
        for key in pressed:
            row, mask = KEYS[key]
            if (~(port >> 8) & 255) & (~(row >> 8) & 255):
                value &= mask
    return value


def verify_keyboard():
    # Active-low row selection, including chords and multi-row reads.
    for pressed, port, expected in (
        ([], 0x00FE, 255), (['a'], 0xFDFE, 254),
        (['a'], 0xFEFE, 255), (['a'], 0xFDFF, 255),
        (['SS', 'SPACE'], 0x7FFE, 252),
        (['CS', 'a', 'SPACE'], 0x00FE, 254),
        (['CS', 's'], 0xFCFE, 252),
    ):
        assert read_keyboard(pressed, port) == expected
    return 7


class Capture:
    def __init__(self, spec):
        self.spec = spec
        source = Path(spec['snapshot'])
        assert digest(source.read_bytes()) == spec['snapshotSha256'], 'Unexpected snapshot'
        snapshot = Snapshot.get(str(source))
        assert len(snapshot.ram()) == 49152, 'Only PAL 48K snapshots are supported'
        self.sim = from_snapshot(CCMIOSimulator, snapshot, config=CONFIG.copy())
        self.m = self.sim.memory
        self.r = self.sim.registers
        assert digest(self.m[:16384]) == ROM_HASH, 'Unexpected ROM'
        assert digest(self.m[23755:56897]) == GAME_HASH, 'Unexpected BASIC program'
        self.sim.set_tracer(self)
        self.origin = self.r[25]
        self.outfe = spec['outfe']
        assert self.outfe & 7 == snapshot.border, 'Border differs from snapshot'
        self.border = self.outfe & 7
        self.pressed = set()
        self.pending = []
        self.events = []
        self.frames = []
        self.images = {}
        self.image_hashes = []
        self.last_screen = None
        self.last_image = None
        self.last_frame = self.origin // FRAME
        self.steps = iter(spec['steps'])
        self.step = next(self.steps, None)
        self.step_ready = self.origin
        self.pause = None
        self.beep = None
        self.last_line = None
        self.result = {
            'name': spec['name'], 'snapshotSha256': spec['snapshotSha256'],
            'entry': spec['entry'],
            'initialRamSha256': digest(self.m[16384:]),
            'initialRegisters': list(self.r), 'originT': self.origin,
            'outfe': self.outfe, 'flashPhase': spec['flashPhase'],
            'patches': [], 'events': self.events, 'video': self.frames,
            'imageHashes': self.image_hashes,
        }

    def word(self, address):
        return self.m[address] + 256 * self.m[address + 1]

    def state(self):
        return {
            'line': self.word(23621), 'statement': self.m[23623],
            'seed': self.word(23670),
            'romFrames': self.word(23672) + 65536 * self.m[23674],
            'lastK': self.m[23560], 'flags': self.m[23611],
            'kstate': list(self.m[23552:23560]),
            'repdel': self.m[23561], 'repper': self.m[23562],
        }

    def emit(self, kind, **fields):
        event = {'kind': kind, 't': self.r[25], **fields}
        self.events.append(event)
        return event

    def values(self):
        out = {}
        for text in VariableLister().list_variables(self.m).splitlines():
            name, _, value = text.partition('=')
            if name not in self.spec.get('variables', []):
                continue
            try:
                out[name] = ast.literal_eval(value.split(' (limit=')[0])
            except (ValueError, SyntaxError):
                raise RuntimeError('Cannot decode checkpoint variable ' + name)
        return out

    def read_port(self, registers, port):
        return read_keyboard(self.pressed, port)

    def write_port(self, registers, port, value, offset):
        if port & 1 == 0:
            if (value ^ self.outfe) & 16:
                edge = [registers[25], registers[25] + offset - 1,
                        port, (value >> 4) & 1]
                if self.beep is not None:
                    self.beep['edges'].append(edge)
                else:
                    self.emit('ear', edge=edge)
            self.outfe = value
            self.border = value & 7

    def schedule(self, step):
        at = max(self.r[25], self.step_ready) + step.get('afterFrames', 0) * FRAME
        if 'sequence' in step:
            for transition in step['sequence']:
                self.pending.append((at, transition['down']))
                at += transition['frames'] * FRAME
        elif 'text' in step:
            keys = list(step['text']) + ['ENTER']
            for key in keys:
                self.pending.append((at, [key]))
                at += step.get('holdFrames', 4) * FRAME
                self.pending.append((at, []))
                at += step.get('gapFrames', 6) * FRAME
        elif 'down' in step:
            self.pending.append((at, step['down']))
            if 'holdFrames' in step:
                at += step['holdFrames'] * FRAME
                self.pending.append((at, []))
        elif step.get('stop'):
            self.pending.append((at, None))
        for _, keys in self.pending:
            assert keys is None or all(key in KEYS for key in keys), 'Unknown key'
        self.step_ready = at
        self.step = next(self.steps, None)

    def before(self, pc):
        t = self.r[25]
        while self.pending and self.pending[0][0] <= t:
            requested, keys = self.pending.pop(0)
            if keys is None:
                raise StopIteration
            self.pressed = set(keys)
            self.emit('keyboard', requestedT=requested, down=keys)

        line = self.word(23621)
        event = None
        if pc == 6952:
            if line != self.last_line:
                event = 'line'
                self.last_line = line
                if line in self.spec.get('checkpoints', []):
                    self.emit('checkpoint', **self.state(), values=self.values())
        elif pc == 7997 and self.pause is None:
            event = 'pause'
            self.pause = self.emit('pause-enter', count=self.r[3] + 256 * self.r[2],
                                   **self.state())
        elif pc == 8015 and self.pause is not None:
            event = 'pause-exit'
            self.emit('pause-exit', enteredT=self.pause['t'], **self.state())
            self.pause = None
        elif pc == 949 and self.beep is None:
            self.beep = self.emit('beep-enter', hl=self.r[7] + 256 * self.r[6],
                                  de=self.r[5] + 256 * self.r[4],
                                  returnPc=self.word(self.r[12]), edges=[], **self.state())
        elif self.beep is not None and pc == self.beep['returnPc']:
            self.emit('beep-exit', enteredT=self.beep['t'], **self.state())
            self.beep = None
        if self.step:
            anchor = self.step['when']
            if event == anchor['event'] and line == anchor['line']:
                self.emit('anchor', step=self.step.get('name', ''), line=line)
                self.schedule(self.step)
        return None

    def after(self, pc, instruction, started):
        t = self.r[25]
        if pc == 0x03F7 and self.beep is not None:
            # trace() calls this before accepting an interrupt after RET.
            # Caller resumption (beep-exit) can include an intervening ISR.
            self.beep['returnedT'] = t
        frame = t // FRAME
        if frame > self.last_frame:
            assert frame == self.last_frame + 1, 'Missed video frame'
            screen = bytes(self.m[16384:23296])
            flash = ((frame + self.spec['flashPhase']) // 16) % 2
            if not any(attr & 128 for attr in screen[6144:]):
                flash = 0
            key = (screen, flash)
            if key != self.last_screen and key not in self.images:
                rgba = bytearray()
                for y in range(192):
                    offset = (y // 64) * 2048 + (y % 8) * 256 + ((y % 64) // 8) * 32
                    for x in range(32):
                        attr = screen[6144 + (y // 8) * 32 + x]
                        ink, paper = attr & 7, (attr >> 3) & 7
                        if attr & 128 and flash:
                            ink, paper = paper, ink
                        intensity = 255 if attr & 64 else 215
                        for bit in range(7, -1, -1):
                            colour = ink if screen[offset + x] & (1 << bit) else paper
                            rgba.extend((intensity if colour & 2 else 0,
                                         intensity if colour & 4 else 0,
                                         intensity if colour & 1 else 0, 255))
                image_hash = digest(rgba)
                if image_hash not in PIXELS:
                    PIXELS[image_hash] = base64.b64encode(zlib.compress(rgba, 9)).decode()
                if image_hash not in self.image_hashes:
                    self.image_hashes.append(image_hash)
                self.images[key] = self.image_hashes.index(image_hash)
            self.last_image = self.images[key]
            self.last_screen = key
            self.frames.append([frame, t, self.last_image, self.border])
            self.last_frame = frame

    def run(self):
        # Both callbacks are needed: before() sees live entry registers and
        # applies input before IN; after() samples post-instruction video.
        try:
            self.sim.trace(self.r[24], -1, 0,
                           self.origin + self.spec['maxFrames'] * FRAME,
                           True, None, None, None, self.before, self.after)
        except StopIteration:
            pass
        else:
            print('Recent events:', self.events[-12:], file=sys.stderr)
            raise RuntimeError('Capture timed out: ' + self.spec['name'] +
                               ' at line ' + str(self.word(23621)) +
                               ', pending ' + str(self.step))
        assert self.step is None and not self.pending, 'Unfinished input script'
        # The ROM writes DEF FN parameter workspaces inside BASIC itself.
        # No capture hook writes RAM; retain that natural final hash too.
        self.result['finalBasicSha256'] = digest(self.m[23755:56897])
        self.result['endT'] = self.r[25]
        self.result['final'] = {**self.state(), 'values': self.values()}
        self.result['sampling'] = {
            'maxVideoLatenessT': max((t - frame * FRAME for frame, t, _, _ in self.frames), default=0),
            'maxInputLatenessT': max((e['t'] - e['requestedT'] for e in self.events if e['kind'] == 'keyboard'), default=0),
        }
        print(self.spec['name'], self.r[25] - self.origin, file=sys.stderr)
        return self.result


def main():
    verification = verify_clock()
    assert verify_keyboard() == 7
    if sys.argv[1] == '--verify-clock':
        return {'schema': 1, 'clockVerification': verification}
    path = Path(sys.argv[1])
    script = json.loads(path.read_text())
    assert script['schema'] == 1
    assert digest(Path(script['source']['tape']).read_bytes()) == script['source']['tapeSha256'], 'Unexpected tape'
    return {
        'schema': 1, 'model': 'SkoolKit 10.2 CCMIOSimulator PAL 48K',
        'romSha256': ROM_HASH, 'basicSha256': GAME_HASH,
        'scriptSha256': digest(path.read_bytes()),
        'source': script['source'],
        'clockHz': 3500000, 'frameT': FRAME, 'intActiveT': 32,
        'clockVerification': verification,
        'runs': [Capture({**script['defaults'], **spec}).run() for spec in script['runs']],
        'pixels': PIXELS,
    }


if __name__ == '__main__':
    print(json.dumps(main(), separators=(',', ':')))
