"""Build one browser/native Pd orchestra from AV's existing editable engines.

Original Envion joins the shared market clock and orchestral output.
ZERO100 and Perc Generator remain reference reconstructions; see ORCHESTRA.txt.
"""
from pathlib import Path
import json
import sys

BASE=Path(__file__).resolve().parent
ROOT=BASE/'public'/'patches'/'orchestra'
ROOT.mkdir(exist_ok=True)
sys.path.insert(0,str(BASE/'native'/'perc-generator'))
import pd_patch
pd_patch.ROOT=ROOT
Patch=pd_patch.Patch

zero=BASE/'native'/'zero100'
perc=BASE/'native'/'perc-generator'
for name in ['zp-clock','zp-lane','zp-tone','zp-poly','zp-band','zp-cross','zp-delay']:
    (ROOT/(name+'.pd')).write_text((zero/(name+'.pd')).read_text())
for name in ['zp-perc-clock','zp-perc-markov','zp-perc-voice','zp-perc']:
    (ROOT/(name+'.pd')).write_text((perc/(name+'.pd')).read_text())
# Genotype and the retired Gameta sequencer are disabled.
for retired in ['av-genome.pd','av-sequencer.pd','av-pluck.pd','av-pad.pd','av-envion-voice.pd','av-envion-triplets.pd']:
    if (ROOT/retired).exists(): (ROOT/retired).unlink()

def append_patch(name,make):
    path=ROOT/(name+'.pd'); lines=path.read_text().splitlines()
    nodes=[line for line in lines[1:] if not line.startswith('#X connect')]
    wires=[line for line in lines[1:] if line.startswith('#X connect')]
    p=Patch('');p.nodes=nodes;p.wires=wires
    make(p);p.write(name)

# The bundled WASM runtime traps on Pd random's seed method. Keep seeded
# probability decisions in ordinary float-safe Pd arithmetic instead.
p=Patch('Seeded probability source / integer arithmetic stays below float precision limit')
incoming=p.obj('inlet',25,80);route=p.obj('route seed');state=p.obj('f 73')
seed=p.obj('expr int(abs($f1))%65521');p.chain(incoming,route);p.chain(route,seed);p.link(seed,state,inp=1)
p.link(route,state,out=1)
step=p.obj('expr (int($f1)*251+13849)%65521');split=p.obj('t f f');p.chain(state,step,split);p.link(split,state,out=1,inp=1)
scaled=p.obj(r'expr int($f1/65521*max(1 \, $f2))');p.chain(split,scaled,p.obj('outlet'))
bound=p.obj('inlet',225,80);p.link(bound,scaled,inp=1)
lb=p.obj('loadbang');arg=p.obj(r'f \$1');p.chain(lb,arg);p.link(arg,scaled,inp=1)
p.write('av-random')
for name in ['zp-perc-voice','zp-perc-markov']:
    path=ROOT/(name+'.pd');path.write_text(path.read_text().replace(' random ',' av-random '))

def report_audio(p,source,receiver,index,gate_name):
    # Messages reflect the actual voice envelope crossing a threshold, with
    # the part gain included; they are not fabricated by the web animation.
    level=p.signal(gate_name); audible=p.obj('*~'); p.link(source,audible); p.link(level,audible,inp=1)
    env=p.obj('env~ 1024'); above=p.obj('> 50'); change=p.obj('change'); hit=p.obj('sel 1')
    p.chain(audible,env,above,change,hit)
    value=p.obj(index);p.chain(hit,value,p.obj('s '+receiver))

def tone_report(p):
    source=next(i for i,line in enumerate(p.nodes) if line.endswith('*~ 0.045;'))
    report_audio(p,source,'av-tone-voice',r'f \$1','tones')
append_patch('zp-tone',tone_report)
def poly_report(p):
    source=next(i for i,line in enumerate(p.nodes) if line.endswith('*~ 0.13;'))
    report_audio(p,source,'av-poly-voice',r'expr \$1+4*(\$3-1)','poly')
append_patch('zp-poly',poly_report)
def perc_report(p):
    source=next(i for i,line in enumerate(p.nodes) if line.endswith('*~ 0.045;'))
    report_audio(p,source,'av-perc-voice',r'f \$1','percussion')
append_patch('zp-perc-voice',perc_report)

