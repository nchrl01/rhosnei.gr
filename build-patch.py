"""Generate AV's editable vanilla-Pd adaptation of Rolando Rampoldi's gameta.
Reference: https://www.youtube.com/watch?v=Atttrb0hoEc (CC BY video).
Independent implementation; see public/patches/REFERENCE.md for deviations.
"""
from pathlib import Path

ROOT = Path(__file__).parent / 'public' / 'patches'

class Patch:
    def __init__(self): self.nodes=[]; self.wires=[]
    def node(self, kind, text, x=None, y=None):
        i=len(self.nodes)
        x=30+(i//16)*260 if x is None else x
        y=40+(i%16)*35 if y is None else y
        self.nodes.append(f'#X {kind} {x} {y} {text};')
        return i
    def obj(self,text,x=None,y=None): return self.node('obj',text,x,y)
    def msg(self,text,x=None,y=None): return self.node('msg',text,x,y)
    def comment(self,text,x,y): return self.node('text',text,x,y)
    def link(self,a,b,out=0,inp=0): self.wires.append(f'#X connect {a} {out} {b} {inp};')
    def chain(self,*nodes):
        for a,b in zip(nodes,nodes[1:]): self.link(a,b)
    def receiver(self,name,target,inp=0):
        r=self.obj('r '+name); self.link(r,target,inp=inp); return r
    def smooth(self,name,time=80):
        r=self.obj('r '+name); pack=self.obj(f'pack f {time}'); line=self.obj('line~'); self.chain(r,pack,line); return line
    def gain(self,source,name,trim=1):
        level=self.smooth(name); mul=self.obj('*~'); scale=self.obj(f'*~ {trim}'); self.link(source,mul); self.link(level,mul,inp=1); self.chain(mul,scale); return scale
    def write(self,name):
        (ROOT/(name+'.pd')).write_text('\n'.join(['#N canvas 80 80 1280 820 12;',*self.nodes,*self.wires])+'\n')

# The two feedback loops shown in the video, with bounded market mutations.
g=Patch()
g.comment('GAMETA / market adaptation - 8-bit genotype -> codon -> musical phenotype',30,10)
clock=g.obj('inlet',30,60); dna=g.obj('f 5',30,100)
seed=g.obj('r seed',700,60); bounded=g.obj('expr int(abs($f1)) % 256',700,100); reset=g.obj('t b f',700,140); zero=g.msg('0',700,180)
g.chain(seed,bounded,reset); g.link(reset,dna,out=1,inp=1)
# The reference map is exact when mutation is zero. A mask is injected once per 16 ticks.
map_=g.obj(r'expr ((int($f1)*2 + int($f1/128) + 1) % 256) ^ if(($i3 % 16)==0 && $f2>0.12 \, (1 << int($f2*7)) \, 0)',30,150)
mutation=g.obj('r motion',850,220); generation=g.obj('r generation',850,260); g.link(mutation,map_,inp=1); g.link(generation,map_,inp=2)
order=g.obj('t f f',30,195); codon=g.obj('expr (int($f1) >> 3) & 7',30,240); prepare=g.obj('t b f',30,280); phenotype=g.obj('f 0',30,320)
g.chain(clock,dna,map_,order); g.link(order,dna,out=1,inp=1); g.link(order,g.obj('s av-dna',420,195),out=1); g.chain(order,codon,prepare); g.link(codon,g.obj('s av-codon',420,240))
# Eight rules: hold / up / down / double step / invert / xor / halve / wrapped jump.
expr=r'expr if($f2==0 \, $f1 \, if($f2==1 \, min(7 \, $f1+1) \, if($f2==2 \, max(-7 \, $f1-1) \, if($f2==3 \, min(7 \, $f1+2) \, if($f2==4 \, -$f1 \, if($f2==5 \, int($f1)^1 \, if($f2==6 \, int($f1/2) \, if($f1+4>7 \, -7+($f1+4-7) \, $f1+4))))))))'
rule=g.obj(expr,30,370); state=g.obj('t f f',30,445); change=g.obj('change -1',30,495); out=g.obj('outlet',30,550)
g.chain(prepare,phenotype,rule,state,change,out); g.link(prepare,rule,out=1,inp=1); g.link(state,phenotype,out=1,inp=1); g.link(state,g.obj('s av-phenotype',430,445),out=1)
g.link(reset,zero); g.link(zero,phenotype,inp=1); clear=g.msg('set -99',760,320); g.chain(reset,clear,change)
g.comment('Repeated states are suppressed here: holds and pauses belong to the algorithm.',30,600)
g.comment('Market volatility perturbs one DNA bit per 16 ticks. Zero volatility preserves the original map.',30,630)
g.write('av-genome')

s=Patch(); s.comment('Pd clock + rule-changing melody + six-voice harmony',30,10)
run=s.obj('r run'); metro=s.obj('metro 110'); tempo=s.obj('r tempo'); duration=s.obj(r'expr 15000 / max(40 \, $f1)'); s.chain(run,metro); s.chain(tempo,duration); s.link(duration,metro,inp=1)
tick=s.obj('t b b'); counter=s.obj('f 0'); increment=s.obj('+ 1'); count=s.obj('t f f'); gen=s.obj('s generation'); genome=s.obj('av-genome'); s.chain(metro,tick); s.link(tick,counter,out=1); s.chain(counter,count); s.link(count,increment,out=1); s.link(increment,counter,inp=1); s.link(count,gen); s.link(tick,genome)
# Quantize signed degrees into the same seven-note pitch family as AV.
quant=s.obj(r'expr 12*floor($f1/7) + if((int($f1)+14)%7==0 \, 0 \, if((int($f1)+14)%7==1 \, 2 \, if((int($f1)+14)%7==2 \, 3 \, if((int($f1)+14)%7==3 \, 5 \, if((int($f1)+14)%7==4 \, 7 \, if((int($f1)+14)%7==5 \, 9 \, 10))))))')
pitch=s.obj('+ 60'); tonic=s.obj('r tonic'); high=s.obj('+ 12'); s.chain(tonic,high); s.link(high,pitch,inp=1); s.chain(genome,quant,pitch)
ordered=s.obj('t b f'); note=s.obj('s note'); pluck=s.obj('s pluck'); s.chain(pitch,ordered); s.link(ordered,note,out=1); s.link(ordered,pluck)
# The reference changes harmony every twelve emitted notes (not every twelve clock ticks).
notecount=s.obj('f 0'); plus=s.obj('+ 1'); modulo=s.obj('% 12'); distribute=s.obj('t f f'); select=s.obj('sel 0'); s.chain(ordered,notecount,distribute); s.link(distribute,plus,out=1); s.chain(plus,modulo); s.link(modulo,notecount,inp=1); s.link(distribute,select)
root=s.obj('f 48'); s.link(tonic,root,inp=1); s.chain(select,root); triad=s.obj('t f f f'); s.chain(root,triad)
for outlet,interval in enumerate([0,3,7]):
    offset=s.obj('+ '+str(interval));
    if interval==3:
        balance=s.obj('r balance'); third=s.obj('expr 3 + ($f1 > 0.6)'); s.chain(balance,third); s.link(third,offset,inp=1)
    padnote=s.obj('s pad-note'); s.link(triad,offset,out=outlet); s.chain(offset,padnote)
seed=s.obj('r seed'); reset=s.msg('0'); s.chain(seed,reset); s.link(reset,counter,inp=1); s.link(reset,notecount,inp=1)
s.write('av-sequencer')

# Twenty polyphonic Karplus-Strong voices, matching the reference's synthesis family.
k=Patch(); k.obj('block~ 16'); inlet=k.obj('inlet'); order=k.obj('t b f'); hz=k.obj('mtof'); period=k.obj('expr 1000 / $f1'); sig=k.obj('sig~'); read=k.obj(r'delread4~ \$0-string'); low=k.obj('lop~ 6000'); feedback=k.obj('*~'); k.chain(inlet,order); k.link(order,hz,out=1); k.chain(hz,period,sig,read,low,feedback)
liquidity=k.obj('r texture'); decay=k.obj('expr 0.94 + 0.055*$f1'); pack=k.obj('pack f 200'); line=k.obj('line~'); k.chain(liquidity,decay,pack,line); k.link(line,feedback,inp=1)
noise=k.obj('noise~'); excitefilter=k.obj('lop~ 1000'); envmsg=k.msg(r'1 1 \, 0 3 1'); env=k.obj('vline~'); burst=k.obj('*~'); k.chain(noise,excitefilter,burst); k.chain(order,envmsg,env); k.link(env,burst,inp=1)
sum_=k.obj('+~'); limiter=k.obj('clip~ -0.8 0.8'); delay=k.obj(r'delwrite~ \$0-string 100'); out=k.obj('outlet~'); k.link(feedback,sum_); k.link(burst,sum_,inp=1); k.chain(sum_,limiter,delay); k.link(low,out); k.write('av-pluck')

# Six triggered PWM pad voices with long releases, replacing the previous continuous drone.
a=Patch(); inlet=a.obj('inlet'); order=a.obj('t b f'); hz=a.obj('mtof'); osc=a.obj('phasor~'); a.chain(inlet,order); a.link(order,hz,out=1); a.chain(hz,osc)
lfo=a.obj('osc~ 0.13'); width=a.obj('*~ 0.35'); center=a.obj('+~ 0.5'); pwm=a.obj('expr~ if($v1>$v2 \\, 0.5 \\, -0.5)'); a.chain(lfo,width,center); a.link(osc,pwm); a.link(center,pwm,inp=1)
texture=a.obj('r texture'); release=a.obj('expr 1200 + 4800*$f1'); duration=a.obj('f 4000'); a.chain(texture,release); a.link(release,duration,inp=1); a.link(order,duration); envelope=a.msg(r'0.5 600 \, 0 \$1 600'); ramp=a.obj('vline~'); square=a.obj('*~'); voice=a.obj('*~'); filter_=a.obj('lop~ 1800'); a.chain(duration,envelope,ramp); a.link(ramp,square); a.link(ramp,square,inp=1); a.link(pwm,voice); a.link(square,voice,inp=1); a.chain(voice,filter_); a.receiver('cutoff',filter_,1); a.link(filter_,a.obj('outlet~')); a.write('av-pad')

p=Patch(); p.comment('AV / GAMETA - adapted from Rolando Rampoldi - market-controlled Pd instrument',30,10); p.obj('av-sequencer')
note=p.obj('r note'); store=p.obj('f 60'); hit=p.obj('r pluck'); dispatch=p.msg(r'next \$1'); strings=p.obj('clone av-pluck 20'); p.link(note,store,inp=1); p.chain(hit,store,dispatch,strings); mel=p.gain(strings,'melody',2)
padnote=p.obj('r pad-note'); padmsg=p.msg(r'next \$1'); pads=p.obj('clone av-pad 6'); p.chain(padnote,padmsg,pads); pad=p.gain(pads,'pad',1)
mix=p.obj('+~'); p.link(mel,mix); p.link(pad,mix,inp=1)
write=p.obj(r'delwrite~ \$0-space 2000'); readl=p.obj(r'delread~ \$0-space 263'); readr=p.obj(r'delread~ \$0-space 431'); p.link(mix,write)
feedback=p.obj('+~'); p.link(readl,feedback); p.link(readr,feedback,inp=1); damp=p.obj('lop~ 3200'); trim=p.obj('*~ 0.24'); p.chain(feedback,damp,trim,write)
dac=p.obj('dac~')
for channel,wet in enumerate([readl,readr]):
    space=p.gain(wet,'space',0.55); together=p.obj('+~'); p.link(mix,together); p.link(space,together,inp=1); hp=p.obj('hip~ 80'); clip=p.obj('clip~ -0.85 0.85'); p.chain(together,hp,clip); master=p.gain(clip,'master',0.8); p.link(master,dac,inp=channel); p.link(master,p.obj('s~ av-output-'+str(channel)))
p.write('market')

# Native Pd receives exactly the controls produced by the local AV page.
b=Patch(); b.comment('Loopback UDP bridge: validated controls from the local AV server',30,10)
net=b.obj('netreceive -u 3001 127.0.0.1'); controls=['run','tempo','tonic','seed','activity','motion','energy','balance','texture','melody','pad','space','master','cutoff','heartbeat']
route=b.obj('route '+' '.join(controls)); b.chain(net,route)
for i,name in enumerate(controls): b.link(route,b.obj('s '+name),out=i)
# Stop audio if the local page disappears. A heartbeat comes every 150 ms while playing.
heartbeat=b.obj('r heartbeat'); order=b.obj('t b b'); stop=b.msg('stop'); watchdog=b.obj('delay 2500'); silence=b.msg(r'\; run 0 \; master 0'); b.chain(heartbeat,order); b.link(order,stop,out=1); b.chain(stop,watchdog); b.link(order,watchdog); b.chain(watchdog,silence)
alive=b.obj('netsend -u'); lb=b.obj('loadbang'); connect=b.msg('connect 127.0.0.1 3002'); b.chain(lb,connect,alive)
start=b.msg('1'); beat=b.obj('metro 1000'); ping=b.msg('send alive'); b.chain(lb,start,beat,ping,alive)
for name in ['texture','tempo','master','run','av-dna']:
    receive=b.obj('r '+name); report=b.msg(r'send '+name+r' \$1'); b.chain(receive,report,alive)
b.write('av-bridge')

# A compact native instrument with visible engine states and safe startup.
d=Patch(); d.comment('$AV / GAMETA - native Pure Data',30,20); d.comment('Genotype -> codon -> phenotype -> strings + pads',30,50)
d.obj('market',30,100); d.obj('av-bridge',180,100)
d.obj('tgl 24 0 run run-ui RUN 30 12 0 12 #ffffff #000000 #000000 0 1',30,150)
for i,(name,label) in enumerate([('master','LISTENING_VOLUME'),('motion','VOLATILITY'),('texture','LIQUIDITY'),('melody','STRINGS'),('pad','PADS'),('space','SPACE')]):
    x=30+(i//3)*300;y=220+(i%3)*70
    d.obj(f'hsl 210 20 0 {0.8 if name=="master" else 1} 0 0 {name} {name}-ui {label} 0 -9 0 12 #ffffff #000000 #000000 0 1',x,y)
    r=d.obj('r '+name,x,y+28); msg=d.msg(r'set \$1',x+85,y+28); out=d.obj('s '+name+'-ui',x+165,y+28); d.chain(r,msg,out)
for i,name in enumerate(['av-dna','av-codon','av-phenotype']):
    x=660;y=170+i*90; r=d.obj('r '+name,x,y); n=d.node('floatatom','8 0 0 0 '+name+' - - 0',x,y+35); d.link(r,n)
d.comment('LOCAL MARKET: npm start -> localhost:4173 -> choose Native Pd -> load coin -> Listen',30,465)
d.comment('Click the example message for a manual sketch. Market mode replaces its values.',30,495)
example=d.msg(r'\; tempo 150 \; tonic 48 \; seed 1917 \; motion 0 \; texture 0.7 \; melody 0.45 \; pad 0.4 \; space 0.45 \; cutoff 2200 \; master 0.2 \; run 1',30,535)
load=d.obj('loadbang',660,480); off=d.msg(r'\; run 0 \; master 0',660,520); d.chain(load,off)
r=d.obj('r run',660,570); set_=d.msg(r'set \$1',660,610); snd=d.obj('s run-ui',660,650); d.chain(r,set_,snd)
d.write('av-desktop')
