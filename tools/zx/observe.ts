import { mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

// Optional research adapter: Bun drives SkoolKit's Z80 CPU/ROM emulator via uv.
// This is deliberately separate from the web application and its dependencies.
const program = String.raw`from pathlib import Path
import hashlib,json,sys
from skoolkit import CSimulator,ROM48
from skoolkit.simutils import from_snapshot,get_state
from skoolkit.snapshot import Snapshot,write_snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import BasicLister,VariableLister

SOURCE=sys.argv[1]
OUT=Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
MODE=sys.argv[3]
reference=Snapshot.get(SOURCE)
reference_ram=bytes(reference.ram())
if MODE == 'saved':
 assert hashlib.sha256(Path(SOURCE).read_bytes()).hexdigest() == 'e774842966587779cbdabc94b234f0c80c681c09585b10f3dcebdeeb30395976', 'Unexpected reference snapshot'
 assert reference_ram == (OUT/'ram.bin').read_bytes(), 'RAM differs from independent decoder'
 reference_lines=BasicLister().list_basic([0]*16384+list(reference_ram)).splitlines()
 lines=json.loads((OUT/'basic.json').read_text())
 assert [int(line.split()[0]) for line in reference_lines] == [line['number'] for line in lines]
 print('Independent RAM and BASIC line-number comparisons passed',flush=True)
else:
 assert hashlib.sha256(reference_ram[7371:40513]).hexdigest() == '5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6', 'Unexpected BASIC program'
sim=from_snapshot(CSimulator,reference)
print('ROM SHA256',hashlib.sha256(Path(ROM48).read_bytes()).hexdigest(),flush=True)

def screen():
 m=sim.memory
 font=m[23606]+256*m[23607]+256
 glyphs={tuple(m[font+(c-32)*8:font+(c-32)*8+8]):('£' if c==96 else chr(c)) for c in range(32,128)}
 rows=[]
 for row in range(24):
  text=''
  for col in range(32):
   pixels=tuple(m[16384+(row//8)*2048+(row%8)*32+y*256+col] for y in range(8))
   ch=glyphs.get(pixels,glyphs.get(tuple(x^255 for x in pixels),'#'))
   text+=ch
  rows.append(text.rstrip())
 return '\n'.join(rows)

def step(name,expected_line,keys=(),seconds=30):
 tracer=KeyboardTracer(sim,list(keys),4,None)
 sim.set_tracer(tracer)
 tracer.run(65536,sim.registers[25]+seconds*3500000,None,None,'$', '02X','04X')
 m=sim.memory
 assert not tracer.keys, f'Unconsumed keys at {name}'
 ppc=m[23621]+256*m[23622]
 assert ppc == expected_line, f'Unexpected BASIC line at {name}: {ppc}'
 print('\n###',name,'PC',sim.registers[24],'BASIC',ppc,'remaining keys',len(tracer.keys),flush=True)
 text=screen()
 print(text,flush=True)
 (OUT/(name+'.txt')).write_text(text+'\n')
 (OUT/(name+'-variables.txt')).write_text(VariableLister().list_variables(m)+'\n')
 ram,regs,state,machine=get_state(sim)
 write_snapshot(str(OUT/(name+'.z80')),ram,regs,state,machine)

if MODE == 'saved':
 step('00-menu',2180)
 step('01-score',1030,['s','ENTER'])
 step('02-menu',2180,['ENTER'])
 step('03-squad',1170,['a','ENTER'])
 step('04-menu',2180,['9','9','ENTER'])
 step('05-fixture',1030,['9','9','ENTER'])
 step('06-team',6135,['ENTER'])
 step('07-highlights',1030,['9','9','ENTER'],600)
 step('08-other-matches',1030,['ENTER'],60)
 step('09-table',1030,['ENTER'],60)
 step('10-bills',1030,['ENTER'],30)
 step('11-transfer',1170,['ENTER'],30)
 step('12-menu',2180,['9','9','ENTER'],30)
else:
 step('20-name',9)
 step('21-club',1170,['a','l','e','x','ENTER'])
 step('22-level',1170,['1','ENTER'])
 step('23-colours',1170,['1','ENTER'])
 step('24-fresh-menu',2180,['0','ENTER'])
 step('25-fresh-score',1030,['s','ENTER'])

`;

const [input, destination = 'roms/zx/analysis', mode = 'saved'] =
  Bun.argv.slice(2);
if (mode !== 'saved' && mode !== 'fresh') {
  throw new Error('Observation mode must be saved or fresh');
}
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/observe.ts <snapshot.z80> [roms/output-dir] [saved|fresh]'
  );
}
const output = resolve(destination);
if (!output.startsWith(resolve('roms') + sep)) {
  throw new Error('Emulator evidence must remain under gitignored roms/');
}
await mkdir(output, { recursive: true });
const child = Bun.spawn(
  [
    'uv',
    'run',
    '--with',
    'skoolkit==10.2',
    'python',
    '-c',
    program,
    resolve(input),
    output,
    mode
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const log = await new Response(child.stdout).text();
await Bun.write(
  resolve(
    output,
    mode === 'fresh' ? 'fresh-observations.log' : 'observations.log'
  ),
  log
);
console.log(log);
process.exit(await child.exited);
