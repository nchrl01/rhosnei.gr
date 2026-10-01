from pathlib import Path

class Patch:
    def __init__(self):
        self.nodes=[]; self.wires=[]
    def obj(self, text):
        i=len(self.nodes); self.nodes.append(f'#X obj {30+(i//18)*240} {30+(i%18)*32} {text};'); return i
    def msg(self, text):
        i=len(self.nodes); self.nodes.append(f'#X msg {30+(i//18)*240} {30+(i%18)*32} {text};'); return i
    def link(self,a,b,out=0,inp=0): self.wires.append(f'#X connect {a} {out} {b} {inp};')
    def chain(self,*nodes):
        for a,b in zip(nodes,nodes[1:]): self.link(a,b)
    def gain(self, source, receiver, level):
        r=self.obj('r '+receiver); pack=self.obj('pack f 80'); line=self.obj('line~'); mul=self.obj('*~'); trim=self.obj('*~ '+str(level))
        self.chain(r,pack,line); self.link(source,mul); self.link(line,mul,inp=1); self.chain(mul,trim); return trim
    def write(self):
        Path('public/patches/market.pd').write_text('\n'.join(['#N canvas 0 0 1440 1000 12;',*self.nodes,*self.wires])+'\n')

p=Patch()
note=p.obj('r note'); hz=p.obj('mtof'); freq=p.obj('sig~'); osc=p.obj('osc~'); p.chain(note,hz,freq,osc)
hit=p.obj('r pluck'); envmsg=p.msg(r'1 3 \, 0 1400 3'); env=p.obj('vline~'); sq=p.obj('*~'); voice=p.obj('*~'); p.chain(hit,envmsg,env); p.link(env,sq); p.link(env,sq,inp=1); p.link(osc,voice); p.link(sq,voice,inp=1)
delay=p.obj('delwrite~ resonance 1000'); read=p.obj('delread~ resonance 185'); low=p.obj('lop~ 2600'); feedback=p.obj('*~ 0.52'); p.chain(voice,delay); p.chain(read,low,feedback,delay)
mel=p.gain(voice,'melody',0.28); echo=p.gain(low,'space',0.18)
root=p.obj('r root'); mtof=p.obj('mtof'); sig=p.obj('pack f 1200'); line=p.obj('line~'); a=p.obj('osc~'); ratio=p.obj('*~ 1.498'); b=p.obj('osc~'); sum_=p.obj('+~'); p.chain(root,mtof,sig,line,a); p.chain(line,ratio,b); p.link(a,sum_); p.link(b,sum_,inp=1); pad=p.gain(sum_,'pad',0.075)
bassnote=p.obj('r bassnote'); bhz=p.obj('mtof'); bo=p.obj('osc~'); ben=p.obj('r basshit'); bm=p.msg(r'1 4 \, 0 260 4'); be=p.obj('vline~'); bs=p.obj('*~'); p.chain(bassnote,bhz,bo); p.chain(ben,bm,be); p.link(bo,bs); p.link(be,bs,inp=1); bass=p.gain(bs,'bass',0.28)
kick=p.obj('r kick'); km=p.msg(r'130 0 \, 42 100'); kl=p.obj('vline~'); ko=p.obj('osc~'); ke=p.msg(r'1 2 \, 0 160 2'); kel=p.obj('vline~'); ks=p.obj('*~'); p.chain(kick,km,kl,ko); p.chain(kick,ke,kel); p.link(ko,ks); p.link(kel,ks,inp=1)
noise=p.obj('noise~'); sn=p.obj('r snare'); sm=p.msg(r'0.8 1 \, 0 130 1'); se=p.obj('vline~'); hp=p.obj('hip~ 1400'); ss=p.obj('*~'); p.chain(noise,hp,ss); p.chain(sn,sm,se); p.link(se,ss,inp=1)
hat=p.obj('r hat'); hm=p.msg(r'0.32 1 \, 0 35 1'); he=p.obj('vline~'); hh=p.obj('hip~ 6500'); hs=p.obj('*~'); p.chain(noise,hh,hs); p.chain(hat,hm,he); p.link(he,hs,inp=1)
drum=p.obj('+~'); drum2=p.obj('+~'); p.link(ks,drum); p.link(ss,drum,inp=1); p.link(drum,drum2); p.link(hs,drum2,inp=1); drums=p.gain(drum2,'drums',0.32)
catch=p.obj('catch~ mix'); hip=p.obj('hip~ 25'); clip=p.obj('clip~ -0.8 0.8'); master=p.gain(clip,'master',0.85); dac=p.obj('dac~'); p.chain(catch,hip,clip); p.link(master,dac); p.link(master,dac,inp=1)
for n in [mel,echo,pad,bass,drums]: p.link(n,p.obj('throw~ mix'))
cut=p.obj('r cutoff'); p.link(cut,low,inp=1)
p.write()
