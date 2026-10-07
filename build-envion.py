"""Prepare the Envion web patch while preserving the curated runtime sample pool."""
from pathlib import Path
import re,json,hashlib,shutil,struct
BASE=Path(__file__).resolve().parent
SOURCE=Path('/Users/nikoscharalampous/Downloads/envion-main')
DEST=BASE/'public/patches/envion'
DEST.mkdir(parents=True,exist_ok=True)
original=SOURCE/'___ Envion_v5.2_Plugdata.pd'
if not original.exists():
 SOURCE=DEST
 original=DEST/'original/Envion_v5.2_Plugdata.pd'
text=original.read_text()
(DEST/'original').mkdir(exist_ok=True)
if original.resolve()!=(DEST/'original/Envion_v5.2_Plugdata.pd').resolve():shutil.copy2(original,DEST/'original/Envion_v5.2_Plugdata.pd')
if SOURCE!=DEST:shutil.copy2(SOURCE/'LICENSE',DEST/'LICENSE.txt')
for folder in ['data','audio','asset']:
 # The audio pool is user-curated. Copying the downloaded source folder here
 # would silently restore every unused sample, so only refresh data/effect assets.
 if SOURCE!=DEST and folder!='audio':shutil.copytree(SOURCE/folder,DEST/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('tape_deck.pd') if folder=='asset' else None)
if SOURCE!=DEST:
 for pattern_ in ['*.gif','*.png']:
  for pic in SOURCE.glob(pattern_):shutil.copy2(pic,DEST/pic.name)
text=original.read_text()
sample_remap={
 'micro_reel.wav':'iqos-gesture.wav',
 'sample16bit-mono.wav':'file_master_profile.wav',
 'env_0001.wav':'env_0002.wav',
 'earings.wav':'env_0011.wav',
 'd_a.wav':'env_0003.wav',
 'c_b.wav':'env_0004.wav',
 'plotter_m.wav':'FFT-ethet_1.wav',
}
for old,new in sample_remap.items():text=text.replace(old,new)
canvases={};stack=[];root=None
pattern=re.compile(r'(?:\\.|[^\s])+')
def tokens(s):return [re.sub(r'\\(.)',r'\1',x) for x in pattern.findall(s)]
for line in text.splitlines():
 if line.startswith('#N struct'):continue # Saved waveform GUI structs trap the WASM build.
 if line.startswith('#N canvas'):
  cid='c'+str(len(canvases));a=tokens(line[:-1]);c={'id':cid,'name':a[6] if len(a)>7 else 'ENVION 5.2','header':line,'nodes':[],'items':[],'wires':[],'meta':[]}
  canvases[cid]=c;stack.append(c)
  if root is None:root=cid
 elif line.startswith('#X restore'):
  child=stack.pop();c=stack[-1];a=tokens(line[:-1]);n={'index':len(c['nodes']),'kind':'restore','x':float(a[2]),'y':float(a[3]),'text':' '.join(a[4:]),'args':a[4:],'child':child['id'],'line':line};c['nodes'].append(n);c['items'].append(n)
 elif stack:
  c=stack[-1]
  if line.startswith('#X connect'):c['wires'].append([int(x) for x in line[:-1].split()[2:]])
  elif line.startswith('#X declare'):c['items'].append(line)
  elif line.startswith('#X f '):
   c['items'].append(line)
   if c['nodes']:c['nodes'][-1]['widthChars']=int(tokens(line[:-1])[2])
  elif line.startswith('#X coords'):c['meta'].append(line);c['coords']=tokens(line[:-1])[2:]
  elif line.startswith('#X '):
   a=tokens(line[:-1]);kind=a[1]
   if kind in ['obj','msg','text','floatatom','symbolatom','listbox']:
    n={'index':len(c['nodes']),'kind':kind,'x':float(a[2]),'y':float(a[3]),'text':' '.join(a[4:]),'args':a[4:],'line':line}
   else:n={'index':len(c['nodes']),'kind':kind,'x':0,'y':0,'text':' '.join(a[2:]),'args':a[2:],'line':line}
   c['nodes'].append(n);c['items'].append(n)
  else:c['items'].append(line)
