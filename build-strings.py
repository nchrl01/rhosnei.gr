"""Original sustained harmonic-string ambience, not CoDiCodec inference."""
from pathlib import Path
import sys
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE/'native'/'perc-generator'))
import pd_patch
pd_patch.ROOT=BASE/'public/patches/orchestra'
p=pd_patch.Patch('Harmonic strings / original Pd ambience / market register and slow spectral drift')
root=p.obj('r tonic'); voices=[]
for i,interval in enumerate([12,19,26]):
 note=p.obj('+ '+str(interval));hz=p.obj('mtof');pack=p.obj('pack f 3500');freq=p.obj('line~');p.chain(root,note,hz,pack,freq)
 vibrato=p.obj('osc~ '+str(.09+i*.037));depth=p.obj('*~ '+str(.3+i*.12));tuned=p.obj('+~');p.chain(vibrato,depth);p.link(freq,tuned);p.link(depth,tuned,inp=1)
 phase=p.obj('phasor~');p.chain(tuned,phase)
 wave=p.obj('expr~ sin($v1*6.283185)+0.32*sin($v1*12.56637)+0.18*sin($v1*25.13274)+0.09*sin($v1*43.9823)');p.chain(phase,wave)
 breath=p.obj('osc~ '+str(.031+i*.012));amp=p.obj('*~ 0.12');offset=p.obj('+~ 0.24');out=p.obj('*~');p.chain(breath,amp,offset);p.link(wave,out);p.link(offset,out,inp=1);voices.append(out)
mix=p.obj('+~');p.link(voices[0],mix);p.link(voices[1],mix,inp=1);sum_=p.obj('+~');p.link(mix,sum_);p.link(voices[2],sum_,inp=1)
filter_=p.obj('lop~ 2400');p.chain(sum_,filter_);texture=p.obj('r texture');cut=p.obj('expr 1100+4000*$f1');p.chain(texture,cut);p.link(cut,filter_,inp=1)
write=p.obj('delwrite~ \\$0-air 1600');p.chain(filter_,write)
for ch,ms in enumerate([371,533]):
 delay=p.obj('delread~ \\$0-air '+str(ms));wet=p.obj('*~ 0.45');summed=p.obj('+~');p.chain(delay,wet);p.link(filter_,summed);p.link(wet,summed,inp=1)
 gain=p.signal('ambience');scaled=p.obj('*~');p.link(summed,scaled);p.link(gain,scaled,inp=1);trim=p.obj('*~ 0.2');p.chain(scaled,trim,p.obj('outlet~',25+ch*200,805))
p.write('av-strings')