p=Patch('Shared master phasor -> Gameta tick. All new engines receive this same phase.')
p.obj(r'zp-clock \$1')
beats=p.obj(r'r~ \$1-beats'); phase=p.obj('wrap~'); edge=p.obj('fexpr~ $x1[0] < $x1[-1]')
threshold=p.obj('threshold~ 0.5 0 0.1 0'); gate=p.obj('spigot 0'); run=p.obj('r run')
p.chain(beats,phase,edge,threshold,gate,p.obj('s av-tick'));p.link(run,gate,inp=1)
tempo=p.obj('r tempo'); hz=p.obj('/ 15');p.chain(tempo,hz,p.obj(r's \$1-clock'))
p.chain(run,p.obj(r's \$1-run'))
root=p.obj('r tonic'); add=p.obj('+ 12');p.chain(root,add,p.obj(r's \$1-root'))
seed=p.obj('r seed'); change=p.obj('change -1');p.chain(seed,change,p.obj(r's \$1-seed'))
# Re-seeding resets the shared cycle origin and sequencers together.
reset=p.obj('t b');p.chain(change,reset,p.obj(r's \$1-reset'))
for source,target in [('swing','swing'),('density','density'),('duration','duration'),
                      ('decay','decay'),('divider','divider'),('drive','drive'),
                      ('feedback','feedback'),('delay-left','delayL'),('delay-right','delayR'),
                      ('space','space'),('cutoff','upper'),('motion','shape'),
                      ('perc-density','perc-density'),('perc-decay','perc-decay'),
                      ('perc-color','perc-color'),('perc-delay','perc-delay'),('perc-feedback','perc-feedback')]:
    p.chain(p.obj('r '+source),p.obj(r's \$1-'+target))
counter=p.obj('f 0');increment=p.obj('+ 1');counter_split=p.obj('t f f');p.chain(p.obj('r av-tick'),counter,increment,counter_split);p.link(counter_split,counter,out=1,inp=1);p.chain(counter_split,p.obj('s generation'))
p.write('av-conductor')

p=Patch('One pitch family / musical rate ratios / deterministic token-dependent filter frequencies.')
arrays={
 'swing-table':[.5]*256,'ramps':[0]*32,
 'scale':[0,0,2,3,3,5,5,7,7,9,10,10],
 'g1':[1,1,1.5,2],'g2':[1,2,1,1.5],
 'poly1':([1,2,3,4,1.5,2,4,6]*4),
 'poly2':([2,3,4,6,3,4,6,8]*4),
 'poly3':([3,4,6,8,4,6,8,12]*4),
 'filter-hz':[200,500,1000,1600,2500,4000,6500,9000],
 'perc-notes':[36,36,48,48,51,51,55,55,48,48,60,60,63,63,67,67],
 'perc-probs':[.6,.05,.2,.1,.35,.05,.2,.15,.5,.08,.25,.05,.4,.1,.25,.15],
 'perc-voices':[0]*32,
}
lb=p.obj('loadbang')
for name,values in arrays.items():
    p.obj(r'array define \$1-'+name+' '+str(len(values)))
    msg=p.msg(' '.join(map(str,values)));p.chain(lb,msg,p.obj(r'array set \$1-'+name))
ns=p.obj(r'f \$1');p.link(lb,ns)
init=p.msg(r'\; \$1-clock 8 \; \$1-run 0 \; \$1-root 60 \; \$1-octave 2 \; \$1-density 0.5 \; \$1-duration 122 \; \$1-decay 24 \; \$1-divider 8 \; \$1-shape 0 \; \$1-swing 0.5 \; \$1-upper 4000 \; \$1-drive 8 \; \$1-feedback 0.3 \; \$1-delayL 128 \; \$1-delayR 256 \; \$1-space 0 \; \$1-perc-density 0.5 \; \$1-perc-decay 160 \; \$1-perc-color 0.4 \; \$1-perc-delay 500 \; \$1-perc-feedback 0.24')
p.chain(ns,init)
seed=p.obj(r'r \$1-seed'); split=p.obj('t f f f f f f f f'); write=p.obj(r'array set \$1-filter-hz')
pack=p.obj('pack f f f f f f f f')
for i in range(8):
    expr=p.obj(f'expr {120+i*90}+(int(abs($f1))+{i*997})%{1500+i*900}')
    p.link(split,expr,out=i);p.link(expr,pack,inp=i)
p.chain(seed,split);p.chain(pack,write)
p.write('av-orchestra-tables')

