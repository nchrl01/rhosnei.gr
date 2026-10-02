"""Build the standalone vanilla-Pd adaptation of ZeroPoint Zero's Perc Generator.

Shared clock/crossover/control abstractions are bundled as editable .pd files.
The source Gen code was unavailable; see README.txt for fidelity limits.
"""
from pathlib import Path
from pd_patch import Patch
from perc import build_percussion, NOTES, PROBS

ROOT = Path(__file__).resolve().parent
DEFAULTS = dict(market=0, run=0, clock=8, root=60, seed=100,
                master=.18, perc=1, **{'perc-density':1, 'perc-decay':160,
                'perc-color':.45, 'perc-delay':500, 'perc-feedback':.24})

build_percussion(Patch)

p=Patch('Perc Generator reference defaults / stop and clear before loading the preset.')
lb=p.obj('loadbang'); reset=p.obj(r'r \$1-reset'); ns=p.obj(r'f \$1')
p.link(lb,ns); p.link(reset,ns)
message=p.msg(' '.join(r'\; \$1-'+name+' '+str(value) for name,value in DEFAULTS.items()))
p.chain(ns,message)
for name,values in [('perc-notes',NOTES),('perc-probs',PROBS)]:
    msg=p.msg(' '.join(map(str,values))); arr=p.obj(r'array set \$1-'+name)
    p.link(lb,msg); p.link(reset,msg); p.chain(msg,arr)
p.write('pg-defaults')

p=Patch('Perc output / independent transport and master / actual audio meters.')
engine=p.obj(r'zp-perc \$1')
for channel in range(2):
    gain=p.obj('*~'); p.link(engine,gain,out=channel)
    p.link(p.signal(r'\$1-perc'),gain,inp=1)
    run=p.gain(gain,r'\$1-run'); master=p.gain(run,r'\$1-master')
    hp=p.obj('hip~ 20'); limit=p.obj('clip~ -0.9 0.9'); p.chain(master,hp,limit)
    p.chain(limit,p.obj('outlet~',25+channel*190,805))
    p.chain(limit,p.obj(r's~ \$1-output'+str(channel)))
    env=p.obj('env~ 2048'); db=p.obj('- 100'); p.chain(limit,env,db,p.obj(r's \$1-meter'+str(channel)))
p.write('pg-output')

p=Patch('Optional market adapter. Active musical parameters follow the AV data controls.')
for source,target,expression in [
    ('run','run','$f1'),('master','master',r'min(0.5 \, max(0 \, $f1))'),
    ('tempo','clock',r'min(24 \, max(1 \, $f1/15))'),('tonic','root','$f1+12'),
    ('activity','perc-density','0.1+1.5*$f1'),('energy','perc','0.1+0.9*$f1'),
    ('motion','perc-color','0.1+0.9*$f1'),('texture','perc-decay','45+405*$f1'),
    ('texture','perc-feedback','0.08+0.5*$f1'),('space','perc-delay','125+625*$f1'),
    ('seed','seed','$f1')]:
    r=p.obj('r '+source); gate=p.obj('spigot 0'); mode=p.obj(r'r \$1-market')
    p.chain(r,gate); p.link(mode,gate,inp=1)
    expr=p.obj('expr '+expression); p.chain(gate,expr,p.obj(r's \$1-'+target))
mode=p.obj(r'r \$1-market'); changed=p.obj('change'); zero=p.msg('0')
p.chain(mode,changed,zero,p.obj(r's \$1-run')); p.link(zero,p.obj(r's \$1-master'))
step=p.obj(r'r \$1-step'); gate=p.obj('spigot 0')
p.chain(step,gate,p.obj('s generation')); p.link(mode,gate,inp=1)
p.write('pg-market')

p=Patch('PERC GENERATOR / after ZeroPoint Zero',1010,720)
p.text('Vanilla Pd reconstruction / hidden Gen synthesis and delay algorithms approximated.',25,43)
p.obj(r'bng 22 250 50 0 \$0-reset empty RESET 28 11 0 12 #ffffff #000000 #000000',25,85)
p.msg(r'\; pd dsp 1',170,85)
p.obj(r'tgl 22 0 \$0-run-edit \$0-run-ui RUN 28 11 0 12 #ffffff #000000 #000000 0 1',310,85)
p.obj(r'tgl 22 0 \$0-market \$0-market-ui MARKET 28 11 0 12 #ffffff #000000 #000000 0 1',435,85)
p.text('DSP then RUN / start quietly.',600,87)
controls=[('clock',1,24),('root',24,96),('master',0,.5),('perc',0,1),
          ('perc-density',0,2),('perc-decay',10,1000),('perc-color',0,1),('perc-feedback',0,.75)]
for i,(name,low,high) in enumerate(controls):
    x=25+(i%4)*240; y=145+(i//4)*65
    p.obj(f'nbx 8 20 {low} {high} 0 0 \\$0-{name}-edit \\$0-{name}-ui {name} 0 -10 0 12 #ffffff #000000 #000000 0 256',x,y)
    p.obj(r'zp-control \$0 '+name,x,y+28)
# Every graph is a real shared control or live envelope buffer.
p.graph(r'\$0-perc-notes',NOTES,0,96,25,305,445,105)
p.graph(r'\$0-perc-probs',PROBS,0,1,505,305,445,105)
p.graph(r'\$0-perc-voices',[0]*32,0,1,25,465,925,80)
p.text('16 notes / 16 gate probabilities / 32 live voice envelopes',25,573)
p.text('Open zp-perc and its abstractions to inspect the complete sound path.',25,598)
p.obj(r'pg-defaults \$0',25,642); p.obj(r'zp-clock \$0',210,642)
output=p.obj(r'pg-output \$0',380,642); dac=p.obj('dac~',550,678)
p.link(output,dac); p.link(output,dac,out=1,inp=1)
p.obj(r'pg-market \$0',25,685)
panel=p.obj(r'zp-perc-panel \$0',210,685)
# Arrays are defined once in the top-level. The alternate panel receives graph
# data via the same names; it must not define a second set of arrays.
for channel in range(2):
    r=p.obj(r'r \$0-meter'+str(channel),690+channel*145,642)
    n=p.node('floatatom',f'7 0 0 0 {"L" if channel==0 else "R"}_dBFS - - 0',690+channel*145,678)
    p.link(r,n)
market=p.obj(r'r \$0-market',25,780); set_=p.msg(r'set \$1',210,780)
p.chain(market,set_,p.obj(r's \$0-market-ui',380,780))
for i,name in enumerate(['run','perc-delay']):
    p.obj(r'zp-control \$0 '+name,25,840+40*i)
p.write('perc-generator')

p=Patch('AV / Perc Generator - standalone local market launcher',980,400)
p.obj('declare -path ../../public/patches',25,70)
p.obj('av-bridge',25,115)
p.obj('perc-generator',25,160)
p.text('Open perc-generator above. Enable MARKET and DSP there.',25,235)
p.text('localhost:4173 -> Native Pd -> choose coin -> Listen.',25,270)
p.text('Only one AV bridge may bind UDP 3001. Close other native AV launchers first.',25,305)
p.write('perc-market')

print('Generated standalone Perc Generator in',ROOT)
