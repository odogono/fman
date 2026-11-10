import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Input: 24-fresh-menu.z80; inject name bytes into the original line editor.
const program = String.raw`import ast, hashlib, json, sys
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

profiles=[('club',list(s.encode('ascii'))) for s in ['', 'Town', 'ABCDEFGHIJ', 'ABCDEFGHIJK', '1Town', '[Town', chr(92)+'Town', ']Town', '^Town', '_Town', chr(96)+'Town', 'A Town 2!', ' Town', 'hTown']]
profiles += [('club',[16,c]+list(s.encode('ascii'))) for c,s in [(0,'Town'),(2,'Town'),(4,'ABCDEFGHIJ'),(2,'ABCDEFGHIJK'),(5,'Town')]]
profiles += [('club',[16]),('club',[16,2]),('club',[16,5])]
profiles += [('player',list(s.encode('ascii'))) for s in ['', 'R.New', 'ABCDEFGH','ABCDEFGHI','1Name','[Name','_Name',chr(96)+'Name','A123!?.']]
records=[]
for kind,codes in profiles:
    snap=Snapshot.get(sys.argv[1])
    assert hashlib.sha256(bytes(snap.ram())[7371:40513]).hexdigest()=='5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
    sim=from_snapshot(CSimulator,snap);m=sim.memory
    def keys(pressed):
        t=KeyboardTracer(sim,pressed,4,None);sim.set_tracer(t)
        t.run(65536,sim.registers[25]+10*3500000,None,None,'$','02X','04X')
        assert not t.keys
    def values():
        out={}
        for line in VariableLister().list_variables(m).splitlines():
            name,_,value=line.partition('=')
            try:out[name]=ast.literal_eval(value.split(' (limit=')[0])
            except (ValueError,SyntaxError):pass
        return out
    class ArrayAddresses(VariableLister):
        def __init__(self):super().__init__();self.arrays={}
        def _get_char_array_var(self,name,i):
            self.arrays[name]=i+4+2*m[i+3]
            return super()._get_char_array_var(name,i)
    def stored():
        offsets=ArrayAddresses();offsets.list_variables(m)
        start=offsets.arrays['t' if kind=='club' else 'p']
        return list(m[start:start+(12 if kind=='club' else 8)])
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
    m[23670]=219;m[23671]=0
    keys(['c','h','a','n','g','e','ENTER'])
    keys(['y','ENTER'] if kind=='club' else ['n','ENTER'])
    if kind=='player':keys(['y','ENTER'])
    keys(['1','ENTER'])
    initial=stored()
    if codes:
        keys(['Z']*len(codes))
        cursor=m[23643]+256*m[23644]
        start=cursor-len(codes)
        assert list(m[start:cursor])==[ord('Z')]*len(codes), (start,cursor,list(m[start:cursor]))
        m[start:cursor]=codes
    keys(['ENTER'])
    records.append({'kind':kind,'input':codes,'initial':initial,'stored':stored(),'line':m[23621]+256*m[23622],'seed':m[23670]+256*m[23671],'screen':screen()})
    print(kind,codes,records[-1]['line'],file=sys.stderr)
pairs=[]
for codes in [list(b'Plain'),[16,4]+list(b'Green')]:
    sim=from_snapshot(CSimulator,Snapshot.get(sys.argv[1]));m=sim.memory;kind='club'
    keys(['c','h','a','n','g','e','ENTER']);keys(['y','ENTER'])
    for _ in range(3):keys(['9','9','ENTER'])
    keys(['4','9','ENTER']);keys(['Z']*len(codes))
    cursor=m[23643]+256*m[23644];assert list(m[cursor-len(codes):cursor])==[90]*len(codes)
    m[cursor-len(codes):cursor]=codes;keys(['ENTER']);keys(['n','ENTER']);keys(['n','ENTER']);keys(['9','9','ENTER'])
    pairs.append({'input':codes,'homeInk':m[22528+2*32+6]&7,'awayInk':m[22528+2*32+19]&7,'line':screen()[2]})
print(json.dumps({'cases':records,'pairs':pairs},indent=2))
`;
const [input, output = 'build/zx/names.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-names.ts <24-fresh-menu.z80> [output.json]'
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
  throw new Error('Original name capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote name observations to ${output}`);