# Run the supplied Envion 5.2 source itself. Host adapters preserve the original
# DSP and expose its GUI/control messages without recreating its synthesis.
p=Patch('Original Envion 5.2 / market-clock host / authored DSP preserved')
p.obj('envion/main')
tick=p.obj('r av-tick')
ready_gate=p.obj('spigot 0');ready=p.obj('r av-envion-ready')
run_gate=p.obj('spigot 0');run=p.obj('r run')
market_gate=p.obj('spigot 1');market=p.obj('r av-envion-market')
p.chain(tick,ready_gate,run_gate,market_gate)
p.link(ready,ready_gate,inp=1);p.link(run,run_gate,inp=1);p.link(market,market_gate,inp=1)
random=p.obj('av-random 1000');scale=p.obj('/ 1000');gate=p.obj('< .5');hit=p.obj('sel 1')
p.chain(market_gate,random,scale,gate,hit)
activity=p.obj('r activity');prob=p.obj('expr .1+.85*$f1');p.chain(activity,prob);p.link(prob,gate,inp=1)
# Match the original row metro's outlet order: speed draw first, row draw second.
trigger=p.obj('t b b');p.chain(hit,trigger)
p.chain(trigger,p.obj('s av-envion-row-random'))
p.link(trigger,p.obj('s av-envion-random-speed'),out=1)
seed=p.obj('r seed');seedmsg=p.msg(r'seed \$1');p.chain(seed,seedmsg,random)
# Both browser and local bridge observe this request and stop the source's
# independent metros using its announced canvas namespace.
stop=p.obj('sel 0');stop_actions=p.obj('t b b');p.chain(run,stop,stop_actions)
p.chain(stop_actions,p.obj('s av-envion-hard-stop'))
request=p.msg('0');p.link(stop_actions,request,out=1);p.chain(request,p.obj('s av-envion-stop-request'))
channels=[]
for channel,side in enumerate(['left','right']):
    source=p.obj('r~ av-envion-'+side);channels.append(source)
    out=p.obj('outlet~',25+channel*220,805);p.chain(source,out)
# One original Envion output pair replaces the previous eight fragment voices.
# Measure each side independently before combining energy to avoid phase cancellation.
left_level=p.obj('env~ 1024');right_level=p.obj('env~ 1024')
p.chain(channels[0],left_level);p.chain(channels[1],right_level)
maximum=p.obj('max');p.link(left_level,maximum);p.link(right_level,maximum,inp=1)
# Use the orchestra layer gain in the audible crossing condition.
gain=p.obj('r melody');rms=p.obj('dbtorms');weighted=p.obj('*');threshold=p.obj('> 0.00316228')
p.chain(maximum,rms,weighted,threshold);p.link(gain,weighted,inp=1)
change=p.obj('change');audible=p.obj('sel 1');value=p.msg('0')
p.chain(threshold,change,audible,value,p.obj('s av-envion-voice'))
p.write('av-envion')

p=Patch('ZERO100 orchestral voices and filterbank / existing reconstruction modules.')
p.obj(r'clone zp-lane 32 \$1')
tone=p.obj(r'clone zp-tone 32 \$1');tones=p.gain(tone,'tones',.8)
poly=[]
for i in range(3):poly.append(p.obj(r'clone zp-poly 4 \$1 '+str(i+1)+' '+str((i-1)*12)))
sum1=p.obj('+~');p.link(poly[0],sum1);p.link(poly[1],sum1,inp=1)
sum2=p.obj('+~');p.link(sum1,sum2);p.link(poly[2],sum2,inp=1)
polygain=p.gain(sum2,'poly',.5)
drive=p.gain(sum2,r'\$1-drive');sat=p.obj('expr~ tanh($v1)');p.chain(drive,sat)
bank=p.obj(r'clone zp-band 8 \$1');cross=p.obj('zp-cross 32');p.chain(sat,bank,cross)
shape=p.obj('expr~ tanh($v1)');p.link(cross,shape,out=1)
filtered=p.gain(shape,'filtered',.15)
summed=p.obj('+~');p.link(tones,summed);p.link(polygain,summed,inp=1)
combined=p.obj('+~');p.link(summed,combined);p.link(filtered,combined,inp=1)
material=p.obj('+~');p.link(tone,material);p.link(sum2,material,inp=1);p.chain(material,p.obj(r's~ \$1-envion-source'))
delay=p.obj(r'zp-delay \$1');p.chain(combined,delay)
for channel in range(2):
    out=p.obj('outlet~',25+channel*200,805);p.link(delay,out,out=channel)
