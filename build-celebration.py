"""Independent hardstyle kick adaptation; no reference audio is bundled."""
from pathlib import Path
import sys
BASE=Path(__file__).resolve().parent
sys.path.insert(0,str(BASE/'native'/'perc-generator'))
import pd_patch
pd_patch.ROOT=BASE/'public/patches/orchestra'
p=pd_patch.Patch('Hardstyle beats above one million cap / independent GrundTon-inspired adaptation')
tick=p.obj('r av-tick');counter=p.obj('f 0');split=p.obj('t f f');inc=p.obj('+ 1');mod=p.obj('mod 4');select=p.obj('sel 0');gate=p.obj('spigot 0');enabled=p.obj('r hardstyle-active')
p.chain(tick,counter,split,mod,select,gate,p.obj('s \\$0-hit'));p.link(split,inc,out=1);p.link(inc,counter,inp=1);p.link(enabled,gate,inp=1)
stop=p.obj('sel 0');p.chain(enabled,stop)
reset=p.obj('r seed');resetmsg=p.msg('0');p.chain(reset,resetmsg);p.link(resetmsg,counter,inp=1)
run=p.obj('r run');off=p.obj('sel 0');p.chain(run,off)
bang=p.obj('r \\$0-hit');pitch=p.msg(r'180 0 \, 48 65');pitchline=p.obj('vline~');osc=p.obj('osc~');p.chain(bang,pitch,pitchline,osc)
envelope=p.msg(r'0 0 \, 1 2 \, 0.65 55 2 \, 0 260 57');env=p.obj('vline~');p.chain(bang,envelope,env)
tone=p.obj('*~');p.link(osc,tone);p.link(env,tone,inp=1)
bp=p.obj('bp~ 280 2');boost=p.obj('*~ 4');add=p.obj('+~');p.chain(tone,bp,boost);p.link(tone,add);p.link(boost,add,inp=1)
dist=p.obj('expr~ tanh($v1*8)');p.chain(add,dist)
eq=p.obj('bp~ 1400 3');boost2=p.obj('*~ 3');add2=p.obj('+~');p.chain(dist,eq,boost2);p.link(dist,add2);p.link(boost2,add2,inp=1)
dist2=p.obj('expr~ tanh($v1*3)');final=p.obj('*~');p.chain(add2,dist2,final);p.link(env,final,inp=1)
zero=p.msg('0 15');p.chain(stop,zero,env);p.chain(off,zero);p.chain(reset,zero)
hp=p.obj('hip~ 30');trim=p.obj('*~ 0.18');p.chain(final,hp,trim)
for ch in range(2):p.chain(trim,p.obj('outlet~',25+ch*200,805))
p.write('av-hardstyle')
