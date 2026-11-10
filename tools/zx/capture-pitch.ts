import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Capture stable graphics boundaries, leaving ROM/game code and drawing intact.
const program = String.raw`import ast,base64,hashlib,json,sys,zlib
from skoolkit import CSimulator
from skoolkit.simutils import from_snapshot
from skoolkit.snapshot import Snapshot
from skoolkit.kbtracer import KeyboardTracer
from skoolkit.basic import VariableLister

curves={};pitches={};cases=[];pixels={}
def line():return m[23621]+256*m[23622]
def values():
    out={}
    for text in VariableLister().list_variables(m).splitlines():
        name,_,value=text.partition('=')
        try:out[name]=ast.literal_eval(value.split(' (limit=')[0])
        except (ValueError,SyntaxError):pass
    return out

def image():
    bitmap=bytes(m[16384+(y//64)*2048+(y%8)*256+((y%64)//8)*32+x] for y in range(176) for x in range(32))
    attrs=bytes(m[22528:22528+704]);rgba=bytearray()
    for y in range(176):
        for x in range(256):
            attr=attrs[(y//8)*32+x//8]
            colour=(attr&7) if bitmap[y*32+x//8]&(128>>(x%8)) else ((attr>>3)&7)
            intensity=255 if attr&64 else 215
            rgba.extend((intensity if colour&2 else 0,intensity if colour&4 else 0,intensity if colour&1 else 0,255))
    digest=hashlib.sha256(rgba).hexdigest()
    pixels[digest]=base64.b64encode(zlib.compress(bitmap+attrs)).decode()
    return digest

def keys(pressed):
    t=KeyboardTracer(sim,pressed,4,None);sim.set_tracer(t)
    t.run(65536,sim.registers[25]+120*3500000,None,None,'$','02X','04X')
    assert not t.keys

for colour in [0,7]:
  for seed in [0,1,42,219,65535]:
    snap=Snapshot.get(sys.argv[1])
    assert hashlib.sha256(bytes(snap.ram())[7371:40513]).hexdigest()=='5289e111f8f041fa9a58ae41e0567e31951d41552702bd2f525acae71bf6ece6'
    sim=from_snapshot(CSimulator,snap);m=sim.memory
    rom_hash=hashlib.sha256(bytes(m[:16384])).hexdigest()
    assert rom_hash=='d55daa439b673b0e3f5897f99ac37ecb45f974d1862b4dadb85dec34af99cb42'
    class Offsets(VariableLister):
        def _get_long_num_var(self,name,i):
            end,text=super()._get_long_num_var(name,i)
            if text.partition('=')[0]=='tco':m[end-5:end]=[0,0,colour,0,0]
            return end,text
    Offsets().list_variables(m)
    assert values()['tco']==colour
    m[23670]=seed&255;m[23671]=seed>>8
    keys(['9','9','ENTER']);keys(['ENTER'])
    tracer=KeyboardTracer(sim,['9','9','ENTER'],4,None);sim.set_tracer(tracer)
    limit=sim.registers[25]+1200*3500000
    previous=None;attack=None;attacks=[];ball=0;vertices=[];beep_seen=False
    def capture(kind):
        attack['frames'].append({'kind':kind,'ball':ball,'rgba':image()})
    def geometry(pc,instruction,tstates):
        if pc!=0x24ba:return
        x,y=m[23677:23679]
        if not vertices:
            if (x,y)!=((55,96) if direction=='right' else (201,96)):return
            vertices.append([x,y])
        b,c,d,e=sim.registers[2:6]
        vertices.append([x+c*(e if e<128 else e-256),y+b*(d if d<128 else d-256)])
    def beep(pc,instruction,tstates):
        global beep_seen
        if pc==0x03b5 and not beep_seen:
            capture('release' if current in [343,443] else 'collision');beep_seen=True
    tracer.run(6952,limit,None,None,'$','02X','04X')
    for _ in range(100000):
        if sim.registers[25]>=limit:raise RuntimeError('Timed out')
        current=line()
        if current!=previous:
            beep_seen=False
            if current in [300,400]:
                v=values();direction='right' if current==400 else 'left';ball=0;vertices=[]
                attack={'direction':direction,'seed':m[23670]+256*m[23671],'homeInk':v['ho'],'awayInk':v['aw'],'attackers':v['f(3,2)'],'defenders':v['g(3,2)'],'frames':[]}
            elif current in [304,404]:
                digest=image()
                if direction in pitches:assert pitches[direction]==digest
                else:
                    assert len(vertices)>2,vertices
                    curves[direction]=vertices
                pitches[direction]=digest
            elif current in [340,440]:capture('initial')
            elif current in [368,468] and values()['i']==3:capture('dribble')
            elif current in [359,459]:
                ball+=1;capture('ball')
            elif current in [349,449]:
                attacks.append(attack);attack=None
            elif current==5110:break
        previous=current
        if current in [303,403] and direction not in curves:
            sim.press_keys(tracer.keys,6952,limit,None,lambda pc:'',geometry)
        elif current in [343,443,352,452]:
            sim.press_keys(tracer.keys,6952,limit,None,lambda pc:'',beep)
        else:tracer.run(6952,limit,None,None,'$','02X','04X')
    else:raise RuntimeError('Statement limit reached')
    cases.append({'colour':colour,'seed':seed,'attacks':attacks})
    print(colour,seed,len(attacks),file=sys.stderr)
print(json.dumps({'observations':{'romSha256':rom_hash,'curves':curves,'pitches':pitches,'cases':cases},'pixels':pixels},indent=2))
`;
const [input, output = 'build/zx/pitch.json'] = Bun.argv.slice(2);
if (!input) {
  throw new Error(
    'Usage: bun tools/zx/capture-pitch.ts <24-fresh-menu.z80> [output.json]'
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
  throw new Error('Original pitch capture failed');
}
const { observations, pixels } = JSON.parse(result);
await mkdir(dirname(output), { recursive: true });
await Bun.write(output, JSON.stringify(observations, null, 2) + '\n');
await Bun.write(output + '.pixels.json', JSON.stringify(pixels));
console.log(
  `Wrote observations to ${output} and local pixel diagnostics to ${output}.pixels.json`
);
