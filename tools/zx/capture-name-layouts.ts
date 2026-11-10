import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Probe the original INPUT/PRINT scrolling by entering names through the ROM editor.
const program = String.raw`import base64,hashlib,json,sys,zlib
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

source=sys.argv[1]
def reset():
    global sim,m
    snapshot=Snapshot.get(source)
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest()=='5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
    sim=from_snapshot(CSimulator,snapshot);m=sim.memory

def keys(pressed,seconds=10):
    tracer=KeyboardTracer(sim,pressed,4,None);sim.set_tracer(tracer)
    tracer.run(65536,sim.registers[25]+seconds*3500000,None,None,'$','02X','04X')
    assert not tracer.keys

def enter(text):
    if text:
        codes=list(text.encode('ascii'))
        keys(['Z']*len(codes))
        cursor=m[23643]+256*m[23644]
        assert list(m[cursor-len(codes):cursor])==[90]*len(codes)
        m[cursor-len(codes):cursor]=codes
    keys(['ENTER'])

def screen():
    font=m[23606]+256*m[23607]+256
    glyphs={tuple(m[font+(c-32)*8:font+(c-32)*8+8]):('£' if c==96 else '©' if c==127 else chr(c)) for c in range(32,128)}
    lines=[];inverse=[]
    for row in range(24):
        text=''
        for col in range(32):
            pixels=tuple(m[16384+(row//8)*2048+(row%8)*32+y*256+col] for y in range(8))
            inverted=tuple(b^255 for b in pixels)
            text+=glyphs.get(pixels,glyphs.get(inverted,'#'))
            if row<22:inverse.append(int(pixels not in glyphs and inverted in glyphs))
        lines.append(text.rstrip())
    return {'lines':lines,'attributes':base64.b64encode(zlib.compress(bytes(m[22528:22528+22*32]))).decode(),'inverse':base64.b64encode(zlib.compress(bytes(inverse))).decode(),'line':m[23621]+256*m[23622], 'upperPos':list(m[23688:23690]), 'lowerRows':m[23659]}

edits=[]
for kind in ['club','player']:
    for inputs in [['y','0','0','65','1','1Name','ABCDEFGHIJK','1Name','','Town','y','1','Again','n'],['y','1','1Name','1Name','1Name','1Name','1Name','Town'],['y','1','Town','y','0','1','Again'],['y','99','99','99','99'], ['y','1','','','h','H','Town','h','H','y'], ['y','1']+['']*23+['Town'], ['y','1','Town','h','H','y'], ['y','1','h','Town'], ['y','1']+['1Name']*24+['Town'], ['y','1','1Name','1Name',chr(16)+chr(2)]]:
        reset();enter('change')
        if kind=='player':enter('n')
        steps=[]
        for text in inputs:
            enter(text);observed=screen()
            if steps and steps[-1]['input']==text and {k:v for k,v in steps[-1].items() if k not in ['input','repeat']}==observed:
                steps[-1]['repeat']+=1
            else:steps.append({'input':text,'repeat':1,**observed})
        edits.append({'kind':kind,'steps':steps})
        print(kind,len(inputs),file=sys.stderr)

matches=[]
for home,away in [(False,True),(True,False),(True,True)]:
    reset();enter('change');enter('y')
    for _ in range(3):enter('99')
    for id,changed in [(64,home),(49,away)]:
        if changed:
            enter(str(id));enter('ABCDEFGHIJ');enter('y')
    # Leave the current club page through a successful edit's more question.
    enter('64');enter('ABCDEFGHIJ' if home else chr(16)+chr(2)+'Arsenal');enter('n');enter('n')
    m[23670]=219;m[23671]=0
    enter('99');fixture=screen();enter('');keys([]);team=screen();assert team['line']==6135,team['line']
    matches.append({'home':home,'away':away,'fixture':fixture,'team':team})
    print('match',home,away,file=sys.stderr)
seasons=[]
for division in [1,2,4]:
    snapshot=Snapshot.get(sys.argv[2])
    assert hashlib.sha256(bytes(snapshot.ram())[7371:40513]).hexdigest()=='73e972eae89e3f192eff177192b8aff7cdc7d1d81f08e86947ff417c76090ac6'
    sim=from_snapshot(CSimulator,snapshot);m=sim.memory
    class Offsets(VariableLister):
        def __init__(self):super().__init__();self.scalars={};self.arrays={};self.chars={}
        def _get_short_num_var(self,name,i):
            self.scalars[name]=i+1
            return super()._get_short_num_var(name,i)
        def _get_long_num_var(self,name,i):
            end,line=super()._get_long_num_var(name,i);self.scalars[line.partition('=')[0]]=end-5
            return end,line
        def _get_num_array_var(self,name,i):
            self.arrays[name]=i+4+2*m[i+3]
            return super()._get_num_array_var(name,i)
        def _get_char_array_var(self,name,i):
            self.chars[name]=i+4+2*m[i+3]
            return super()._get_char_array_var(name,i)
    offsets=Offsets();offsets.list_variables(m)
    def integer(address,value):m[address:address+5]=[0,0,value&255,value>>8,0]
    for name,value in [('d1',division),('lt',(division-1)*16),('t1',(division-1)*16+8),('d2',5-division),('ml',15),('fa',1),('c',8),('s',48),('s5',3)]:integer(offsets.scalars[name],value)
    for i in range(16):integer(offsets.arrays['t']+i*5,i+1)
    m[offsets.chars['u']:offsets.chars['u']+16]=list(range(1,17))
    m[offsets.chars['t']:offsets.chars['t']+64*12]=list(b'ABCDEFGHIJ  ')*64
    keys(['ENTER'],60);keys(['ENTER'],60);keys(['ENTER'],60)
    summary=screen()
    seasons.append({'division':division,'summary':summary})
    print('season',division,summary['line'],file=sys.stderr)
print(json.dumps({'edits':edits,'matches':matches,'seasons':seasons},indent=2))
`;
const [input, bills, output = 'build/zx/name-layouts.json'] = Bun.argv.slice(2);
if (!input || !bills) {
  throw new Error(
    'Usage: bun tools/zx/capture-name-layouts.ts <24-fresh-menu.z80> <10-bills.z80> [output.json]'
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
    resolve(input),
    resolve(bills)
  ],
  { stderr: 'inherit', stdout: 'pipe' }
);
const result = await new Response(child.stdout).text();
if ((await child.exited) !== 0) {
  throw new Error('Original name layout capture failed');
}
JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, result);
console.log(`Wrote layout observations to ${output}`);
