"""Build seeded math voices and the optional Envion source."""
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

# Only these host patches belong to the Envion-only browser instrument.
active={'av-random.pd','av-conductor.pd','av-envion.pd','av-math.pd','av-math-voice.pd','market.pd'}
for path in ROOT.glob('*.pd'):
    if path.name not in active: path.unlink()

p=Patch('Seeded probability source / integer arithmetic stays below float precision limit')
incoming=p.obj('inlet',25,80);route=p.obj('route seed');state=p.obj('f 73')
seed=p.obj('expr int(abs($f1))%65521');p.chain(incoming,route);p.chain(route,seed);p.link(seed,state,inp=1)
p.link(route,state,out=1)
step=p.obj('expr (int($f1)*251+13849)%65521');split=p.obj('t f f');p.chain(state,step,split);p.link(split,state,out=1,inp=1)
scaled=p.obj(r'expr int($f1/65521*max(1 \, $f2))');p.chain(split,scaled,p.obj('outlet'))
bound=p.obj('inlet',225,80);p.link(bound,scaled,inp=1)
lb=p.obj('loadbang');arg=p.obj(r'f \$1');p.chain(lb,arg);p.link(arg,scaled,inp=1)
p.write('av-random')

p=Patch('Envion market clock / sixteenth notes at 15000 divided by market BPM')
run=p.obj('r run');change=p.obj('change');metro=p.obj('metro 125');p.chain(run,change,metro)
tempo=p.obj('r tempo');interval=p.obj(r'expr 15000/max(10 \, $f1)');p.chain(tempo,interval);p.link(interval,metro,inp=1)
p.chain(metro,p.obj('s av-tick'))
counter=p.obj('f 0');increment=p.obj('+ 1');split=p.obj('t f f');p.chain(metro,counter,increment,split);p.link(split,counter,out=1,inp=1);p.chain(split,p.obj('s generation'))
seed=p.obj('r seed');reset=p.msg('0');p.chain(seed,reset);p.link(reset,counter,inp=1)
p.write('av-conductor')

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
# Market density chooses a deterministic sixteenth-note division. No random
# speed or row draws can override the frame's envelope and playback controls.
counter=p.obj('f 0');increment=p.obj('+ 1');split=p.obj('t f f')
p.chain(market_gate,counter,split);p.link(split,increment,out=1);p.link(increment,counter,inp=1)
division=p.obj('mod 8');density=p.obj('r av-envion-density');p.chain(split,division);p.link(density,division,inp=1)
hit=p.obj('sel 0');p.chain(division,hit)
row=p.obj('f 0');advance=p.obj('+ 1');row_split=p.obj('t f f');p.chain(hit,row,advance,row_split);p.link(row_split,row,out=1,inp=1)
base=p.obj('r av-envion-row-base');add=p.obj('+');wrap=p.obj('mod 1000');p.chain(row_split,add,wrap,p.obj('s av-envion-ui-c0-15'));p.link(base,add,inp=1)
row_count=p.obj('r av-envion-row-count');p.link(row_count,wrap,inp=1)
seed=p.obj('r seed');reset=p.msg('0');p.chain(seed,reset);p.link(reset,counter,inp=1);p.link(reset,row,inp=1)
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


p=Patch('AV / seeded math voices + optional Envion / stereo master')
p.obj('av-conductor');source=p.obj('av-envion')
maths=p.obj('av-math')
level=p.signal('melody');running=p.signal('run');master=p.signal('master')
for channel,side in enumerate(['left','right']):
    market=p.obj('*~');p.link(source,market,out=channel);p.link(level,market,inp=1)
    mixed=p.obj('+~');p.link(market,mixed);p.link(maths,mixed,out=channel,inp=1)
    gate=p.obj('*~');p.link(mixed,gate);p.link(running,gate,inp=1)
    output=p.obj('*~');p.link(gate,output);p.link(master,output,inp=1)
    limit=p.obj('clip~ -0.85 0.85');p.chain(output,limit,p.obj('dac~ '+str(channel+1)))
    p.chain(limit,p.obj('s~ av-output-'+str(channel)))
    p.chain(limit,p.obj('env~ 4096'),p.obj('- 100'),p.obj('s av-output-'+side))
p.write('market')
files=sorted(active)
(ROOT/'manifest.json').write_text(json.dumps({'version':17,'entry':'market.pd','files':files,'layers':['melody','math-0','math-1','math-2','math-3','math-4']},indent=2)+'\n')
print('Built market instrument:',len(files),'host Pd files')
