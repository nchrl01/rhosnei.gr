"""Editable vanilla Pd reconstruction of visible parts of ZeroPoint Zero's 100h.

The unavailable Gen algorithms are independent approximations, not a source port.
Run this file to regenerate the .pd files in this directory.
"""
from pathlib import Path
import math
import random

ROOT = Path(__file__).resolve().parent


class Patch:
    def __init__(self, title, width=1240, height=860):
        self.nodes, self.wires = [], []
        self.width, self.height = width, height
        self.text(title, 25, 15)

    def node(self, kind, value, x=None, y=None):
        i = len(self.nodes)
        x = 25 + (i // 17) * 330 if x is None else x
        y = 55 + (i % 17) * 40 if y is None else y
        self.nodes.append(f'#X {kind} {x} {y} {value};')
        return i

    def obj(self, value, x=None, y=None): return self.node('obj', value, x, y)
    def msg(self, value, x=None, y=None): return self.node('msg', value, x, y)
    def text(self, value, x, y): return self.node('text', value, x, y)

    def link(self, a, b, out=0, inp=0):
        self.wires.append(f'#X connect {a} {out} {b} {inp};')

    def chain(self, *nodes):
        for a, b in zip(nodes, nodes[1:]): self.link(a, b)

    def signal(self, name, ms=50):
        receive = self.obj('r ' + name)
        pack = self.obj(f'pack f {ms}')
        line = self.obj('line~')
        self.chain(receive, pack, line)
        return line

    def gain(self, audio, name, trim=1):
        mul = self.obj('*~')
        self.link(audio, mul)
        self.link(self.signal(name), mul, inp=1)
        scale = self.obj(f'*~ {trim}')
        self.chain(mul, scale)
        return scale

    def graph(self, name, values, low, high, x, y, width=350, height=100):
        self.nodes.append('\n'.join([
            '#N canvas 0 0 450 200 (subpatch) 0;',
            f'#X array {name} {len(values)} float 3;',
            '#A 0 ' + ' '.join(f'{v:.6g}' for v in values) + ';',
            f'#X coords 0 {high} {len(values)} {low} {width} {height} 1 0 0;',
            f'#X restore {x} {y} graph;']))

    def write(self, name):
        (ROOT / (name + '.pd')).write_text('\n'.join([
            f'#N canvas 50 50 {self.width} {self.height} 12;',
            *self.nodes, *self.wires]) + '\n')


# All state except the optional AV adapter is instance-local.
DEFAULTS = dict(market=0, run=0, clock=8, divider=4, swing=.5, decay=24,
                duration=122, root=60, upper=4000, octave=2, shape=0,
                drive=16, delayL=128, delayR=128, feedback=.36,
                main=.55, poly=.35, filtered=.65, kick=0, space=.45,
                master=.18, density=.65, seed=100)
SCALE = [0, 0, 2, 3, 3, 5, 5, 7, 7, 8, 10, 10]
SWING = [.5] * 256
POLY = [[round(2 ** (2.4 + .8*math.sin(i*.17+b) + .35*b), 4)
         for i in range(32)] for b in range(3)]
RNG = random.Random(100)
FILTERS = [32 + RNG.randrange(10000) for _ in range(8)]

p = Patch('Reference defaults / arrays. These are starting values - not a recovered preset.')
reset = p.obj(r'r \$1-reset'); lb = p.obj('loadbang'); send = p.obj(r'f \$1')
p.link(reset, send); p.link(lb, send)
defaults = p.msg(' '.join(r'\; \$1-'+k+' '+str(v) for k,v in DEFAULTS.items()))
p.chain(send, defaults)
for name, values in [('swing-table', SWING), ('scale', SCALE),
                     ('poly1', POLY[0]), ('poly2', POLY[1]), ('poly3', POLY[2]),
                     ('filter-hz', FILTERS), ('g1', [1, 3, 4, 2]), ('g2', [4, 2, 3, 1])]:
    msg = p.msg(' '.join(map(str, values)))
    target = p.obj(r'array set \$1-'+name)
    p.link(reset, msg); p.link(lb, msg); p.chain(msg, target)
p.write('zp-defaults')

p = Patch('Manual edits are accepted only in reference mode. Live values always update the UI.')
inp = p.obj(r'r \$1-\$2-edit'); gate = p.obj('spigot 1')
mode = p.obj(r'r \$1-market'); inv = p.obj('== 0')
p.chain(inp, gate, p.obj(r's \$1-\$2')); p.chain(mode, inv); p.link(inv, gate, inp=1)
value = p.obj(r'r \$1-\$2'); msg = p.msg(r'set \$1')
p.chain(value, msg, p.obj(r's \$1-\$2-ui'))
p.write('zp-control')

p = Patch('Shared audio-rate clock / cycle count / UI clock. rate is a DIVISOR.')
hz = p.signal(r'\$1-clock'); run = p.signal(r'\$1-run', 8)
mul = p.obj('*~'); phase = p.obj('phasor~')
p.link(hz, mul); p.link(run, mul, inp=1); p.chain(mul, phase)
edge = p.obj('fexpr~ $x1[0] < $x1[-1]'); cycles = p.obj('rpole~ 1'); beats = p.obj('+~')
p.chain(phase, edge, cycles, beats); p.link(phase, beats, inp=1)
p.chain(beats, p.obj(r's~ \$1-beats'))
reset = p.obj(r'r \$1-reset'); clear = p.msg('clear'); zero = p.msg('0')
p.chain(reset, clear, cycles); p.chain(reset, zero); p.link(zero, phase, inp=1)
lb = p.obj('loadbang'); one = p.msg('1'); ui = p.obj('metro 100')
p.chain(lb, one, ui, p.obj(r's \$1-ui-tick'))
snap = p.obj('snapshot~'); p.link(beats, snap); p.link(ui, snap)
floor = p.obj('int'); change = p.obj('change -1')
p.chain(snap, floor, change, p.obj(r's \$1-step'))
p.write('zp-clock')

p = Patch('32 lanes: swing lookup -> staggered trigger -> one-shot ramp / independent Gen replacement.')
beats = p.obj(r'r~ \$2-beats'); idx = p.obj(r'loadbang'); n = p.obj(r'f \$1')
p.chain(idx, n)
offset = p.obj('/ 32'); p.chain(n, offset)
phase = p.obj('+~'); p.link(beats, phase); p.link(offset, phase, inp=1)
wrapped = p.obj('wrap~'); p.chain(phase, wrapped)
# Each lane selects one of eight banks in the 256-value swing table.
tableindex = p.obj(r'expr~ (int($v1/4)%8)*32+\$1')
lookup = p.obj(r'tabread~ \$2-swing-table'); p.chain(beats, tableindex, lookup)
swing = p.signal(r'\$2-swing'); warp = p.obj(r'expr~ min(0.95 \, max(0.05 \, $v1+$v2-0.5))')
p.link(lookup, warp); p.link(swing, warp, inp=1)
warped = p.obj(r'expr~ if($v1<$v2 \, 0.5*$v1/$v2 \, 0.5+0.5*($v1-$v2)/(1-$v2))')
p.link(wrapped, warped); p.link(warp, warped, inp=1)
double = p.obj('*~ 2'); swung = p.obj('wrap~')
trigger = p.obj('fexpr~ $x1[0] < $x1[-1]'); p.chain(warped, double, swung, trigger)
duration = p.signal(r'\$2-duration'); sr = p.obj('samplerate~'); rate = p.obj('sig~ 48000')
p.chain(idx, sr, rate)
dsp = p.obj('r pd-dsp-started'); p.link(dsp, sr)
increment = p.obj(r'expr~ 1000/max(1 \, $v1*$v2)')
p.link(duration, increment); p.link(rate, increment, inp=1)
# One-shot holds at 1 and refuses retriggers until completion, matching ramp~ defaults.
ramp = p.obj(r'fexpr~ if($x1[0]>0 && $y1[-1]>=1 \, 0 \, min(1 \, $y1[-1]+$x2[0]))')
p.link(trigger, ramp); p.link(increment, ramp, inp=1)
p.chain(ramp, p.obj(r's~ \$2-ramp-\$1'))
snap = p.obj('snapshot~'); tick = p.obj(r'r \$2-ui-tick'); arr = p.obj(r'tabwrite \$2-ramps')
p.link(ramp, snap); p.link(tick, snap); p.chain(snap, arr); p.link(n, arr, inp=1)
p.write('zp-lane')

p = Patch('32-channel tonal branch. Phase modulation and envelope are inferred Gen replacements.')
ramp = p.obj(r'r~ \$2-ramp-\$1'); decay = p.signal(r'\$2-decay')
env = p.obj(r'expr~ min(1 \, $v1*32)*exp(-$v1*$v2*.25)*($v1<1)')
p.link(ramp, env); p.link(decay, env, inp=1)
lb = p.obj('loadbang'); index = p.obj(r'f \$1'); p.chain(lb, index)
degree = p.obj('expr (int($f1)*7)%12'); lookup = p.obj(r'tabread \$2-scale')
update = p.obj(r'r \$2-ui-tick'); p.link(update, index); p.chain(index, degree, lookup)
root = p.signal(r'\$2-root'); step = p.obj('sig~'); pitch = p.obj('+~')
p.chain(lookup, step, pitch); p.link(root, pitch, inp=1)
octave = p.obj(r'expr 12*(int(\$1/8)-1)'); p.link(lb, octave)
octadd = p.obj('+~'); p.chain(pitch, octadd); p.link(octave, octadd, inp=1)
hz = p.obj('mtof~'); cap = p.obj('min~ 4000'); p.chain(octadd, hz)
seed = p.obj(r'r \$2-seed')
octmod = p.obj(r'expr pow(2 \, (int($f1)+\$1*17)%3)')
octsig = p.obj('sig~ 1'); p.chain(seed, octmod, octsig)
modulated = p.obj('*~'); p.link(hz, modulated); p.link(octsig, modulated, inp=1)
divider = p.signal(r'\$2-octave'); divided = p.obj('/~')
p.chain(modulated, divided, cap); p.link(divider, divided, inp=1)
limit = p.obj(r'r \$2-upper'); p.link(limit, cap, inp=1)
phasor = p.obj('phasor~'); p.chain(cap, phasor)
shape = p.signal(r'\$2-shape'); tone = p.obj('expr~ cos(6.2831853*($v1+$v2*$v3*.7))')
p.link(phasor, tone); p.link(ramp, tone, inp=1); p.link(shape, tone, inp=2)
density = p.signal(r'\$2-density'); mask = p.obj(r'expr~ $v1>((\$1*13)%32)/32')
p.chain(density, mask)
audio = p.obj('*~'); gated = p.obj('*~'); p.link(tone, audio); p.link(env, audio, inp=1)
p.chain(audio, gated); p.link(mask, gated, inp=1)
trim = p.obj('*~ 0.045'); p.chain(gated, trim, p.obj('outlet~'))
p.write('zp-tone')

p = Patch('Three groups of four polymetric voices. Oscillator / phase folding are inferred.')
beats = p.obj(r'r~ \$2-beats'); divider = p.signal(r'\$2-divider')
slow = p.obj('/~'); p.link(beats, slow); p.link(divider, slow, inp=1)
lb = p.obj('loadbang'); tick = p.obj(r'r \$2-ui-tick'); index = p.obj(r'f \$1')
p.link(lb, index); p.link(tick, index)
scan = p.obj(r'expr~ (int($v1)%8)*4+\$1')
table = p.obj(r'tabread~ \$2-poly\$3'); p.chain(slow, scan, table)
# All 32 entries participate, in eight four-channel banks.
groupindex = p.obj(r'f \$1'); g1 = p.obj(r'tabread \$2-g1'); g2 = p.obj(r'tabread \$2-g2')
order = p.obj('t f f')
p.link(tick,groupindex); p.link(lb,groupindex); p.chain(groupindex,order)
p.link(order,g2,out=1); p.link(order,g1)
ratio = p.obj('/'); bounded = p.obj('max 0.125')
p.chain(g2,bounded); p.link(bounded,ratio,inp=1); p.link(g1,ratio)
ratioSig = p.obj('sig~ 1'); p.chain(ratio,ratioSig)
factor = p.obj('*~'); p.link(table,factor); p.link(ratioSig,factor,inp=1)
product = p.obj('*~'); p.link(slow, product); p.link(factor, product, inp=1)
phase = p.obj('wrap~'); p.chain(product, phase)
env = p.obj(r'expr~ min(1 \, $v1*48)*exp(-$v1*9)'); p.chain(phase, env)
pitchindex = p.obj(r'expr (\$1*3+\$3*2)%12'); pitchlookup = p.obj(r'tabread \$2-scale')
p.chain(index, pitchindex, pitchlookup)
root = p.obj(r'r \$2-root'); add = p.obj('+ 60'); p.link(root, add, inp=1); p.chain(pitchlookup, add)
oct = p.obj(r'+ \$4'); hz = p.obj('mtof'); freq = p.obj('sig~'); p.chain(add, oct, hz, freq)
# Audio-rate modulation by a control ramp selected from the 32 lanes.
mod = p.obj(r'r~ \$2-ramp-\$1'); fm = p.obj('expr~ $v1*(1+0.035*$v2)')
p.link(freq, fm); p.link(mod, fm, inp=1)
osc = p.obj('phasor~'); fold = p.obj(r'expr~ tanh(sin(6.2831853*$v1)*(1+\$3))')
p.chain(fm, osc, fold)
mul = p.obj('*~'); p.link(fold, mul); p.link(env, mul, inp=1)
trim = p.obj('*~ 0.13'); p.chain(mul, trim, p.obj('outlet~'))
p.write('zp-poly')

# Third-order Butterworth crossover: first-order + second-order (Q=1).
# Both branches exist; exact Max coefficients/phase response remain unverified.
p = Patch('Third-order Butterworth crossover / low outlet then high outlet. NOT a crossfader.')
audio = p.obj('inlet~',25,60)
lb = p.obj('loadbang',360,60); dsp = p.obj('r pd-dsp-started',500,60)
sr = p.obj('samplerate~',360,100); p.link(lb,sr); p.link(dsp,sr)
k = p.obj(r'expr tan(3.14159265359*min(\$1 \, max(1 \, $f1)*0.45)/max(1 \, $f1))',360,140)
p.chain(sr,k)
for side in range(2):
    first = p.obj('biquad~',25+side*190,220)
    second = p.obj('biquad~',25+side*190,300)
    p.chain(audio,first,second,p.obj('outlet~',25+side*190,370))
    for stage, target in enumerate([first, second]):
        y=210+(side*2+stage)*135
        trigger=p.obj('t f f f f f',460,y); pack=p.obj('pack f f f f f',460,y+90)
        p.link(k,trigger); p.link(pack,target)
        if stage==0:
            expressions=['(1-$f1)/(1+$f1)','0',
                         ('$f1' if side==0 else '1')+'/(1+$f1)',
                         ('$f1' if side==0 else '-1')+'/(1+$f1)','0']
        else:
            d='(1+$f1+$f1*$f1)'; b='$f1*$f1' if side==0 else '1'
            expressions=[f'2*(1-$f1*$f1)/{d}',f'-(1-$f1+$f1*$f1)/{d}',
                         f'{b}/{d}',f'{2 if side==0 else -2}*{b}/{d}',f'{b}/{d}']
        for j,expression in enumerate(expressions):
            expr=p.obj('expr '+expression,460+j*155,y+45)
            p.link(trigger,expr,out=j); p.link(expr,pack,inp=j)
p.write('zp-cross')

p = Patch('Eight parallel resonant filters / Q=8. bp~ approximates mcs.fffb~ - gain law differs.')
audio = p.obj('inlet~'); lb=p.obj('loadbang'); idx=p.obj(r'f \$1'); ui=p.obj(r'r \$2-ui-tick')
p.link(lb,idx); p.link(ui,idx)
freq=p.obj(r'tabread \$2-filter-hz'); p.chain(idx,freq)
bp=p.obj('bp~ 1000 8'); p.link(audio,bp); p.link(freq,bp,inp=1)
p.chain(bp,p.obj('outlet~')); p.write('zp-band')

p=Patch('Inferred kick voice. The video exposes a kick branch but not its oscillator or envelope.')
beats=p.obj(r'r~ \$1-beats'); phase=p.obj('*~ 0.25'); wrap=p.obj('wrap~'); p.chain(beats,phase,wrap)
env=p.obj(r'expr~ exp(-$v1*23)*min(1 \, $v1*150)'); p.chain(wrap,env)
freq=p.obj('expr~ 42+125*exp(-$v1*90)'); osc=p.obj('osc~'); p.chain(wrap,freq,osc)
mul=p.obj('*~'); p.link(osc,mul); p.link(env,mul,inp=1)
p.chain(mul,p.obj('outlet~')); p.write('zp-kick')

p=Patch('Stereo delay replacement. 128/128 displayed in video - milliseconds and feedback are inferred.')
inp=p.obj('inlet~'); read=[]
for side in ['L','R']:
    delay=p.signal(r'\$1-delay'+side,80); clip=p.obj('clip~ 2 1900'); p.chain(delay,clip)
    rd=p.obj(r'delread4~ \$0-'+side); p.chain(clip,rd); read.append(rd)
for i,side in enumerate(['L','R']):
    gain=p.gain(read[1-i],r'\$1-feedback'); damp=p.obj('lop~ 7000'); summed=p.obj('+~')
    p.chain(gain,damp,summed); p.link(inp,summed,inp=1)
    sat=p.obj('expr~ tanh($v1)'); write=p.obj(r'delwrite~ \$0-'+side+' 2000')
    p.chain(summed,sat,write)
    wet=p.gain(read[i],r'\$1-space'); mix=p.obj('+~'); p.link(inp,mix); p.link(wet,mix,inp=1)
    low=p.obj('zp-cross 15000'); high=p.obj('zp-cross 32'); p.chain(mix,low,high)
    out=p.obj('outlet~'); p.link(high,out,out=1)
clear=p.obj(r'r \$1-reset'); msg=p.msg('clear'); p.chain(clear,msg)
# Clear both delay buffers on reset.
for i,node in enumerate(p.nodes):
    if 'delwrite~' in node: p.link(msg,i)
p.write('zp-delay')

p=Patch('100h / audio engine. Open each named abstraction to inspect its full signal path.')
p.obj(r'zp-clock \$1',25,65); p.obj(r'clone zp-lane 32 \$1',25,115)
tones=p.obj(r'clone zp-tone 32 \$1',25,165)
main=p.gain(tones,r'\$1-main',.8)
poly=[]
for i in range(3):
    poly.append(p.obj(r'clone zp-poly 4 \$1 '+str(i+1)+' '+str((i-1)*12)))
polysum=p.obj('+~'); p.link(poly[0],polysum); p.link(poly[1],polysum,inp=1)
allpoly=p.obj('+~'); p.link(polysum,allpoly); p.link(poly[2],allpoly,inp=1)
polygain=p.gain(allpoly,r'\$1-poly',.5)
drive=p.gain(allpoly,r'\$1-drive'); tanh=p.obj('expr~ tanh($v1)'); p.chain(drive,tanh)
bank=p.obj(r'clone zp-band 8 \$1'); p.chain(tanh,bank)
cross=p.obj('zp-cross 32'); p.chain(bank,cross)
sat=p.obj('expr~ tanh($v1)'); p.link(cross,sat,out=1)
filtered=p.gain(sat,r'\$1-filtered',.1)
kick=p.obj(r'zp-kick \$1'); kickgain=p.gain(kick,r'\$1-kick',.6)
mix=p.obj('+~'); p.link(main,mix); p.link(polygain,mix,inp=1)
mix2=p.obj('+~'); p.link(mix,mix2); p.link(filtered,mix2,inp=1)
mix3=p.obj('+~'); p.link(mix2,mix3); p.link(kickgain,mix3,inp=1)
delays=p.obj(r'zp-delay \$1'); p.chain(mix3,delays)
for channel in range(2):
    sat=p.obj('expr~ tanh($v1)'); p.link(delays,sat,out=channel)
    run=p.gain(sat,r'\$1-run'); level=p.gain(run,r'\$1-master')
    limit=p.obj('clip~ -0.9 0.9'); p.chain(level,limit)
    p.chain(limit,p.obj('outlet~'))
    meter=p.obj('env~ 2048'); db=p.obj('- 100'); p.chain(limit,meter,db,p.obj(r's \$1-meter'+str(channel)))
    p.chain(limit,p.obj(r's~ \$1-output'+str(channel)))
p.write('zp-engine')

p=Patch('Optional AV adapter / all musical controls follow incoming market signals when enabled.')
for source,target,expression in [
    ('run','run','$f1'),('master','master',r'min(0.5 \, max(0 \, $f1))'),
    ('tempo','clock',r'min(24 \, max(1 \, $f1/15))'),('tonic','root','$f1+12'),
    ('activity','density','0.15+0.85*$f1'),('motion','shape','$f1'),
    ('motion','drive','2+30*$f1'),('motion','swing','0.5+0.24*$f1'),
    ('motion','divider','16-12*$f1'),('texture','feedback','0.12+0.6*$f1'),
    ('texture','decay','36-28*$f1'),('energy','duration','240-180*$f1'),
    ('melody','main','$f1'),('pad','poly','$f1'),('energy','filtered','$f1'),
    ('energy','kick','0.55*$f1'),('space','space','$f1'),('cutoff','upper','$f1'),
    ('seed','seed','$f1')]:
    r=p.obj('r '+source); gate=p.obj('spigot 0'); mode=p.obj(r'r \$1-market')
    p.chain(r,gate); p.link(mode,gate,inp=1)
    expr=p.obj('expr '+expression); send=p.obj(r's \$1-'+target); p.chain(gate,expr,send)
mode=p.obj(r'r \$1-market'); changed=p.obj('change'); zero=p.msg('0')
p.chain(mode,changed,zero,p.obj(r's \$1-run'))
# Market mode must never leave the manual reference playing while awaiting fresh controls.
p.link(zero,p.obj(r's \$1-master'))
step=p.obj(r'r \$1-step'); gate=p.obj('spigot 0')
p.chain(step,gate,p.obj('s generation')); p.link(mode,gate,inp=1)
p.write('zp-market')

p=Patch('ZERO100 / after ZeroPoint Zero - 100h',1040,735)
p.text('Vanilla Pd reconstruction / hidden Gen algorithms approximated.',25,42)
p.obj(r'bng 22 250 50 0 \$0-reset empty RESET 28 11 0 12 #ffffff #000000 #000000',25,85)
dsp=p.msg(r'\; pd dsp 1',165,85)
p.obj(r'tgl 22 0 \$0-run-edit \$0-run-ui RUN 28 11 0 12 #ffffff #000000 #000000 0 1',300,85)
p.obj(r'tgl 22 0 \$0-market \$0-market-ui MARKET 28 11 0 12 #ffffff #000000 #000000 0 1',420,85)
p.text('Click DSP message then RUN. Start quietly.',605,86)
controls=[('clock',1,24),('divider',1,32),('swing',.05,.95),('duration',5,2000),
          ('decay',1,64),('root',24,96),('upper',100,15000),('shape',0,1),
          ('drive',1,32),('delayL',2,1900),('delayR',2,1900),('feedback',0,.8),
          ('main',0,1),('poly',0,1),('filtered',0,1),('kick',0,1),
          ('density',0,1),('space',0,1),('master',0,.5),('octave',1,8)]
for i,(name,lo,hi) in enumerate(controls):
    x=25+(i%5)*200; y=145+(i//5)*62
    p.obj(f'nbx 7 18 {lo} {hi} 0 0 \\$0-{name}-edit \\$0-{name}-ui {name} 0 -10 0 12 #ffffff #000000 #000000 0 256',x,y)
# GUI tables are actual synthesis controls, not decorative animations.
p.graph(r'\$0-swing-table',SWING,0,1,25,390,450,65)
p.graph(r'\$0-ramps',[0]*32,0,1,525,390,450,65)
for i in range(3): p.graph(r'\$0-poly'+str(i+1),POLY[i],0,32,25+i*325,495,300,60)
p.graph(r'\$0-scale',SCALE,0,12,25,595,260,65)
p.graph(r'\$0-filter-hz',FILTERS,0,10032,330,595,400,65)
p.text('swing: 256 / ramps: 32 / polyrate: 3 x 32',25,680)
p.text('Open zp-engine to inspect every voice and filter.',25,703)
p.obj(r'zp-defaults \$0',780,585); engine=p.obj(r'zp-engine \$0',780,615)
dac=p.obj('dac~',935,645); p.link(engine,dac); p.link(engine,dac,out=1,inp=1)
p.obj(r'zp-market \$0',780,645)
for channel in range(2):
    receive=p.obj(r'r \$0-meter'+str(channel),760+channel*130,680)
    display=p.node('floatatom',f'7 0 0 0 {"L" if channel==0 else "R"}_dBFS - - 0',760+channel*130,710)
    p.link(receive,display)
receive=p.obj(r'r \$0-market',25,870); msg=p.msg(r'set \$1',190,870)
p.chain(receive,msg,p.obj(r's \$0-market-ui',330,870))
for name in ['run']+[row[0] for row in controls]:
    # Keep UI wiring in a small abstraction outside the main visible canvas.
    p.obj(r'zp-control \$0 '+name,25+(len(p.nodes)%5)*225,920+(len(p.nodes)//5)*28)
p.graph(r'\$0-g1',[1,3,4,2],0,8,815,1050,125,70)
p.graph(r'\$0-g2',[4,2,3,1],0,8,970,1050,125,70)
p.write('100h')

p=Patch('AV / ZERO100 local-market launcher - open this instead of av-desktop.pd',960,480)
p.obj('declare -path ../../public/patches',30,65)
p.obj('av-bridge',30,110)
p.obj('100h',30,160)
p.text('Open the 100h object. Enable MARKET and DSP there.',30,230)
p.text('localhost:4173 -> Native Pd -> choose coin -> Listen.',30,270)
p.text('Close other AV native launchers first - only one bridge may bind UDP 3001.',30,310)
p.text('The website signal-map voice names still describe Gameta - not this instrument.',30,350)
p.write('100h-market')

print('Generated', len(list(ROOT.glob('*.pd'))), 'editable Pure Data patches in', ROOT)