p.write('av-zero-ensemble')

# Portable Freeverb algorithm (Jezar at Dreampoint, June 2000, public domain).
# Delays are original 44.1 kHz tuning lengths converted to milliseconds.
p=Patch('Freeverb damped feedback comb / vanilla Pd')
incoming=p.obj('inlet~',25,70);read=p.obj(r'delread~ \$0-comb \$1')
oneMinus=p.obj('*~ .8');pole=p.obj('rpole~ .2');p.chain(read,oneMinus,pole)
feedback=p.obj(r'r~ \$2-fv-feedback');mul=p.obj('*~');p.link(pole,mul);p.link(feedback,mul,inp=1)
add=p.obj('+~');p.link(incoming,add);p.link(mul,add,inp=1);write=p.obj(r'delwrite~ \$0-comb 100');p.chain(add,write)
p.chain(read,p.obj('outlet~',25,805))
seed=p.obj('r seed');clear=p.msg('clear');p.chain(seed,clear,write);p.link(clear,pole)
p.write('av-freeverb-comb')

p=Patch('Freeverb diffusion stage / original feedback 0.5 equation')
incoming=p.obj('inlet~',25,70);read=p.obj(r'delread~ \$0-diffuse \$1');feedback=p.obj('*~ .5');p.chain(read,feedback)
add=p.obj('+~');p.link(incoming,add);p.link(feedback,add,inp=1);write=p.obj(r'delwrite~ \$0-diffuse 100');p.chain(add,write)
subtract=p.obj('-~');p.link(read,subtract);p.link(incoming,subtract,inp=1);p.chain(subtract,p.obj('outlet~',25,805))
seed=p.obj('r seed');clear=p.msg('clear');p.chain(seed,clear,write)
p.write('av-freeverb-diffuse')

p=Patch('Freeverb stereo wet engine / eight combs and four diffusion stages per side')
left=p.obj('inlet~',25,70);right=p.obj('inlet~',245,70)
sumInput=p.obj('+~');p.link(left,sumInput);p.link(right,sumInput,inp=1);drive=p.obj('*~ .015');p.chain(sumInput,drive)
texture=p.obj('r texture');bounded=p.obj(r'clip 0 1');room=p.obj('expr .70+.28*(.35+.60*$f1)');smooth=p.obj('pack f 500');line=p.obj('line~');send=p.obj(r's~ \$0-fv-feedback');p.chain(texture,bounded,room,smooth,line,send)
lb=p.obj('loadbang');default=p.msg('.798');p.chain(lb,default,smooth)
for channel in range(2):
    summed=None
    for length in [1116,1188,1277,1356,1422,1491,1557,1617]:
        delay=(length+23*channel)/44.1
        comb=p.obj(f'av-freeverb-comb {delay:.9f} '+r'\$0');p.link(drive,comb)
        if summed is None:summed=comb
        else:
            add=p.obj('+~');p.link(summed,add);p.link(comb,add,inp=1);summed=add
    for length in [556,441,341,225]:
        stage=p.obj(f'av-freeverb-diffuse {(length+23*channel)/44.1:.9f}');p.chain(summed,stage);summed=stage
    out=p.obj('outlet~',25+channel*220,805);p.chain(summed,out)
p.write('av-freeverb')

p=Patch('AV AUTO ORCHESTRA / one clock, harmony, automatic mix and stereo master.')
p.obj(r'av-orchestra-tables \$0');p.obj(r'av-conductor \$0')
envion=p.obj(r'av-envion \$0');mel=p.gain(envion,'melody',1)
right=p.obj('+~ 0');p.link(envion,right,out=1);melR=p.gain(right,'melody',1)
both=p.obj('+~');p.link(mel,both);p.link(melR,both,inp=1);center=p.obj('*~ .5');p.chain(both,center)
write=p.obj(r'delwrite~ \$0-gameta 2000');p.link(center,write)
readL=p.obj(r'delread~ \$0-gameta 263');readR=p.obj(r'delread~ \$0-gameta 431')
fb=p.obj('+~');p.link(readL,fb);p.link(readR,fb,inp=1)
damp=p.obj('lop~ 3200');trim=p.obj('*~ 0.24');p.chain(fb,damp,trim,write)
zero=p.obj(r'av-zero-ensemble \$0');perc=p.obj(r'zp-perc \$0')
mixes=[]
for channel,wet in enumerate([readL,readR]):
    dry=[mel,melR][channel]
    space=p.gain(wet,'space',.45);base=p.obj('+~');p.link(dry,base);p.link(space,base,inp=1)
    together=p.obj('+~');p.link(base,together);p.link(zero,together,out=channel,inp=1)
    percussion=p.obj('*~');p.link(perc,percussion,out=channel);p.link(p.signal('percussion'),percussion,inp=1)
    mix=p.obj('+~');p.link(together,mix);p.link(percussion,mix,inp=1);mixes.append(mix)
