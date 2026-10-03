"""Build Envion, seeded math voices and an original market data microtone set."""
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

# Browser host patches; the Envion source and math abstractions are separate.
active={'av-random.pd','av-conductor.pd','av-envion.pd','av-math.pd','av-math-voice.pd','av-data.pd','av-data-pulse.pd','av-data-low.pd','market.pd'}
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


p=Patch('Data microvoice / high ticks, middle sine pulses and band noise / args: pitch factor, duration, noise trim, sine trim',width=1800,height=1000)
hit=p.obj('inlet');duration=p.obj(r'f \$2');duration_factor=p.obj('r data-duration');stretch=p.obj('* 1');envelope=p.msg(r'0 1 \, 1 2 1 \, 0 \$1 3');shape=p.obj('vline~');square=p.obj('*~')
p.chain(hit,duration,stretch,envelope,shape);p.link(duration_factor,stretch,inp=1);p.link(shape,square);p.link(shape,square,inp=1)
pitch=p.obj('r data-pitch');hz=p.obj('mtof');factor=p.obj(r'* \$1');smooth=p.obj('pack f 40');frequency=p.obj('line~');osc=p.obj('osc~')
p.chain(pitch,hz,factor,smooth,frequency,osc)
drive=p.signal('data-drive',80);driven=p.obj(r'expr~ tanh($v1*$v2)/(tanh($v2)+0.000001)');p.link(osc,driven);p.link(drive,driven,inp=1)
sine_trim=p.obj(r'*~ \$4');p.chain(driven,sine_trim)
noise=p.obj('noise~');band=p.obj('bp~ 3000 4');cut=p.obj('r data-filter');p.chain(noise,band);p.link(cut,band,inp=1)
noise_level=p.signal('data-noise',80);noise_gain=p.obj('*~');p.link(band,noise_gain);p.link(noise_level,noise_gain,inp=1)
trim=p.obj(r'*~ \$3');p.chain(noise_gain,trim);mix=p.obj('+~');p.link(sine_trim,mix);p.link(trim,mix,inp=1)
lowpass=p.obj('lop~ 8400');highpass=p.obj('hip~ 80');window=p.obj('*~');p.chain(mix,lowpass,highpass,window);p.link(square,window,inp=1)
level=p.signal('data-level',80);scaled=p.obj('*~');p.link(window,scaled);p.link(level,scaled,inp=1)
for side in ['left','right']:
 pan=p.signal('data-pan-'+side,80);output=p.obj('*~');p.link(scaled,output);p.link(pan,output,inp=1);p.chain(output,p.obj('outlet~'))
run=p.obj('r run');stop=p.obj('sel 0');off=p.msg('0 15');p.chain(run,stop,off,shape)
enabled=p.obj('r data-enabled');sel=p.obj('sel 0');p.chain(enabled,sel);p.link(sel,off)
seed=p.obj('r seed');p.chain(seed,off)
# Silence the old transient before changing oscillator phase or noise state.
reset_bang=p.obj('t b');reset_delay=p.obj('delay 20');reset_phase=p.msg('0');p.chain(seed,reset_bang,reset_delay,reset_phase);p.link(reset_phase,osc,inp=1)
seed_math=p.obj(r'expr (int(abs($f1))+int($f2*997))%65521');seed_factor=p.obj(r'f \$1');load=p.obj('loadbang');p.chain(load,seed_factor);p.link(seed_factor,seed_math,inp=1)
seed_pipe=p.obj('pipe 20');noise_seed=p.msg(r'seed \$1');p.chain(seed,seed_math,seed_pipe,noise_seed,noise)
p.write('av-data-pulse')

p=Patch('Low data cluster / three related sines / finite activity-gated pulse, not a recurring kick',width=1500,height=1000)
hit=p.obj('inlet');shape=p.obj('vline~');envelope=p.msg(r'0 1 \, 1 5 1 \, 0 230 6');p.chain(hit,envelope,shape)
pitch=p.obj('r data-root');mtof=p.obj('mtof');frequency=p.obj('pack f 60');hz=p.obj('line~');p.chain(pitch,mtof,frequency,hz)
oscillators=[]
for multiple in [1,2,4]:
 factor=p.obj('*~ '+str(multiple));osc=p.obj('osc~');p.chain(hz,factor,osc);oscillators.append(osc)
pair=p.obj('+~');all_sines=p.obj('+~');p.link(oscillators[0],pair);p.link(oscillators[1],pair,inp=1);p.chain(pair,all_sines);p.link(oscillators[2],all_sines,inp=1)
trim=p.obj('*~ 0.32');rounding=p.obj('clip~ -0.7 0.7');lowpass=p.obj('lop~ 260');highpass=p.obj('hip~ 25');p.chain(all_sines,trim,rounding,lowpass,highpass)
window=p.obj('*~');p.chain(highpass,window);p.link(shape,window,inp=1)
level=p.signal('data-level',80);scaled=p.obj('*~');p.chain(window,scaled);p.link(level,scaled,inp=1)
for side in ['left','right']:
 pan=p.signal('data-pan-'+side,80);output=p.obj('*~');p.link(scaled,output);p.link(pan,output,inp=1);p.chain(output,p.obj('outlet~'))
