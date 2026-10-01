"""Run the real Pd patches: compare core rules and inspect rendered stereo audio."""
from pathlib import Path
import math, os, re, struct, subprocess, tempfile, wave
ROOT=Path(__file__).resolve().parents[1]
PD=os.environ.get('PD_BIN','/Applications/Pd-0.56-2.app/Contents/Resources/bin/pd')

def run(text):
    with tempfile.TemporaryDirectory(prefix='av-pd-') as tmp:
        patch=Path(tmp)/'check.pd';patch.write_text(text)
        r=subprocess.run([PD,'-nogui','-batch','-noaudio','-r','48000','-path',str(ROOT/'public/patches'),'-open',str(patch)],capture_output=True,text=True,timeout=30)
        log=r.stdout+r.stderr
        assert r.returncode==0,log
        assert not re.search(r"error:|couldn't create|connection failed|DSP loop",log,re.I),log
        return log

base='''#N canvas 0 0 800 500 12;
#X obj 20 20 market;
#X obj 20 70 loadbang;
#X msg 20 100 \\; seed 5 \\; tonic 48 \\; motion MOTION \\; texture 0.7 \\; tempo 150 \\; run 1;
#X obj 400 70 delay 3000;
#X msg 400 110 \\; pd quit;
#X obj 20 200 r av-phenotype;
#X obj 20 240 print phenotype;
#X obj 300 200 r note;
#X obj 300 240 print note;
#X connect 1 0 2 0;
#X connect 1 0 3 0;
#X connect 3 0 4 0;
#X connect 5 0 6 0;
#X connect 7 0 8 0;
'''
log=run(base.replace('MOTION','0'))
states=[int(x) for x in re.findall(r'phenotype: (-?\d+)',log)]
notes=[int(x) for x in re.findall(r'note: (-?\d+)',log)]
dna=5;pitch=0;expected=[]
for _ in states:
    dna=(dna*2+int(dna/128)+1)%256
    codon=(dna>>3)&7
    pitch=[lambda: pitch,lambda:min(7,pitch+1),lambda:max(-7,pitch-1),lambda:min(7,pitch+2),lambda:-pitch,lambda:pitch^1,lambda:int(pitch/2),lambda: -7+(pitch+4-7) if pitch+4>7 else pitch+4][codon]()
    expected.append(pitch)
assert states==expected,(states,expected)
changed=[x for i,x in enumerate(states) if i==0 or x!=states[i-1]]
quantized=[60+12*math.floor(x/7)+[0,2,3,5,7,9,10][x%7] for x in changed]
assert notes==quantized,(notes,quantized)
assert len(notes)<len(states),'Repeated states must create rests'
mutated=run(base.replace('MOTION','0.8'))
assert re.findall(r'phenotype: (-?\d+)',mutated)!=[str(x) for x in states]

with tempfile.TemporaryDirectory(prefix='av-audio-') as tmp:
    for volume in [0,.3]:
        filename=Path(tmp)/f'volume-{volume}.wav'
        render=f'''#N canvas 0 0 700 500 12;
#X obj 20 20 market;
#X obj 20 70 loadbang;
#X msg 20 100 open {filename} \\, start;
#X obj 20 300 writesf~ 2;
#X obj 20 240 r~ av-output-0;
#X obj 220 240 r~ av-output-1;
#X msg 400 100 \\; seed 5 \\; tonic 48 \\; motion 0.35 \\; texture 0.7 \\; balance 0.5 \\; tempo 150 \\; melody 0.4 \\; pad 0.4 \\; space 0.4 \\; cutoff 2500 \\; master {volume} \\; pd dsp 1 \\; run 1;
#X obj 400 200 delay 12000;
#X msg 400 240 stop;
#X obj 500 280 delay 100;
#X msg 500 320 \\; pd quit;
#X connect 1 0 2 0;
#X connect 1 0 6 0;
#X connect 1 0 7 0;
#X connect 2 0 3 0;
#X connect 4 0 3 0;
#X connect 5 0 3 1;
#X connect 7 0 8 0;
#X connect 8 0 3 0;
#X connect 7 0 9 0;
#X connect 9 0 10 0;
'''
        run(render)
        with wave.open(str(filename)) as f:
            assert f.getnchannels()==2 and f.getnframes()==576000
            data=f.readframes(f.getnframes());v=struct.unpack('<'+'h'*(len(data)//2),data)
        peak=max(map(abs,v))/32768;rms=math.sqrt(sum(x*x for x in v)/len(v))/32768
        if volume==0:assert peak==0
        else:
            assert .001<rms<.2 and peak<.5,(rms,peak)
            assert any(l!=r for l,r in zip(v[::2],v[1::2])),'Expected stereo space'
        print(f'master={volume}: RMS={rms:.5f}, peak={peak:.5f}')
print(f'PASS: {len(states)} exact reference states; {len(notes)} notes with rests; mutations; stereo render; master silence')