reverb=p.obj('av-freeverb');p.link(mixes[0],reverb);p.link(mixes[1],reverb,inp=1)
wetControl=p.signal('space',500);dryControl=p.obj('expr~ 1-$v1');p.chain(wetControl,dryControl)
for channel in range(2):
    dry=p.obj('*~');p.link(mixes[channel],dry);p.link(dryControl,dry,inp=1)
    wet=p.obj('*~');p.link(reverb,wet,out=channel);p.link(wetControl,wet,inp=1)
    combined=p.obj('+~');p.link(dry,combined);p.link(wet,combined,inp=1)
    hp=p.obj('hip~ 35');saturation=p.obj('expr~ tanh($v1*0.8)');p.chain(combined,hp,saturation)
    running=p.gain(saturation,'run',1);master=p.gain(running,'master')
    limit=p.obj('clip~ -0.85 0.85');p.chain(master,limit)
    dac=p.obj('dac~ '+str(channel+1));p.chain(limit,dac)
    p.chain(limit,p.obj('s~ av-output-'+str(channel)))
    env=p.obj('env~ 4096');db=p.obj('- 100');p.chain(limit,env,db,p.obj('s av-output-'+('left' if channel==0 else 'right')))
reset=p.obj('r seed');clear=p.msg('clear');p.chain(reset,clear,write)
p.write('market')

# Desktop version of exactly the same orchestra; native telemetry is sampled.
p=Patch('AV / AUTO ORCHESTRA - desktop launcher',980,420)
p.obj('market',25,75);p.obj('av-bridge',225,75)
p.text('Enable DSP then localhost:4173 -> Native Pd -> coin -> Listen.',25,145)
p.msg(r'\; pd dsp 1',25,195)
p.text('Market data controls every layer. Only listening volume is adjustable on the website.',25,250)
lb=p.obj('loadbang',600,195);off=p.msg(r'\; run 0 \; master 0',600,235);p.chain(lb,off)
p.write('av-desktop')

bridge=(BASE/'public'/'patches'/'av-bridge.pd').read_text()
bp=Patch('');bp.nodes=[line for line in bridge.splitlines()[1:] if not line.startswith('#X connect')]
bp.wires=[line for line in bridge.splitlines()[1:] if line.startswith('#X connect')]
route=next(i for i,line in enumerate(bp.nodes) if ' route ' in line)
new=['tones','poly','filtered','percussion','swing','density','duration','decay','divider','drive','feedback','delay-left','delay-right','perc-density','perc-decay','perc-color','perc-delay','perc-feedback','av-envion-ready','av-envion-market']
old=bp.nodes[route].split(' route ',1)[1].rstrip(';').split()
bp.nodes[route]=bp.nodes[route][:-1]+' '+' '.join(new)+';'
for i,name in enumerate(new):bp.link(route,bp.obj('s '+name),out=len(old)+i)
for name in ['av-envion-voice','av-envion-stop-request','av-envion-id','av-tone-voice','av-poly-voice','av-perc-voice','av-output-left','av-output-right']:
    alive=next(i for i,line in enumerate(bp.nodes) if line.endswith('netsend -u;'))
    r=bp.obj('r '+name);msg=bp.msg(r'send '+name+r' \$1');bp.chain(r,msg,alive)
alive=next(i for i,line in enumerate(bp.nodes) if line.endswith('netsend -u;'))
beat=next(i for i,line in enumerate(bp.nodes) if line.endswith('metro 1000;'))
version=bp.msg('send orchestra-version 5');bp.chain(beat,version,alive)
bp.write('av-bridge')

files=sorted(path.name for path in ROOT.glob('*.pd') if path.name not in ['av-desktop.pd','av-bridge.pd'])
(ROOT/'manifest.json').write_text(json.dumps({'version':5,'entry':'market.pd','files':files,'layers':['melody','tones','poly','filtered','percussion']},indent=2)+'\n')
print('Built orchestra:',len(files),'browser Pd files + desktop launcher')