off=p.msg('0 15');p.chain(off,shape)
for name in ['run','data-enabled']:
 receive=p.obj('r '+name);zero=p.obj('sel 0');p.chain(receive,zero,off)
seed=p.obj('r seed');p.chain(seed,off);bang=p.obj('t b');delay=p.obj('delay 20');phase=p.msg('0');p.chain(seed,bang,delay,phase)
for osc in oscillators:p.link(phase,osc,inp=1)
p.write('av-data-low')

p=Patch('Original market data set / Ikeda and Sound Simulator principles / seeded microtones, sine clusters, noise',width=1800,height=1100)
tick=p.obj('r av-tick');probability=p.obj('av-random 10000');threshold=p.obj('<');density=p.obj('r data-density');percent=p.obj('* 10000');hit=p.obj('sel 1');gate=p.obj('spigot 0');enabled=p.obj('r data-enabled')
p.chain(tick,probability,threshold,hit,gate);p.chain(density,percent);p.link(percent,threshold,inp=1);p.link(enabled,gate,inp=1)
trade=p.obj('r data-trade');p.chain(trade,gate)
choice=p.obj('av-random 5');reported=p.obj('t f f');routes=p.obj('sel 0 1 2 3 4');onset=p.obj('s data-onset');p.chain(gate,choice,reported);p.link(reported,routes,out=1);p.chain(reported,onset)
voices=[p.obj('av-data-pulse 4 12 0.05 0.8'),p.obj('av-data-pulse 0.5 170 0.05 0.7'),p.obj('av-data-pulse 2 26 2.5 0.05'),p.obj('av-data-pulse 1 70 0.08 0.8'),p.obj('av-data-low')]
for i,voice in enumerate(voices):p.link(routes,voice,out=i)
seed=p.obj('r seed');seed_msg=p.msg(r'seed \$1');p.chain(seed,seed_msg);p.link(seed_msg,probability);p.link(seed_msg,choice)
# Tolerate the ordinary one-second timer cadence in background browser tabs.
# Explicit pause/seek/removal still closes immediately; a stalled controller
# cannot leave this set running indefinitely.
split=p.obj('t f b');heartbeat=p.obj('t b b');cancel=p.msg('stop');watchdog=p.obj('delay 2500');timeout=p.msg('0');pack=p.obj('pack f 120');safety=p.obj('line~')
p.chain(enabled,split);p.chain(split,pack,safety);p.link(split,heartbeat,out=1);p.link(heartbeat,cancel,out=1);p.chain(cancel,watchdog);p.chain(heartbeat,watchdog,timeout,pack)
for channel in range(2):
 mixed=voices[0];source_out=channel
 for voice in voices[1:]:
  addition=p.obj('+~');p.link(mixed,addition,out=source_out);p.link(voice,addition,out=channel,inp=1);mixed=addition;source_out=0
 output=p.obj('*~');p.link(mixed,output,out=source_out);p.link(safety,output,inp=1);p.chain(output,p.obj('outlet~'))
p.write('av-data')

p=Patch('AV / Envion + seeded math + market data set / stereo master')
p.obj('av-conductor');source=p.obj('av-envion')
maths=p.obj('av-math')
data=p.obj('av-data')
level=p.signal('melody');running=p.signal('run');master=p.signal('master')
for channel,side in enumerate(['left','right']):
    market=p.obj('*~');p.link(source,market,out=channel);p.link(level,market,inp=1)
    mixed=p.obj('+~');p.link(market,mixed);p.link(maths,mixed,out=channel,inp=1)
    all_sources=p.obj('+~');p.link(mixed,all_sources);p.link(data,all_sources,out=channel,inp=1)
    gate=p.obj('*~');p.link(all_sources,gate);p.link(running,gate,inp=1)
    output=p.obj('*~');p.link(gate,output);p.link(master,output,inp=1)
    limit=p.obj('clip~ -0.85 0.85');p.chain(output,limit,p.obj('dac~ '+str(channel+1)))
    p.chain(limit,p.obj('s~ av-output-'+str(channel)))
    p.chain(limit,p.obj('env~ 4096'),p.obj('- 100'),p.obj('s av-output-'+side))
p.write('market')
files=sorted(active)
(ROOT/'manifest.json').write_text(json.dumps({'version':22,'entry':'market.pd','files':files,'layers':['melody','math-0','math-1','math-2','math-3','math-4','data']},indent=2)+'\n')
print('Built market instrument:',len(files),'host Pd files')