controls={'bng','tgl','hsl','vsl','hradio','vradio','nbx','knob'}
receivers=[]
for cid,c in canvases.items():
 for n in c['nodes']:
  op=n['args'][0] if n['args'] else ''
  if n['kind'] in ['msg','floatatom','symbolatom','listbox'] or n['kind']=='obj' and op in controls:
   n['send']=f'av-envion-ui-{cid}-{n["index"]}'
   if n['kind']!='msg':n['receive']=f'av-envion-value-{cid}-{n["index"]}';receivers.append(n['receive'])
  if n['kind']=='obj' and op=='cnv' and len(n['args'])>5 and n['args'][5] not in ['empty','-']:
   n['canvasTap']=f'{cid}-{n["index"]}'
  # Adapt only host I/O. Audio and sequencing connections remain original.
  if cid==root and n['kind']=='obj' and op=='r~' and n['index'] in [422,423]:
   target='vul' if n['index']==422 else 'vur'
   n['line']=f'#X obj {n["x"]:g} {n["y"]:g} r~ \\$0-{target};'
  if n['kind']=='obj' and op=='out~':n['line']=n['line'].replace(' out~;',' av-envion-output;')
  if n['kind']=='obj' and op in ['openpanel','savepanel']:
   n['fileRequest']=op
   n['fileMode']=n['args'][1] if len(n['args'])>1 else '0'
   n['line']=f'#X obj {n["x"]:g} {n["y"]:g} av-envion-file {cid}-{n["index"]} {op} {n["fileMode"]};'
  if n['kind']=='obj' and op=='writesf~':n['line']=f'#X obj {n["x"]:g} {n["y"]:g} av-envion-recorder;'
  if n['kind']=='obj' and op=='soundfiler':n['line']=f'#X obj {n["x"]:g} {n["y"]:g} av-envion-soundfiler;'
  if n['kind']=='obj' and op in ['key','keyup']:n['line']=f'#X obj {n["x"]:g} {n["y"]:g} r av-envion-{op};'
  if n['kind']=='obj' and op=='else/pic':
   # Browser draws these assets; retaining GUI pics wastes DSP startup on image decoders.
   n['line']=f'#X text {n["x"]:g} {n["y"]:g} Envion image (rendered in browser);'
  if n['kind']=='obj' and op=='else/knob':pass
# Retain all local materials; defer large audio until its preset is selected.
assets={str(p.relative_to(DEST)):p.stat().st_size for folder in ['audio','asset'] for p in (DEST/folder).rglob('*') if p.is_file()}
def assets_in(cid,seen=None):
 seen=set() if seen is None else seen
 if cid in seen:return set()
 seen.add(cid);result=set()
 for n in canvases[cid]['nodes']:
  for arg in n['args']:
   clean=arg.rstrip(',;')
   if clean in assets:result.add(clean)
  if n.get('child'):result|=assets_in(n['child'],seen)
 return result
for cid,c in canvases.items():
 edges={}
 for a,_,b,_ in c['wires']:edges.setdefault(a,[]).append(b)
 for n in c['nodes']:
  if not n.get('send'):continue
  seen=set();todo=[n['index']];needed=set();dialogs=[]
  while todo:
   i=todo.pop()
   if i in seen or i>=len(c['nodes']):continue
   seen.add(i);target=c['nodes'][i]
   if target.get('fileRequest'):dialogs.append(f'{cid}-{i}')
   if target.get('child'):needed|=assets_in(target['child'])
   for arg in target['args']:
    if arg in assets:needed.add(arg)
   # send/receive buses intentionally end traversal; don't load unrelated presets.
   todo.extend(edges.get(i,[]))
  if needed:n['assets']=sorted(needed)
  if dialogs:n['dialogs']=dialogs
# Named wrappers target exact source controls by saved coordinate.
rootcanvas=canvases[root]
def nodeat(x,y):return next(n['index'] for n in rootcanvas['nodes'] if n['x']==x and n['y']==y)
aliases={'main-preset':nodeat(2901,652),'row-random':nodeat(1913,668),'random-speed':nodeat(1820,682),'strike':nodeat(1668,1088),'hard-stop':nodeat(1869,1207)}
rootcanvas['aliases']=aliases

# Observe the signals already entering the original scopes. Control messages
# sharing a scope inlet are deliberately excluded (notably nodes 1100/1102).
# Channels 1/2 belong to the orchestra and 3/4 to the original recorder bridge.
scope_sources=[
 (141,[326],[5],'scope'),
 (955,[958],[6],'scope'),
 (960,[961],[7],'scope'),
 (1004,[1003],[8],'scope'),
 (1098,[1099],[9],'scope'),
 (1114,[1115,1116],[10,11],'meter'),
]
scopes=[]
for node,sources,channels,kind in scope_sources:
 for inlet,source in enumerate(sources):
  if [source,0,node,inlet] not in rootcanvas['wires']:
   raise ValueError(f'Original scope signal connection changed: {source} -> {node}:{inlet}')
 rootcanvas['nodes'][node]['scopeTap']=f'{root}-{node}'
 scopes.append({'id':f'{root}-{node}','channels':channels,'type':kind})

