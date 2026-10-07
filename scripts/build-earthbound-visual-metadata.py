"""Extract numeric background/effect metadata; no game pixels are published.
Usage: python3 scripts/build-earthbound-visual-metadata.py /path/to/reference
"""
from pathlib import Path
import json,sys,struct
source=Path(sys.argv[1]);data=(source/'data/truncated_backgrounds.dat').read_bytes()
rows=[]
def i16(d,p):return struct.unpack_from('<h',d,p)[0]
for index in range(327):
 b=data[0xDCA1+index*17:0xDCA1+(index+1)*17]
 slots=list(b[13:17]);slots=slots[1:] if slots[0]==0 else slots
 if 0 in slots:slots=slots[:slots.index(0)]
 effects=[]
 for slot in slots or [0]:
  d=data[0xF708+slot*17:0xF708+(slot+1)*17]
  effects.append([d[2] if d[2] in (1,3) else 2,int.from_bytes(d[:2],'little'),i16(d,3),i16(d,5),i16(d,8),i16(d,10),i16(d,12),d[14],i16(d,15)])
 rows.append([b[0],b[1],b[2],*b[3:9],effects])
Path('public/earthbound-layer-metadata.js').write_text('// Numeric metadata adapted from Earthbound-Battle-Backgrounds-JS.\n// [graphics,palette,bpp,cycleType,start1,end1,start2,end2,cycleSpeed,effects]\n// effect: [type,duration,frequency,amplitude,compression,freqAccel,ampAccel,speed,compressionAccel]\n// See licenses/earthbound-backgrounds.txt. No game textures.\nexport const backgroundMetadata='+json.dumps(rows,separators=(',',':'))+';\n')
print('Extracted',len(rows),'background metadata records.')
