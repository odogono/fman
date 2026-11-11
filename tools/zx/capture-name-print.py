"""Observe game name validation/storage and ROM PRINT; never export originals."""
import ast
import base64
import hashlib
import json
import sys
import zlib
from pathlib import Path

from skoolkit import CSimulator
from skoolkit.basic import VariableLister
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.trace import Tracer

SOURCE = sys.argv[1]


def reset(source=SOURCE):
    global sim, m
    snapshot = Snapshot.get(source)
    expected = ('5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
                if source == SOURCE else
                '73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6')
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == expected
    sim = from_snapshot(CSimulator, snapshot)
    m = sim.memory
    assert hashlib.sha256(bytes(m[:16384])).hexdigest() == 'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'


def keys(pressed, seconds=10):
    tracer = KeyboardTracer(sim, pressed, 4, None)
    sim.set_tracer(tracer)
    tracer.run(65536, sim.registers[25] + seconds * 3500000, None, None, '$', '02X', '04X')
    assert not tracer.keys


def enter(text):
    codes = list(text.encode('ascii')) if isinstance(text, str) else text
    if codes:
        keys(['Z'] * len(codes))
        cursor = m[23643] + 256 * m[23644]
        assert list(m[cursor-len(codes):cursor]) == [90] * len(codes)
        m[cursor-len(codes):cursor] = codes
    keys(['ENTER'])


class Offsets(VariableLister):
    def __init__(self):
        super().__init__()
        self.scalars = {}
        self.arrays = {}
        self.chars = {}

    def _get_short_num_var(self, name, i):
        self.scalars[name] = i + 1
        return super()._get_short_num_var(name, i)

    def _get_long_num_var(self, name, i):
        end, line = super()._get_long_num_var(name, i)
        self.scalars[line.partition('=')[0]] = end - 5
        return end, line

    def _get_num_array_var(self, name, i):
        self.arrays[name] = i + 4 + 2 * m[i+3]
        return super()._get_num_array_var(name, i)

    def _get_char_array_var(self, name, i):
        self.chars[name] = i + 4 + 2 * m[i+3]
        return super()._get_char_array_var(name, i)


def offsets():
    result = Offsets()
    result.list_variables(m)
    return result


def packed(data):
    return base64.b64encode(zlib.compress(bytes(data))).decode()


def screen():
    # Full native bitmap and all 768 attributes, not text recognition.
    return {'bitmap': packed(m[16384:22528]), 'attributes': packed(m[22528:23296]),
            'line': m[23621] + 256 * m[23622], 'statement': m[23623],
            'upperPos': list(m[23688:23690]), 'lowerRows': m[23659]}