def render(cid):
 c=canvases[cid];lines=[c['header']];extra=[];wires=[];count=len(c['nodes'])
 for item in c['items']:
  if isinstance(item,str):lines.append(item);continue
  if item.get('child'):lines+=render(item['child'])
  lines.append(item['line'])
 for n in c['nodes']:
  if n.get('canvasTap'):
   receive=n['args'][5].replace('$',r'\$').replace(' ',r'\ ')
   extra += [f'#X obj 20 20 r {receive};',f'#X obj 20 45 list prepend {n["canvasTap"]};','#X obj 20 70 fudiformat;','#X obj 20 95 print av-envion-canvas-bytes;']
   wires += [[count,0,count+1,0],[count+1,0,count+2,0],[count+2,0,count+3,0]];count+=4
  if not n.get('send'):continue
  atom=n['kind'] in ['floatatom','symbolatom','listbox']
  source_receive=n['args'][5] if atom and n['args'][5] not in ['-','empty'] else None
  source_send=n['args'][6] if atom and n['args'][6] not in ['-','empty'] else None
  def pd_symbol(symbol):return symbol.replace('$',r'\$').replace(' ',r'\ ')
  control=count
  extra.append(f'#X obj 20 20 r {n["send"]};');count+=1
  # Gatom removes its inlet/outlet when a named receive/send is present.
  if source_receive:
   extra.append(f'#X obj 20 40 s {pd_symbol(source_receive)};');wires.append([control,0,count,0]);count+=1
  else:wires.append([control,0,n['index'],0])
  if n.get('receive'):
   tap=n['index']
   if source_send:
    extra.append(f'#X obj 20 45 r {pd_symbol(source_send)};');tap=count;count+=1
   if n['kind'] in ['symbolatom','listbox'] or (n['kind']=='obj' and n['args'][0]=='bng'):
    extra += [f'#X obj 20 45 list prepend {n["receive"]};','#X obj 20 70 fudiformat;','#X obj 20 95 print av-envion-ui-bytes;']
    wires += [[tap,0,count,0],[count,0,count+1,0],[count+1,0,count+2,0]];count+=3
   extra.append(f'#X obj 20 45 s {n["receive"]};');wires.append([tap,0,count,0]);count+=1
 if cid==root:
  for name,i in aliases.items():extra.append(f'#X obj 20 20 r av-envion-{name};');wires.append([count,0,i,0]);count+=1
  # Orphan source input buses stay silent; do not introduce recovery-file feedback.
  extra += ['#X obj 20 20 sig~ 0;','#X obj 20 45 s~ reg1;','#X obj 20 70 s~ reg2;']
  wires += [[count,0,count+1,0],[count,0,count+2,0]];count+=3
  # Parallel observations only: retain every original DSP connection unchanged.
  # The host captures these outputs for scope windows and does not mix them
  # into the audible stereo output or the recorder channels.
  extra.append('#X obj 20 95 dac~ 5 6 7 8 9 10 11;')
  for _,sources,channels,_ in scope_sources:
   wires += [[source,0,count,channel-5] for source,channel in zip(sources,channels)]
  count+=1
  # Market buy/sell balance enters the original stereo pan inlet directly.
  # Source slider 408 was unconnected in the supplied patch.
  extra.append('#X obj 20 20 r av-envion-pan-position;')
  wires.append([count,0,404,1]);count+=1
  # Announce the source namespace after subscriptions are established.
  extra += ['#X obj 20 20 r av-envion-identify;','#X obj 20 45 f \\$0;','#X obj 20 70 s av-envion-id;']
  wires += [[count,0,count+1,0],[count+1,0,count+2,0]]
 lines+=extra
 lines += ['#X connect '+' '.join(map(str,w))+';' for w in c['wires']+wires]
 lines+=c['meta'];return lines
(DEST/'main.pd').write_text('\n'.join(render(root))+'\n')
for c in canvases.values():
 for n in c['nodes']:n.pop('line',None)
 c.pop('items',None);c.pop('header',None);c.pop('meta',None)
images={}
for pic in [*DEST.glob('*.gif'),*DEST.glob('*.png')]:
 raw=pic.read_bytes()
 width,height=struct.unpack('<HH',raw[6:10]) if raw[:3]==b'GIF' else struct.unpack('>II',raw[16:24])
 images[pic.name]={'url':'patches/envion/'+pic.name,'width':width,'height':height}
model={'images':images,'root':root,'canvases':canvases,'receivers':receivers,'assets':assets,'scopes':scopes,'scopeStream':{'windowSamples':512,'frameRate':20},'sourceVersion':'Envion 5.2 PlugData','sourceSHA256':hashlib.sha256(original.read_bytes()).hexdigest()}
(DEST/'model.json').write_text(json.dumps(model,separators=(',',':')))
print('Prepared original Envion:',len(canvases),'canvases,',len(receivers),'live UI values,',len(assets),'on-demand assets')

files=[str(p.relative_to(DEST)) for p in DEST.rglob('*') if p.is_file() and ((p.suffix=='.pd' and p.name not in {'Envion_v5.2_Plugdata.pd','ENVION-Minimal.pd','tape_deck.pd'} and 'original' not in p.parts) or (p.suffix=='.txt' and p.parent==DEST/'data'))]
(DEST/'manifest.json').write_text(json.dumps({'version':2,'files':sorted(files),'initialAssets':['audio/buchla_2.wav',*sorted(x for x in assets if x.startswith('asset/') and x.endswith('.wav'))]},indent=2)+'\n')

# The automatic file workflow needs real row counts (perc has 328, not 1000).
banks=[{'path':'data/'+p.name,'rows':len([row for row in p.read_text().split(';') if row.strip()])} for p in sorted((DEST/'data').glob('*.txt'))]
(DEST/'performance-catalog.json').write_text(json.dumps({'banks':banks},indent=2)+'\n')
