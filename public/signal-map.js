// This view observes controls and Pd messages; it never schedules sound.
const sources=[
 ['motion','PRICE MOVEMENT','Absolute movement / 8%, clipped to 0–1. Observed swaps use a rolling 30-second window; snapshots use the 5-minute change.'],
 ['pressure','HISTORICAL INTENSITY','Latest price relative to fixed 5-minute history: return size and speed across 5 minutes, 1 hour, 6 hours and 24 hours; recent candle shocks cool with a two-hour time constant. Relative volume and liquidity turnover also contribute. Historical height alone cannot keep a quiet coin intense. Chart pan and zoom never enter the music.'],
 ['activity','TRADE ACTIVITY','Trade rate is scaled with log(1 + trades/sec) / log(21).'],
 ['volume','TRADED VOLUME','USD/sec is scaled with log(1 + USD/sec) / log(10001). Energy = volume × freshness.'],
 ['texture','LIQUIDITY','log10(liquidity USD) / 7, clipped to 0–1. Liquidity comes from snapshots.'],
 ['balance','BUY / SELL','Fraction of observed buys; snapshot fallback uses the 5-minute buy fraction.'],
 ['root','PRICE / HISTORY','MIDI root = 45 + token seed % 12 + round(12 × tanh(log(current price / earliest available open))). Missing history gives a zero offset.'],
 ['fresh','SIGNAL AVAILABILITY','A connected decoded feed uses its rolling trade window, independently of snapshot age. Snapshot-only signals stay at 1 for 20 seconds, then fade over 40 seconds. Liquidity and native USD conversion retain their last known snapshot values, with their age shown below the mix.'],
];
const stages=[
 ['arrangement','AUTO CONDUCTOR','arrangement','Market state + musical phrase → part balance','Every 32 shared clock ticks the phrase role changes. Six continuously available parts share a bounded gain budget. Effective activity and volume set the budget. Historical intensity raises effective movement/activity/volume, reduces sustained pads and wet space, and shortens percussion tails. Freshness still gates the ensemble. The conductor smooths changes by elapsed time and schedules no browser-side notes.'],
 ['clock','CLOCK','tempo','Activity + volume → tempo','80 + 70 × effective activity + 40 × effective energy + 30 × historical intensity × freshness BPM. Pd schedules a sixteenth-note tick every 15000 / BPM milliseconds.'],
 ['rules','GENOTYPE → RULE','rules','Movement → mutation','An 8-bit genotype selects one of eight rules. Motion above 0.12 perturbs a DNA bit every 16 ticks. Repeated phenotype values suppress notes.'],
 ['gestures','ENVION GESTURES × 8','gestures','Market intensity → live fragment articulation','Adapted from Envion by Emiliano Pennisi. Value/time/delay triplets shape delay-buffer reading and amplitude envelopes with vline~. Eight stereo voices reshape the live tonal and polyrhythmic material. Activity controls gesture probability; movement controls read trajectory and shortens envelopes. Liquidity extends duration. No plucked-string bank or network samples are used.'],
 ['pads','PADS × 6','pads','Liquidity + activity + volume → level','PWM voices triggered every 12 emitted melody notes. Buy fraction above 0.6 changes the third from 3 to 4 semitones. Release = 1200 + 4800 × liquidity ms. Low-pass cutoff = 900 + 3100 × liquidity + 1800 × energy Hz. Liquidity and phrase roles determine its share; historical intensity reduces sustained prominence.'],
 ['tones','TONAL LANES × 32','tones','Liquidity + movement → tonal texture','ZERO100 adaptation: staggered one-shot ramps drive 32 phase-modulated tones. The market sets density, decay, pitch register and distortion. Uses the same seven-note pitch family and phasor as the other parts. Voice pulses reflect real envelope activity above the telemetry threshold.'],
 ['poly','POLYRHYTHMS × 12','poly','Movement + activity → rhythmic complexity','Three groups of four voices use musical rate ratios derived from the shared clock. Movement changes their slower-cycle divisor. Their envelope activity is reported directly by Pd.'],
 ['filtered','RESONANT BANK × 8','filtered','Movement + volume → spectral accents','Eight resonant bands color the polyrhythmic branch after market-driven saturation. Token seed determines the band frequencies; filter Q is 8. Level is assigned within the same orchestra gain budget.'],
 ['percussion','PERCUSSION × 32','percussion','Activity + volume → hit density and level','Perc Generator adaptation: two 16-voice banks share the master clock. Notes stay in the ensemble pitch family; weighted note transitions choose the second bank. Activity controls gate probability, movement controls FM color, and liquidity controls decay and delay feedback. Uses synthesized percussion.'],
 ['cartridge','WERSI BANK / 20 PATCHES','cartridge','Original local ROM waves → market-selected voices','Optional browser cartridge part. Linked ROM voice definitions and band-limited wave-table oscillators follow actual Gameta note events. Market movement/liquidity select the sound family; activity and volume allocate 20% of the shared gain budget. Envelopes, register splits, detune units and filter behavior are approximate. Its voice flashes are actual Web Audio note starts. Pd L/R meters measure the Pd branch; the sketch spectrum includes the full browser mix.'],
 ['space','STEREO DELAYS','space','Liquidity → depth and feedback','Gameta taps remain at 263 / 431 ms. ZERO100 taps move with liquidity. Percussion delay is 250 + 500 × liquidity ms. Wet gain, damping and feedback stay bounded. All branches feed one stereo master.'],
];
const links={pressure:['arrangement','clock','gestures','pads','tones','percussion','space'],motion:['cartridge','arrangement','rules','gestures','tones','poly','filtered','percussion'],activity:['cartridge','arrangement','clock','gestures','pads','tones','poly','percussion'],volume:['cartridge','arrangement','clock','gestures','pads','tones','poly','filtered','percussion'],texture:['cartridge','arrangement','gestures','pads','tones','space','percussion'],balance:['pads','tones'],root:['pads','tones','poly','percussion','cartridge'],fresh:['cartridge','arrangement','gestures','pads','tones','poly','filtered','percussion','space']};
export function createFeedbackMonitor(now=()=>performance.now()){
 let lastBeat=null,generation=null,transport=null;
 return {
  observe(name,value){if(name==='generation'&&value!==generation){generation=value;lastBeat=now();}},
  setTransport(state){transport=state;},
  status(){if(transport?.connected===false)return 'DISCONNECTED';if(transport?.running===false)return 'ENGINE STOPPED';return lastBeat===null?'AWAITING FEEDBACK':now()-lastBeat>1500?'STALE FEEDBACK':'ENGINE FEEDBACK';},
  reset(){lastBeat=null;generation=null;transport=null;},
 };
}
export function createSignalMap(container){
 container.innerHTML=`<div class="signal-map-heading"><span>AUTO ORCHESTRA / SIGNAL PATCH</span><span data-status>PAUSED · CONTROL PREVIEW</span></div><p class="signal-map-help">Click a box to trace its connections. All parts are automatic; this view does not switch instruments. Percentages are gains; pulses come from engine events.</p><div class="signal-board"><svg class="signal-wires" aria-hidden="true"></svg><div class="signal-column"><small>MARKET SIGNALS · NORMALIZED</small>${sources.map(([id,label])=>`<button type="button" class="signal-node" data-node="${id}" aria-pressed="false"><span>${label}</span><output data-value="${id}">—</output><i class="signal-bar" aria-hidden="true"></i></button>`).join('')}</div><div class="signal-column"><small>ONE ENSEMBLE / AUTOMATIC PARTS</small>${stages.map(([id,label,value,caption])=>`<button type="button" class="signal-node" data-node="${id}" aria-pressed="false"><span>${label}</span><output data-value="${value}">—</output><small>${caption}</small></button>`).join('')}</div><div class="signal-column signal-output"><small>OUTPUT</small><button type="button" class="signal-node" data-node="output" aria-pressed="false"><span>STEREO / MASTER</span><output data-value="master">—</output><output data-value="output-level">Awaiting audio meters</output><small>Listening volume / measured output</small></button><p>Pd ensemble + local cartridge → browser mix → measured output.</p><p data-events>No Pd events received</p></div></div><div class="signal-inspector" role="status" aria-live="polite">Click a market signal or sound stage to inspect its mapping.</div><p class="signal-map-help">The reference patches are adaptations. ZENOLOGY remains an optional local plugin companion.</p>`;
 const board=container.querySelector('.signal-board'),svg=container.querySelector('svg'),buttons=[...container.querySelectorAll('[data-node]')],nodes=new Map(buttons.map(b=>[b.dataset.node,b]));
 for(const [id,count] of [['gestures',8],['pads',6],['tones',32],['poly',12],['percussion',32],['cartridge',20]]){const row=document.createElement('span');row.className='signal-voice-row';row.setAttribute('aria-label',`${count} ${id==='cartridge'?'cartridge patches':'individual '+id+' voices'}`);for(let i=0;i<count;i++){const voice=document.createElement('span');voice.dataset.voice=String(i);voice.textContent=String(i+1).padStart(2,'0');voice.title=`${id} voice ${i+1}`;row.append(voice);}nodes.get(id).append(row);}
 let selected=null,latest={},eventState={},counts={note:0,pad:0,percussion:0};
 const feedback=createFeedbackMonitor();
 const edges=[...Object.entries(links).flatMap(([from,tos])=>tos.map(to=>[from,to])),['clock','rules'],['clock','tones'],['clock','poly'],['clock','percussion'],['clock','gestures'],['tones','gestures'],['poly','gestures'],['rules','pads'],...['gestures','pads','tones','poly','filtered','percussion','cartridge'].map(id=>[id,'output']),['space','output']];
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
 for(const b of buttons)b.onclick=()=>{selected=selected===b.dataset.node?null:b.dataset.node;trace();const description=sources.find(s=>s[0]===selected)?.[2]||stages.find(s=>s[0]===selected)?.[4]||(selected==='output'?'Master controls listening volume only. Stage percentages are gain controls. L/R dBFS meters measure actual post-master Pd output; voice pulses reflect triggers or envelope activity, not loudness.':'Click a market signal or sound stage to inspect its mapping.');container.querySelector('.signal-inspector').textContent=description;};
 const resize=new ResizeObserver(layout);resize.observe(board);
 const set=(id,text)=>{container.querySelector(`[data-value="${id}"]`).textContent=text;};
 function update({m,levels,orchestra,cartridge,bpm,root,master,playing,native}){
  latest={playing,native};
  for(const [id] of sources){const value=id==='root'?root:(m.raw?.[id]??m[id]);set(id,id==='root'?`MIDI ${root}`:`${value.toFixed(3)} / ${Math.round(value*100)}%`);nodes.get(id).style.setProperty('--signal-value',`${Math.max(0,Math.min(1,value))*100}%`);}
  set('tempo',`${bpm} BPM / ${(15000/bpm).toFixed(0)} ms`);
  set('cartridge',cartridge?.loaded?`${cartridge.name||'Awaiting note'} · ${Math.round(cartridge.level*100)}%`:'Load local cartridge to add voices');
  set('arrangement',`${orchestra.state} · phrase ${orchestra.phrase+1}/4`);
  set('gestures',`${Math.round(levels.melody*100)}% · ${(45+280*m.texture*(1-.75*m.motion)).toFixed(0)} ms gestures`);
  set('pads',`${Math.round(levels.pad*100)}% · ${(1200+4800*m.texture).toFixed(0)} ms release`);
  set('tones',`${Math.round(levels.tones*100)}% · density ${(orchestra.parameters.density??0).toFixed(2)}`);
  set('poly',`${Math.round(levels.poly*100)}% · divisor ${(orchestra.parameters.divider??8).toFixed(1)}`);
  set('filtered',`${Math.round(levels.filtered*100)}% · drive ${(orchestra.parameters.drive??2).toFixed(1)}`);
  set('percussion',`${Math.round(levels.percussion*100)}% · ${(orchestra.parameters['perc-decay']??160).toFixed(0)} ms decay`);
  set('space',`${Math.round(levels.space*100)}% wet · percussion ${(orchestra.parameters['perc-delay']??500).toFixed(0)} ms`);
  set('master',playing?`${Math.round(master*100)}%`:'0% · paused');
  container.querySelector('[data-status]').textContent=!playing?'PAUSED · CONTROL PREVIEW':`${native?'NATIVE':'BROWSER'} PD · ${feedback.status()}`;
  if(!playing){for(const b of container.querySelectorAll('.signal-pulse'))b.classList.remove('signal-pulse');set('output-level','Muted · paused');}
 }
 function receive(name,value){
  if(!latest.playing||!Number.isFinite(value))return;feedback.observe(name,value);eventState[name]=value;
  const group={'av-wersi-voice':'cartridge','av-envion-voice':'gestures','av-pad-voice':'pads','av-tone-voice':'tones','av-poly-voice':'poly','av-perc-voice':'percussion'}[name];
  if(!latest.native&&group){const voice=nodes.get(group).querySelector(`[data-voice="${value}"]`);if(voice){voice.classList.remove('signal-pulse');void voice.offsetWidth;voice.classList.add('signal-pulse');}}
  if(name==='av-perc-voice'&&!latest.native)counts.percussion++;
  if(name==='av-output-left'||name==='av-output-right')set('output-level',`Pd L ${(eventState['av-output-left']??-100).toFixed(1)} / R ${(eventState['av-output-right']??-100).toFixed(1)} dBFS`);
  if(!latest.native&&(name==='note'||name==='pad-note')){counts[name==='note'?'note':'pad']++;const b=nodes.get(name==='note'?'rules':'pads');b.classList.remove('signal-pulse');void b.offsetWidth;b.classList.add('signal-pulse');}
  set('rules',`DNA ${eventState['av-dna']??'—'} / rule ${eventState['av-codon']??'—'} / state ${eventState['av-phenotype']??'—'}`);
  container.querySelector('[data-events]').textContent=latest.native?`Native state sampled every 250 ms. Last melody: ${eventState.note??'—'} / pad: ${eventState['pad-note']??'—'} MIDI. Shared clock: ${eventState.generation??'—'}.`:`Received: ${counts.note} generative note events / ${counts.pad} pad notes / ${counts.percussion} percussion envelope onsets. Shared clock: ${eventState.generation??'—'}.`;
 }
 function reset(){feedback.reset();eventState={};counts={note:0,pad:0,percussion:0};for(const b of container.querySelectorAll('.signal-pulse'))b.classList.remove('signal-pulse');set('rules','Awaiting engine');set('output-level','Awaiting audio meters');container.querySelector('[data-events]').textContent='No Pd events received';}
 reset();
 return {update,receive,reset,setTransport:state=>feedback.setTransport(state)};
}
