"""Independent, small checks of the selected 48K clock (no game required)."""

import hashlib
from pathlib import Path

from skoolkit import CCMIOSimulator, ROM48, VERSION
from skoolkit.cmiosimulator import CMIOSimulator

FRAME = 69888
CONFIG = {'frame_duration': FRAME, 'int_active': 32}


def verify_clock():
    assert VERSION == '10.2' and CCMIOSimulator is not None
    results = []
    for cls in (CCMIOSimulator, CMIOSimulator):
        def make(pc, t, code=(0,), **state):
            memory = [0] * 65536
            memory[pc:pc + len(code)] = code
            return cls(memory, {'PC': pc, 'SP': 0xFF00, 'I': 0xFE},
                       {'tstates': t, **state}, CONFIG.copy())

        count = 0
        # Expected values are calculated from Z80 cycles and the declared
        # 6,5,4,3,2,1,0,0 schedule, not read from an emulator delay table.
        for t, dt in [(14334, 4), *zip(range(14335, 14343),
                      (10, 9, 8, 7, 6, 5, 4, 4)),
                      (14559, 10), (57244, 5), (57245, 4)]:
            for pc, elapsed in ((0x4000, dt), (0x8000, 4)):
                s = make(pc, t)
                s.run()
                assert s.registers[25] == t + elapsed, (cls, pc, t)
                count += 1
        for port, dt in ((0x00FF, 11), (0x00FE, 16),
                         (0x40FF, 23), (0x40FE, 17)):
            for opcode in (0xD3, 0xDB):
                s = make(0x8000, 14328, (opcode, port & 255))
                s.registers[0] = port >> 8
                s.run()
                assert s.registers[25] == 14328 + dt, (cls, port)
                count += 1
        for t, iff, im, code, end_t, end_pc, accepted in (
            (69886, 1, 1, (0,), 69903, 0x38, True),
            (27, 1, 1, (0,), 44, 0x38, True),
            (28, 1, 1, (0,), 32, 0x8001, False),
            (0, 0, 1, (0,), 4, 0x8001, False),
            (69884, 0, 1, (0xFB, 0), 69905, 0x38, True),
            (69886, 1, 2, (0,), 69909, 0x9000, True),
        ):
            s = make(0x8000, t, code, iff=iff, im=im)
            s.memory[0xFEFF:0xFF01] = (0, 0x90)
            for i in range(len(code)):
                pc = s.registers[24]
                s.run()
                if s.registers[26] and s.registers[25] % FRAME < 32:
                    s.accept_interrupt(s.registers, s.memory, pc)
                if len(code) == 2 and i == 0:
                    assert (s.registers[25], s.registers[24]) == (69888, 0x8001)
            assert (s.registers[25], s.registers[24]) == (end_t, end_pc)
            assert s.registers[12] == (0xFEFE if accepted else 0xFF00)
            assert s.registers[26] == (0 if accepted else iff)
            if accepted:
                assert list(s.memory[0xFEFE:0xFF00]) == [len(code), 0x80]
            count += 1
        results.append({'core': cls.__name__, 'passed': count})
    rom = Path(ROM48).read_bytes()
    assert hashlib.sha256(rom).hexdigest() == 'd55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
    # Independent short ROM BEEPER case, before display contention. This
    # exercises sound's DI/EI path separately from game-generated evidence.
    for cls in (CCMIOSimulator, CMIOSimulator):
        memory = list(rom) + [0] * 49152
        memory[0xFF00:0xFF02] = (0, 0x80)
        s = cls(memory, {'PC': 0x03B5, 'SP': 0xFF00, 'HL': 10, 'DE': 1},
                {'iff': 0, 'tstates': 0}, CONFIG.copy())
        starts = []
        for _ in range(1000):
            if s.registers[24] == 0x03E1:
                starts.append(s.registers[25])
            s.run()
            if s.registers[24] == 0x8000:
                break
        assert starts == [189, 347, 505, 663]
        assert s.registers[25] == 731
    results.append({'case': 'ROM BEEPER HL=10 DE=1',
                    'outInstructionT': starts, 'returnT': 731})
    return results
