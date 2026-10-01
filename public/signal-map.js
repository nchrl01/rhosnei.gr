// This view observes controls and Pd messages; it never schedules sound.
const sources=[
 ['motion','PRICE MOVEMENT','Absolute movement / 8%, clipped to 0–1. Observed swaps use a rolling 30-second window; snapshots use the 5-minute change.'],
 ['activity','TRADE ACTIVITY','Trade rate is scaled with log(1 + trades/sec) / log(21).'],
 ['volume','TRADED VOLUME','USD/sec is scaled with log(1 + USD/sec) / log(10001). Energy = volume × freshness.'],
 ['texture','LIQUIDITY','log10(liquidity USD) / 7, clipped to 0–1. Liquidity comes from snapshots.'],
 ['balance','BUY / SELL','Fraction of observed buys; snapshot fallback uses the 5-minute buy fraction.'],
 ['root','PRICE / HISTORY','MIDI root = 45 + token seed % 12 + round(12 × tanh(log(current price / earliest available open))). Missing history gives a zero offset.'],
 ['fresh','DATA FRESHNESS','Snapshot freshness stays at 1 for 20 seconds, then fades to 0 over 40 seconds. This attenuates the automatic mix.'],
];
const stages=[
 ['clock','CLOCK','tempo','Activity + volume → tempo','80 + 70 × activity + 40 × energy BPM. Pd schedules a sixteenth-note tick every 15000 / BPM milliseconds.'],
 ['rules','GENOTYPE → RULE','rules','Movement → mutation','An 8-bit genotype selects one of eight rules. Motion above 0.12 perturbs a DNA bit every 16 ticks. Repeated phenotype values suppress notes.'],
 ['strings','STRINGS × 20','strings','Movement + activity + volume → level','Karplus–Strong delay strings with noise excitation. Feedback = 0.94 + 0.055 × liquidity. Melody level = (0.12 + 0.58 × movement) × √effective activity × freshness × √(volume × freshness), smoothed by 20% per update. Notes use the seven-note scale 0, 2, 3, 5, 7, 9, 10 and the market root.'],
 ['pads','PADS × 6','pads','Liquidity + activity + volume → level','PWM voices triggered every 12 emitted melody notes. Buy fraction above 0.6 changes the third from 3 to 4 semitones. Release = 1200 + 4800 × liquidity ms. Low-pass cutoff = 900 + 3100 × liquidity + 1800 × energy Hz. Pad level = 0.48 × liquidity × √effective activity × freshness × √(volume × freshness).'],
 ['space','STEREO DELAY','space','Liquidity → wet level','Left / right taps at 263 / 431 ms, low-pass feedback at 3200 Hz with a 0.24 gain. Wet level = 0.75 × liquidity × freshness, smoothed by 20% per update.'],
 ['zenology','ZENOLOGY / DRUMS','zenology','Activity + motion + energy → MIDI','Prepared native companion: activity above 0.65 adds hats; motion above 0.6 adds a snare; velocity = int(35 + 75 × energy). Kick 36, snare 38, hat 42. Kit mappings still require confirmation in ZENOLOGY. The browser engine does not contain this plugin.'],
];
const links={motion:['rules','strings','zenology'],activity:['clock','strings','pads','zenology'],volume:['clock','strings','pads','zenology'],texture:['strings','pads','space'],balance:['pads'],root:['strings','pads'],fresh:['strings','pads','space']};
export function createSignalMap(container){
 container.innerHTML=`<div class="signal-map-heading"><span>SIGNAL / SOUND PATCH</span><span data-status>PAUSED · CONTROL PREVIEW</span></div><p class="signal-map-help">Select a box to trace its connections. Values are controls; pulses are received Pd events.</p><div class="signal-board"><svg class="signal-wires" aria-hidden="true"></svg><div class="signal-column"><small>MARKET SIGNALS · NORMALIZED</small>${sources.map(([id,label])=>`<button type="button" class="signal-node" data-node="${id}" aria-pressed="false"><span>${label}</span><output data-value="${id}">—</output><i class="signal-bar" aria-hidden="true"></i></button>`).join('')}</div><div class="signal-column"><small>SOUND PRODUCTION</small>${stages.map(([id,label,value,caption])=>`<button type="button" class="signal-node ${id==='zenology'?'signal-pending':''}" data-node="${id}" aria-pressed="false"><span>${label}</span><output data-value="${value}">—</output><small>${caption}</small></button>`).join('')}</div><div class="signal-column signal-output"><small>OUTPUT</small><button type="button" class="signal-node" data-node="output" aria-pressed="false"><span>STEREO / MASTER</span><output data-value="master">—</output><small>Listening volume</small></button><p>Strings + pads → delay → high-pass 80 Hz → clip ±0.85 → master × 0.8 → stereo.</p><p data-events>No Pd events received</p></div></div><div class="signal-inspector" role="status" aria-live="polite">Select a market signal or sound stage to inspect its mapping.</div><p class="signal-map-help">ZENOLOGY is a prepared local companion. Drum audio and kit status are not reported by this web view.</p>`;
 const board=container.querySelector('.signal-board'),svg=container.querySelector('svg'),buttons=[...container.querySelectorAll('[data-node]')],nodes=new Map(buttons.map(b=>[b.dataset.node,b]));
 for(const [id,count] of [['strings',20],['pads',6]]){const row=document.createElement('span');row.className='signal-voice-row';row.setAttribute('aria-label',`${count} individual ${id} voices`);for(let i=0;i<count;i++){const voice=document.createElement('span');voice.dataset.voice=String(i);voice.textContent=String(i+1).padStart(2,'0');voice.title=`${id} voice ${i+1}`;row.append(voice);}nodes.get(id).append(row);}
 let selected=null,connected=false,latest={},eventState={},counts={note:0,pad:0},lastEvent=0;
 const edges=[...Object.entries(links).flatMap(([from,tos])=>tos.map(to=>[from,to])),['clock','rules'],['rules','strings'],['strings','pads'],['strings','output'],['pads','output'],['space','output']];
 function trace(){
  const related=new Set(selected?[selected]:[]);
  for(const [a,b] of edges)if(a===selected||b===selected){related.add(a);related.add(b);}
  for(const [id,b] of nodes){b.classList.toggle('signal-selected',id===selected);b.classList.toggle('signal-related',related.has(id));b.classList.toggle('signal-dim',!!selected&&!related.has(id));b.setAttribute('aria-pressed',String(id===selected));}
  for(const p of svg.children)p.classList.toggle('signal-wire-active',p.dataset.from===selected||p.dataset.to===selected);
 }
 function layout(){
  const r=board.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);svg.replaceChildren();
  for(const [from,to] of edges){const a=nodes.get(from).getBoundingClientRect(),b=nodes.get(to).getBoundingClientRect(),x=a.right-r.left,y=a.top+a.height/2-r.top,xx=b.left-r.left,yy=b.top+b.height/2-r.top;const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M${x},${y} C${x+30},${y} ${xx-30},${yy} ${xx},${yy}`);p.dataset.from=from;p.dataset.to=to;svg.append(p);}trace();
 }
 for(const b of buttons)b.onclick=()=>{selected=selected===b.dataset.node?null:b.dataset.node;trace();const description=sources.find(s=>s[0]===selected)?.[2]||stages.find(s=>s[0]===selected)?.[4]||(selected==='output'?'Master controls listening volume only. Stage percentages are gain controls, not measured audio loudness. Native ZENOLOGY has a separate stereo output with a 0.3 trim.':'Select a market signal or sound stage to inspect its mapping.');container.querySelector('.signal-inspector').textContent=description;};
 const resize=new ResizeObserver(layout);resize.observe(board);
 const set=(id,text)=>{container.querySelector(`[data-value="${id}"]`).textContent=text;};
 function update({m,levels,bpm,root,master,playing,native}){
  latest={playing,native};
  for(const [id] of sources){const value=id==='root'?root:m[id];set(id,id==='root'?`MIDI ${root}`:`${value.toFixed(3)} / ${Math.round(value*100)}%`);nodes.get(id).style.setProperty('--signal-value',`${Math.max(0,Math.min(1,value))*100}%`);}
  set('tempo',`${bpm} BPM / ${(15000/bpm).toFixed(0)} ms`);
  set('strings',`${Math.round(levels.melody*100)}% · feedback ${(0.94+0.055*m.texture).toFixed(3)}`);
  set('pads',`${Math.round(levels.pad*100)}% · ${(1200+4800*m.texture).toFixed(0)} ms release`);
  set('space',`${Math.round(levels.space*100)}% wet · 263 / 431 ms`);
  set('zenology','PREPARED · NOT VERIFIED');set('master',playing?`${Math.round(master*100)}%`:'0% · paused');
  container.querySelector('[data-status]').textContent=!playing?'PAUSED · CONTROL PREVIEW':`${native?'NATIVE':'BROWSER'} PD · ${connected?'ENGINE FEEDBACK':'AWAITING FEEDBACK'}`;
  if(!playing){for(const b of container.querySelectorAll('.signal-pulse'))b.classList.remove('signal-pulse');}
 }
 function receive(name,value){
  if(!latest.playing||!Number.isFinite(value))return;connected=true;eventState[name]=value;
  if(!latest.native&&(name==='av-string-voice'||name==='av-pad-voice')){const voice=nodes.get(name==='av-string-voice'?'strings':'pads').querySelector(`[data-voice="${value}"]`);if(voice){voice.classList.remove('signal-pulse');void voice.offsetWidth;voice.classList.add('signal-pulse');}}
  if(!latest.native&&(name==='note'||name==='pad-note')){counts[name==='note'?'note':'pad']++;lastEvent=performance.now();const b=nodes.get(name==='note'?'strings':'pads');b.classList.remove('signal-pulse');void b.offsetWidth;b.classList.add('signal-pulse');}
  set('rules',`DNA ${eventState['av-dna']??'—'} / rule ${eventState['av-codon']??'—'} / state ${eventState['av-phenotype']??'—'}`);
  container.querySelector('[data-events]').textContent=latest.native?`Native state sampled every 250 ms. Last melody: ${eventState.note??'—'} / pad: ${eventState['pad-note']??'—'} MIDI. Clock: ${eventState.generation??'—'}.`:`Received: ${counts.note} string notes / ${counts.pad} pad notes. Last melody: ${eventState.note??'—'} MIDI. Clock: ${eventState.generation??'—'}.`;
 }
 function reset(){connected=false;eventState={};counts={note:0,pad:0};lastEvent=0;set('rules','Awaiting engine');container.querySelector('[data-events]').textContent='No Pd events received';}
 reset();
 return {update,receive,reset};
}
