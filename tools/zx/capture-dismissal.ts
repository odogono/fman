import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 10-bills.z80 from observe.ts saved mode; controlled billing states.
const program = String.raw`import ast, hashlib, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source = sys.argv[1]
records=[]
for division, scenario in [(d,s) for d in range(1,5) for s in ['below','equal','above','overdraft','zero','one']]:
    snapshot=Snapshot.get(source)
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest() == '73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6'
    sim=from_snapshot(CSimulator,snapshot)
    m=sim.memory
    def values():
        out={}
        for line in VariableLister().list_variables(m).splitlines():
            name,_,value=line.partition('=')
            try:out[name]=ast.literal_eval(value.split(' (limit=')[0])
            except (ValueError,SyntaxError):pass
        return out
    def keys(pressed):
        tracer=KeyboardTracer(sim,pressed,4,None)
        sim.set_tracer(tracer)
        tracer.run(65536,sim.registers[25]+30*3500000,None,None,'$','02X','04X')
        assert not tracer.keys
    def screen():
        font=m[23606]+256*m[23607]+256
        glyphs={tuple(m[font+(c-32)*8:font+(c-32)*8+8]):('£' if c==96 else '©' if c==127 else chr(c)) for c in range(32,128)}
        rows=[]
        for row in range(24):
            text=''
            for col in range(32):
                pixels=tuple(m[16384+(row//8)*2048+(row%8)*32+y*256+col] for y in range(8))
                text+=glyphs.get(pixels,glyphs.get(tuple(b^255 for b in pixels),'#'))
            rows.append(text.rstrip())
        return rows
    # Redirect only the research driver's next subroutine call, 8100 -> 8000.
    # The billing/dismissal routine itself remains unchanged.
    address=m[23635]+256*m[23636]
    while m[address]*256+m[address+1] != 140:
        address+=4+m[address+2]+256*m[address+3]
    end=address+4+m[address+2]+256*m[address+3]
    payload=bytes(m[address+4:end])
    number=address+4+payload.index(b'8100\x0e')
    m[number+1]=ord('0')
    m[number+5:number+10]=[0,0,64,31,0]
    class Offsets(VariableLister):
        def __init__(self):
            super().__init__()
            self.scalars = {}
            self.arrays = {}
        def _get_short_num_var(self, name, i):
            self.scalars[name] = i + 1
            return super()._get_short_num_var(name, i)
        def _get_long_num_var(self, name, i):
            end, line = super()._get_long_num_var(name, i)
            self.scalars[line.partition('=')[0]] = end - 5
            return end, line
        def _get_num_array_var(self, name, i):
            self.arrays[name] = i + 4 + 2 * m[i + 3]
            return super()._get_num_array_var(name, i)
    offsets = Offsets()
    offsets.list_variables(m)
    def put_integer(address,value):
        assert 0 <= value < 65536
        m[address:address+5] = [0,0,value & 255,value >> 8,0]

    def put(address,n):
        if n == 0:data=[0,0,0,0,0]
        else:
            bits=n.bit_length()
            fraction=(n-(1 << (bits-1))) << (32-bits)
            data=[128+bits,(fraction>>24)&127,(fraction>>16)&255,(fraction>>8)&255,fraction&255]
        m[address:address+5]=data
    initial=values()
    factor=5-division
    cap=250000*factor
    debt=cap + (-1 if scenario=='below' else 1 if scenario=='above' else 0)
    wages=sum(s*100*factor for s,p in zip(initial['r(24)'],initial['p(24)']) if p>0)
    rent=500*factor
    interest=debt//100
    bills=wages+rent+interest
    cash=bills+(-1 if scenario=='overdraft' else 0 if scenario=='zero' else 1 if scenario=='one' else 100)
    for name,n in [('d1',division),('d2',factor),('x',rent),('l',debt),('m',cash),('xp',50000)]:put(offsets.scalars[name],n)
    m[23670]=219;m[23671]=0
    keys(['ENTER'])
    after=values()
    assert m[23621]+256*m[23622]==1030, (m[23621]+256*m[23622],screen())
    report=screen()
    after_seed=m[23670]+256*m[23671]
    before_frames=sum(m[23672+i] << (8*i) for i in range(3))
    keys(['ENTER'])
    cleared=values()
    prog=m[23635]+256*m[23636]
    variables=m[23627]+256*m[23628]
    records.append({'division':division,'scenario':scenario,'cash':cash,'debt':debt,'initialStatuses':initial['p(24)'],'skills':initial['r(24)'],
      'completed':{key:after[key] for key in ['m','l','w','i','xp']},'seed':after_seed,'dismissalScreen':report,
      'programCleared':prog==variables,'variablesCleared':not cleared,'afterAcknowledgeScreen':screen(),
      'framesBeforeAcknowledge':before_frames,'framesAfterAcknowledge':sum(m[23672+i] << (8*i) for i in range(3)),
      'seedAfterAcknowledge':m[23670]+256*m[23671]})
    print(division,scenario,prog==variables,file=sys.stderr)
print(json.dumps(records,indent=2))
`;
const [input, output = 'build/zx/dismissal.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-dismissal.ts <10-bills.z80> [output.json]'
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
  throw new Error('Original dismissal capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote dismissal observations to ${output}`);
