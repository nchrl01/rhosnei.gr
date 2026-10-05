"""Extract the simple, single-zone musical presets used by the web instrument."""
import hashlib, json, struct, sys, wave, subprocess, tempfile, array, math
from pathlib import Path

source=Path(sys.argv[1])
data=source.read_bytes()
chunks={}
def walk(start,end):
 while start+8<=end:
  tag=data[start:start+4];size=struct.unpack_from('<I',data,start+4)[0]
  if tag in (b'RIFF',b'LIST'):walk(start+12,start+8+size)
  else:chunks[tag]=data[start+8:start+8+size]
  start+=8+size+(size&1)
walk(0,len(data))
def rows(tag,fmt):return list(struct.iter_unpack(fmt,chunks[tag]))
ph=rows(b'phdr','<20sHHHIII');pb=rows(b'pbag','<HH');pg=rows(b'pgen','<HH')
ins=rows(b'inst','<20sH');ib=rows(b'ibag','<HH');ig=rows(b'igen','<HH')
headers=rows(b'shdr','<20sIIIIIBbHH')
dest=Path(__file__).resolve().parents[1]/'public/samples/earthbound-drums'
dest.mkdir(parents=True,exist_ok=True)
files=[]
base_programs={0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,23,24,25,27,28,29,30,31,34,35,36,37,38}
extra_programs={2,11,12,17,18,19,28,41,43,50}
for name,program,bank,bag,*_ in ph:
 if bank!=128 or program not in {0,5,6,13}:continue
 preset_id=bank*128+program
 preset=dict(pg[pb[bag][0]:pb[bag+1][0]])
 instrument=preset[41];zone=ins[instrument][1]
 assert ins[instrument+1][1]==zone+1
 gen=dict(ig[ib[zone][0]:ib[zone+1][0]])
 assert set(gen)<=set([38,53,54]),'Unsupported soundfont generators'
 sample,start,end,loop_start,loop_end,rate,root,correction,link,kind=headers[gen[53]]
 assert kind==1
 filename=f'preset-{preset_id}.wav'
 with tempfile.TemporaryDirectory() as tmp:
  raw=Path(tmp)/'source.wav'
  with wave.open(str(raw),'wb') as out:
   out.setnchannels(1);out.setsampwidth(2);out.setframerate(rate)
   out.writeframes(chunks[b'smpl'][start*2:end*2])
  # Reserve headroom before resampling so reconstruction peaks cannot clip.
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-af','volume=0.8','-ar','22050',str(dest/filename)],check=True)
 with wave.open(str(dest/filename),'rb') as audio:
  output_rate=audio.getframerate();pcm=array.array('h',audio.readframes(audio.getnframes()))
 if sys.byteorder!='little':pcm.byteswap()
 peak=max(abs(n)/32768 for n in pcm)
 rms=lambda values: math.sqrt(sum((n/32768)**2 for n in values)/max(1,len(values)))
 body=rms(pcm[:min(len(pcm),int(output_rate*.3))])
 loop_pcm=pcm[round((loop_start-start)/rate*output_rate):round((loop_end-start)/rate*output_rate)]
 energy=max(body,rms(loop_pcm)*.8) if gen.get(54)==1 else body
 trim=round(min(.85,.65/max(peak,.001),.13/max(energy,.001)),6)
 files.append(dict(file=filename,midi=root,trim=trim,preset=preset_id,bank=bank,program=program,
  peak=round(peak,6),bodyRms=round(body,6),
  name=name.split(b'\0')[0].decode('latin1'),correction=correction,
  loop=gen.get(54,0)==1,loopStart=(loop_start-start)/rate,loopEnd=(loop_end-start)/rate))
manifest=dict(instrument='EarthBound percussion for cybernetic network',source=source.name,
 sourceSha256=hashlib.sha256(data).hexdigest(),license='User-supplied soundfont; no open license asserted',files=files)
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Extracted {len(files)} instruments to {dest}')