def capture_streams():
    def run(data):
        code = [62, 2, 205, 1, 22]
        for byte in data:
            code += [62, byte, 215]
        m[49152:49152+len(code)] = code
        sim.registers[12] = 65000
        sim.registers[26] = 0
        sim.set_tracer(Tracer(sim, 7, 0, 0, [0]*16, 0, False))
        result, operations = sim.trace(49152, 49152+len(code), 2000000, 0, False,
                                       None, None, None, None, None)
        assert result == 3, (result, operations)
    reset()
    m[23611] = 0; m[23612] &= ~2
    m[23693:23698] = [56, 0, 56, 0, 0]
    initial = [18, 0, 19, 0, 20, 0, 21, 0]
    for i in range(704):
        initial += [22, i//32, i%32, 65+i%26]
    run(initial)
    def restore():
        for i in range(704):
            m[22528+i] = i%8 + 8*((i//8)%8) + 64*((i//32)%2) + 128*((i//64)%2)
    variants = [(i, p, 0, 0, 0, 0) for i in [0, 7, 8, 9] for p in [0, 7, 8, 9]]
    variants += [(8, 8, b, f, inverse, over) for b in [0, 1, 8] for f in [0, 1, 8]
                 for inverse, over in [(0, 0), (1, 0), (1, 1)]]
    result = []
    baseline = list(m[16384:22528])
    for ink, paper, bright, flash, inverse, over in variants:
        m[16384:22528] = baseline; restore()
        data = [22, 0, 0, 16, ink, 17, paper, 19, bright, 18, flash, 20, inverse, 21, over]
        data += list(b'ABCDEFGHIJKLMNOPQRSTUVWXYZ') * 3
        run(data)
        result.append({'input': data, **screen()})
    m[16384:22528] = baseline; restore()
    run([22, 0, 0, 16, 2, 20, 1, 9])
    result.append({'input': [22, 0, 0, 16, 2, 20, 1, 9], **screen()})
    return result


def capture_keyboard():
    profiles = []
    for key in '0123456789':
        profiles += [('paper-'+key, ['CS+SS', key]),
                     ('ink-'+key, ['CS+SS', 'CS+'+key])]
    for key in '34':
        profiles += [('inverse-'+key, ['CS+'+key])]
    for key in '12345678abcdefghijklmnopqrstu':
        profiles += [('graphics-'+key, ['CS+9', key, 'CS+9'])]
    for key in '12345678':
        profiles += [('graphics-inverse-'+key, ['CS+9', 'CS+'+key, 'CS+9'])]
    for key in 'abcdefghijklmnopqrstuvwxyz0123456789':
        profiles += [('extended-'+key, ['CS+SS', key]),
                     ('extended-symbol-'+key, ['CS+SS', 'SS+'+key])]
    records = []
    for label, sequence in profiles:
        reset(); enter('change'); enter('n'); enter('y'); enter('1')
        start = m[23643]+256*m[23644]
        keys(['A']+sequence)
        end = m[23643]+256*m[23644]
        data = list(m[start:end])
        keys(['ENTER'])
        address = offsets().chars['p']
        records.append({'label': label, 'keys': ['A']+sequence, 'input': data,
                        'stored': list(m[address:address+8]), **screen()})
    return records


def capture_continuations():
    records = []
    for kind, control, command in [('player', 22, 'a'), ('player', 23, 'a'),
                                    ('club', 22, 's'), ('club', 23, 's'),
                                    ('club', 22, '99'), ('club', 23, '99')]:
        reset(); enter('change')
        if kind == 'player': enter('n')
        enter('y')
        if kind == 'club':
            for _ in range(3): enter('99')
        enter('64' if kind == 'club' else '1')
        data = ([16, 2]+list(b'ABCDEFGHI') if kind == 'club' else list(b'ABCDEFG'))+[control]
        enter(data); enter('n')
        if kind == 'club': enter('n')
        m[23670:23672] = [219, 0]
        enter(command)
        address = offsets().chars['t' if kind == 'club' else 'p']+(63*12 if kind == 'club' else 0)
        records.append({'kind': kind, 'input': data, 'command': command,
                        'stored': list(m[address:address+(12 if kind == 'club' else 8)]),
                        'seed': m[23670]+256*m[23671], **screen()})
    return records


def capture_relists():
    records = []
    for kind in ['club', 'player']:
        reset(); enter('change')
        if kind == 'player': enter('n')
        enter('y'); enter('1')
        data = ([16, 2]+list(b'ABCDEFGHI') if kind == 'club' else list(b'ABCDEFG'))+[22]
        enter(data); enter('y')
        records.append({'kind': kind, 'input': data, **screen()})
    return records


profiles = [('byte-'+str(c), [65, c, 66]) for c in range(256)]
for control, values in [(16, range(11)), (17, range(11)), (18, [0, 1, 2, 8, 9, 255]),
                        (19, [0, 1, 2, 8, 9, 255]), (20, [0, 1, 2, 8, 255]),
                        (21, [0, 1, 2, 8, 255])]:
    profiles += [(f'control-{control}-{v}', [65, control, v, 66]) for v in values]
profiles += [('at-'+str(r)+'-'+str(c), [65, 22, r, c, 66])
             for r, c in [(0, 0), (0, 31), (21, 31), (22, 0), (23, 12), (255, 255), (1, 32)]]
profiles += [('tab-'+str(lo)+'-'+str(hi), [65, 23, lo, hi, 66])
             for lo, hi in [(0, 0), (31, 0), (32, 0), (255, 255), (0, 1)]]
profiles += [('truncated-'+str(c), list(b'ABCDEFG') + [c]) for c in range(16, 24)]
profiles += [('club-truncated-'+str(c), [16, 2] + list(b'ABCDEFGHI') + [c]) for c in range(16, 24)]
profiles += [('club-at-row-zero', [16, 2] + list(b'ABCDEFGH') + [22, 0])]
profiles += [('over', [65, 8, 21, 1, 66]), ('combined', [65, 19, 1, 20, 1, 128, 143, 66]),
             ('club-combined', [16, 4, 65, 17, 2, 19, 1, 20, 1, 143, 66]),
             ('prefix', [16]), ('prefix-colour', [16, 2]), ('prefix-invalid', [16, 5]),
             ('priority', [49, 16, 255] + list(b'ABCDEFGH'))]
edits = []
for label, codes in profiles:
    kind = 'club' if label.startswith(('club-', 'prefix', 'priority')) else 'player'
    reset()
    enter('change')
    if kind == 'player':
        enter('n')
    enter('y')
    enter('1')
    enter(codes)
    address = offsets().chars['t' if kind == 'club' else 'p']
    edits.append({'label': label, 'kind': kind, 'input': codes,
                  'stored': list(m[address:address+(12 if kind == 'club' else 8)]),
                  **screen()})
    print(label, edits[-1]['line'], file=sys.stderr)


def values():
    result = {}
    for line in VariableLister().list_variables(m).splitlines():
        name, _, value = line.partition('=')
        try:
            result[name] = ast.literal_eval(value.split(' (limit=')[0])
        except (ValueError, SyntaxError):
            pass
    return {k: v for k, v in result.items() if k in [
        'm', 'l', 'ml', 'a(5)', 'p(24)', 'r(24)', 'y(24)', 'v(24)',
        'b(16)', 'c(16)', 'z(17)', 't(16)', 's(2)', 'x9', 'r1', 'o']}


def scene():
    return {**screen(), 'values': values()}


def retained_state():
    extra = VariableLister().list_variables(m).splitlines()
    return {
        'finance': {k: ast.literal_eval(v) for line in extra
                    for k, _, v in [line.partition('=')]
                    if k in ['g', 'xp', 'd1', 't1', 'c', 's', 's5', 'ma', 'h', 'fa', 'h1']},
        'seed': m[23670] + 256*m[23671],
        'clubs': list(m[offsets().chars['t']:offsets().chars['t']+768])
    }


def capture_result_faults():
    records = []
    for club_id in [50, 57, 63]:
        reset(); enter('change'); enter('y')
        for _ in range(3): enter('99')
        enter(str(club_id))
        data = [16, 2] + list(b'ABCDEFGHI') + [22]
        enter(data); enter('n'); enter('n')
        m[23670:23672] = [219, 0]
        enter('99'); enter(''); keys([])
        enter('99'); keys([], 600)
        before = scene()
        m[23670:23672] = [219, 0]
        enter('')
        retained = scene()
        retained.update(retained_state())
        records.append({'clubId': club_id, 'input': data, 'before': before, 'retained': retained})
        print('result fault', club_id, retained['line'], file=sys.stderr)
    return records


def capture_season_faults():
    records = []
    for division, club_id in [(2, 17), (2, 18), (2, 30), (2, 32), (1, 1)]:
        reset(sys.argv[2]); off = offsets()
        def integer(address, value):
            m[address:address+5] = [0, 0, value & 255, value >> 8, 0]
        for name, value in [('d1', division), ('lt', (division-1)*16),
                            ('t1', (division-1)*16+8), ('d2', 5-division),
                            ('ml', 15), ('fa', 1), ('c', 8), ('s', 48), ('s5', 3)]:
            integer(off.scalars[name], value)
        for i in range(16): integer(off.arrays['t']+i*5, i+1)
        m[off.chars['u']:off.chars['u']+16] = list(range(1, 17))
        data = [16, 2] + list(b'ABCDEFGH') + [22, 0]
        address = off.chars['t'] + (club_id-1)*12
        m[address:address+12] = data
        keys(['ENTER'], 60); keys(['ENTER'], 60)
        before = {**scene(), **retained_state()}
        keys(['ENTER'], 60)
        retained = {**scene(), **retained_state()}
        records.append({'clubId': club_id, 'input': data, 'before': before, 'retained': retained})
        print('season fault', club_id, retained['line'], file=sys.stderr)
    return records


scenes = []
scene_profiles = [
    ('attributes', [16, 4, 65, 17, 2, 19, 1, 20, 1, 143, 66], [65, 19, 1, 20, 1, 128, 143, 66]),
    ('transparent', [65, 16, 8, 17, 8, 19, 8, 18, 8, 66], [65, 16, 8, 17, 8, 66]),
    ('contrast', [65, 16, 9, 17, 9, 66], [65, 16, 9, 17, 9, 66]),
    ('flash', [65, 18, 1, 66], [65, 18, 1, 66]),
    ('over', [65, 8, 21, 1, 66], [65, 8, 21, 1, 66]),
    ('graphics', [65, 128, 143, 144, 158, 159, 164, 66], [65, 128, 143, 144, 158, 159, 164, 66]),
    ('tab', [65, 23, 10, 0, 66], [65, 23, 5, 0, 66]),
    ('at', [65, 22, 0, 31, 66], [65, 22, 0, 31, 66]),
    ('tokens', [65, 167, 66], [65, 167, 66, 9, 9, 9, 9, 9]),
    ('boundary', list(b'ABCDEFGHIJ'), list(b'ABCDEFGH')),
]
for label, club_input, player_input in scene_profiles:
    reset()
    off = offsets()
    club = club_input + [32] * (12 - len(club_input))
    player = player_input + [32] * (8 - len(player_input))
    for id in [49, 50, 57, 64]:
        address = off.chars['t'] + (id-1)*12
        m[address:address+12] = club
    for id in [1, 13, 23]:
        address = off.chars['p'] + (id-1)*8
        m[address:address+8] = player
    # Sale has its own deterministic branch, before changing match state.
    enter('a'); m[23670:23672] = [219, 0]; enter('1'); sale = scene()
    # Return to the exact menu checkpoint/catalogue for the match branch.
    reset(); off = offsets()
    for id in [49, 50, 57, 64]:
        address = off.chars['t'] + (id-1)*12; m[address:address+12] = club
    for id in [1, 13, 23]:
        address = off.chars['p'] + (id-1)*8; m[address:address+8] = player
    enter('s'); status = scene(); enter('')
    enter('a'); squad = scene(); enter('99')
    m[23670:23672] = [219, 0]
    enter('99'); fixture = scene()
    enter(''); keys([]); team = scene()
    enter('99'); keys([], 600); result = scene()
    m[23670:23672] = [219, 0]
    enter(''); other = scene()
    enter(''); keys([], 60); table = scene()
    enter(''); keys([], 30); enter(''); keys([], 30); transfer = scene()
    scenes.append({'label': label, 'club': club_input, 'player': player_input,
                   'sale': sale, 'status': status, 'squad': squad, 'fixture': fixture,
                   'team': team, 'result': result, 'other': other,
                   'table': table, 'transfer': transfer})
    print('scenes', label, file=sys.stderr)

seasons = []
for label, club_input, _ in scene_profiles:
    reset(sys.argv[2])
    off = offsets()
    def integer(address, value):
        m[address:address+5] = [0, 0, value & 255, value >> 8, 0]
    for name, value in [('d1', 2), ('lt', 16), ('t1', 24), ('d2', 3),
                        ('ml', 15), ('fa', 1), ('c', 8), ('s', 48), ('s5', 3)]:
        integer(off.scalars[name], value)
    for i in range(16):
        integer(off.arrays['t']+i*5, i+1)
    m[off.chars['u']:off.chars['u']+16] = list(range(1, 17))
    club = club_input + [32] * (12-len(club_input))
    m[off.chars['t']:off.chars['t']+768] = club * 64
    keys(['ENTER'], 60); keys(['ENTER'], 60); keys(['ENTER'], 60)
    seasons.append({'label': label, 'club': club_input, 'summary': screen()})
    print('season', label, file=sys.stderr)

output = Path(sys.argv[3] if len(sys.argv) > 3 else 'build/zx/name-print.json')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'edits': edits, 'scenes': scenes, 'seasons': seasons, 'streams': capture_streams(), 'keyboard': capture_keyboard(), 'continuations': capture_continuations(), 'resultFaults': capture_result_faults(), 'seasonFaults': capture_season_faults(), 'relists': capture_relists()}, indent=2) + '\n')
print(f'Wrote {output}')
