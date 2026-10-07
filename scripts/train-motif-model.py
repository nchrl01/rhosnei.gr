"""Train a small second-order interval model from licensed monophonic MIDI voices.
No runtime dependencies. python3 scripts/train-motif-model.py [files.mid ...]
"""
from pathlib import Path
from collections import Counter,defaultdict
import struct,json,sys
root=Path(__file__).resolve().parents[1]
files=[Path(p) for p in sys.argv[1:]] or sorted((root/'native/music-training').glob('*.mid'))
transitions=defaultdict(Counter);fallback=Counter();note_count=0
for path in files:
 data=path.read_bytes();pos=8+struct.unpack_from('>I',data,4)[0]
 while pos<len(data):
  tag=data[pos:pos+4];size=struct.unpack_from('>I',data,pos+4)[0];track=data[pos+8:pos+8+size];pos+=8+size
  if tag!=b'MTrk':continue
  i=0;running=None;voices=defaultdict(list)
  def varint():
   global i
   n=0
   while True:
    b=track[i];i+=1;n=(n<<7)|(b&127)
    if b<128:return n
  tick=0
  while i<len(track):
   tick+=varint();status=track[i]
   if status>=128:i+=1
   else:status=running
   if status==255:
    i+=1;length=varint();i+=length;continue
   if status in (240,247):length=varint();i+=length;continue
   running=status;kind=status&240;channel=status&15
   count=1 if kind in (192,208) else 2
   values=track[i:i+count];i+=count
   if kind==144 and values[1]>0:voices[channel].append((tick,values[0]))
  for voice in voices.values():
   pitches=[pitch for _,pitch in sorted(voice)];note_count+=len(pitches)
   intervals=[max(-12,min(12,b-a)) for a,b in zip(pitches,pitches[1:])]
   fallback.update(intervals)
   for a,b,c in zip(intervals,intervals[1:],intervals[2:]):transitions[f'{a},{b}'][c]+=1
model={'version':1,'notes':note_count,'sources':[p.name for p in files],'fallback':sorted(fallback.items()),'transitions':{k:sorted(v.items()) for k,v in sorted(transitions.items())}}
(root/'public/motif-model.js').write_text('// Second-order interval counts. See native/music-training/SOURCES.txt.\nexport const MOTIF_MODEL='+json.dumps(model,separators=(',',':'))+';\n')
print('Trained',note_count,'note onsets into',len(transitions),'interval contexts')
