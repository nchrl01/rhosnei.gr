import {PIANO_MOVE_PCT} from './piano-policy.js?v=61';
// Read-only inspection of the same Pd sources and messages used for playback.
const NS='http://www.w3.org/2000/svg';
const pretty=value=>Number.isFinite(value)?Number(value.toFixed(4)).toString():String(value);
function parsePatch(source){
 const nodes=[],wires=[];let depth=0;
 for(const line of source.split('\n')){
  if(line.startsWith('#N canvas')){depth++;continue;}
  if(line.startsWith('#X restore')){depth--;if(depth!==1)continue;}
  else if(depth!==1)continue;
  const wire=line.match(/^#X connect (\d+) (\d+) (\d+) (\d+);/);
  if(wire){wires.push(wire.slice(1).map(Number));continue;}
  const node=line.match(/^#X (obj|msg|text|floatatom|symbolatom|listbox|restore) ([\d.-]+) ([\d.-]+) (.*);$/);
  if(node){const [,kind,x,y,body]=node;const label=body.replace(/\\([$,;])/g,'$1').replace(/, f \d+$/,'');nodes.push({kind,x:Number(x),y:Number(y),label,width:Math.max(54,Math.min(300,label.length*6.3+16))});}
 }
 return {nodes,wires};
}
export function createEngineView(container,{onBundle=()=>{}}={}){
 container.innerHTML=`<details class="engine-panel" open><summary>LIVE ENGINE / PURE DATA</summary><p class="engine-note">EarthBound instruments use sampled Web Audio. The diagram below shows the optional Pure Data sources; instrument identity and live parameters are listed separately. Click a subpatch to look inside.</p><div class="engine-status"><span data-state>Paused</span><span data-feedback>No engine feedback yet</span><span data-source>Loading patch sources…</span></div><section class="engine-bundles" aria-label="Pure Data instrument bundles"><small>INSTRUMENT BUNDLES</small><p>Enable or remove an instrument. EarthBound instruments, Envion, data microtones and coin voice start enabled. Data microtones use five finite voices; holder snapshots are visual information only. Math functions keep their market-cap gates; occasional arpeggios follow the harmonic context of significant market notes.</p><div data-bundles></div></section><div class="engine-overview"><dl data-market></dl><div><small>CONTROLS SENT TO PD</small><dl data-controls></dl></div><div><small>FEEDBACK FROM PD</small><dl data-events></dl></div><div><small>VISUALS FROM MARKET + SOUND</small><dl data-visuals></dl></div></div><div class="engine-toolbar"><label>Inspect patch <select data-patch aria-label="Inspect a Pure Data patch"></select></label><button type="button" data-home>Top-level patch</button><a data-download download>Download this patch ↗︎</a></div><p class="engine-note" data-caption></p><div class="engine-graph" role="region" tabindex="0" aria-label="Scrollable read-only Pure Data patch"><svg data-graph role="img" aria-label="Pure Data objects and connections"></svg></div><details class="engine-source"><summary>Patch source</summary><pre data-code></pre></details><details class="engine-console"><summary>Pd console</summary><pre data-log>No console messages yet.</pre></details></details>`;
 const get=selector=>container.querySelector(selector),select=get('[data-patch]'),svg=get('[data-graph]');
 let files={},manifest=null,selected='market.pd',loaded=false,lastFeedback=0,lastPaint=0,view={},transport=null,disposed=false;
 const controls=new Map(),events=new Map(),messages=[],bundleState={drums:true,piano:true,math:true,envion:true,data:true,voice:true};
 const bundleLabels={drums:'Cybernetic drum network',piano:'EarthBound instrument + melodic patterns',math:'Seeded math functions / Pure Data',envion:'Envion',data:'Five data microtones / Pure Data',voice:'Coin name / Kokoro voice'};
 const bundleHost=get('[data-bundles]');
 for(const [name,label] of Object.entries(bundleLabels)){const button=document.createElement('button');button.type='button';button.dataset.bundle=name;button.onclick=()=>{bundleState[name]=!bundleState[name];button.setAttribute('aria-pressed',String(bundleState[name]));button.textContent=(bundleState[name]?'Remove ':'Restore ')+label;onBundle(name,bundleState[name]);};button.setAttribute('aria-pressed',String(bundleState[name]));button.textContent=(bundleState[name]?'Remove ':'Restore ')+label;bundleHost.append(button);}
 const row=(name,value)=>{const fragment=document.createDocumentFragment(),term=document.createElement('dt'),definition=document.createElement('dd');term.textContent=name;definition.textContent=value;fragment.append(term,definition);return fragment;};
 const table=(selector,items)=>{const node=get(selector);node.replaceChildren(...items.map(([name,value])=>row(name,value)));};
 function draw(name){
  if(!files[name])return;selected=name;select.value=name;
  const source=files[name],{nodes,wires}=parsePatch(source);
  const width=Math.max(650,...nodes.map(n=>n.x+n.width+30)),height=Math.max(240,...nodes.map(n=>n.y+55));
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',width);svg.setAttribute('height',height);
  const title=document.createElementNS(NS,'title');title.textContent=`${name}: ${nodes.length} objects and comments, ${wires.length} stored connections`;svg.append(title);
  const ins=new Map(),outs=new Map();for(const [a,o,b,i] of wires){outs.set(a,Math.max(outs.get(a)||1,o+1));ins.set(b,Math.max(ins.get(b)||1,i+1));}
  for(const [a,o,b,i] of wires){const from=nodes[a],to=nodes[b];if(!from||!to)continue;const wire=document.createElementNS(NS,'line');wire.setAttribute('x1',from.x+5+o*(from.width-10)/Math.max(1,(outs.get(a)||1)-1));wire.setAttribute('y1',from.y+22);wire.setAttribute('x2',to.x+5+i*(to.width-10)/Math.max(1,(ins.get(b)||1)-1));wire.setAttribute('y2',to.y);wire.setAttribute('class','pd-wire');svg.append(wire);}
  for(const node of nodes){
   const group=document.createElementNS(NS,'g');group.setAttribute('transform',`translate(${node.x},${node.y})`);
   const tokens=node.label.split(/\s+/),target=node.kind==='obj'?(tokens[0]==='clone'?tokens[1]:tokens[0])+'.pd':null;
   if(target&&files[target]){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label','Open '+target);group.classList.add('pd-abstraction');group.onclick=()=>draw(target);group.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();draw(target);}};}
   if(node.kind!=='text'){const rect=document.createElementNS(NS,'rect');rect.setAttribute('width',node.width);rect.setAttribute('height',22);rect.setAttribute('class',node.kind==='msg'?'pd-message':'pd-object');group.append(rect);}
   const label=document.createElementNS(NS,'text');label.setAttribute('x',node.kind==='text'?0:6);label.setAttribute('y',15);label.setAttribute('class',node.kind==='text'?'pd-comment':'pd-label');label.textContent=node.kind==='text'?node.label:node.label.length>44?node.label.slice(0,41)+'…':node.label;group.append(label);
   const hint=document.createElementNS(NS,'title');hint.textContent=node.label+(target&&files[target]?' — click to inspect':'');group.append(hint);svg.append(group);
  }
  get('[data-code]').textContent=source;get('[data-download]').href=(name.startsWith('envion/')?'patches/':'patches/orchestra/')+name.split('/').map(encodeURIComponent).join('/')+'?v=65';
  get('[data-caption]').textContent=`${name} · ${wires.length} connections · ${loaded&&!view.native?'sources used by this browser engine':view.native?'published preview; native patch contents cannot be read from the desktop':'published source preview'} · scroll to explore`;
 }
 function setFiles(incoming,info,isLoaded=false){
  files=Object.fromEntries(Object.entries(incoming).filter(([name,source])=>name.endsWith('.pd')&&typeof source==='string').map(([name,source])=>[name.replace(/^orchestra\//,''),source]));manifest=info;loaded=isLoaded;
  select.replaceChildren(...Object.keys(files).sort().map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;return option;}));
  get('[data-source]').textContent=`${isLoaded?'Loaded browser sources':'Published source preview'} · orchestra v${info.version} · ${info.files.length} files`;
  draw(files[selected]?selected:info.entry);
 }
 select.onchange=()=>draw(select.value);get('[data-home]').onclick=()=>draw(manifest?.entry||'market.pd');
 async function preview(){try{
  const response=await fetch('patches/orchestra/manifest.json?v=65');if(!response.ok)throw Error('Patch manifest unavailable');const info=await response.json();
  const entries=await Promise.all(info.files.map(async name=>{const r=await fetch((name.startsWith('envion/')?'patches/':'patches/orchestra/')+name.split('/').map(encodeURIComponent).join('/')+'?v=65');if(!r.ok)throw Error('Patch unavailable: '+name);return [name,await r.text()];}));
  if(!disposed&&!loaded)setFiles(Object.fromEntries(entries),info);
 }catch(error){if(!disposed&&!loaded)get('[data-source]').textContent=error.message;}}
 function paint(force=false){
  if(container.hidden)return;
  const now=performance.now();if(!force&&now-lastPaint<250)return;lastPaint=now;
  const active=view.playing;
  get('[data-state]').textContent=(view.native?'NATIVE PD':'BROWSER PD')+' · '+(active?'RUNNING':'PAUSED');
  get('[data-feedback]').textContent=!active?'Feedback paused':transport?.connected===false?'Native connection lost':lastFeedback?`${now-lastFeedback>3000?'STALE':'LIVE'} feedback · ${((now-lastFeedback)/1000).toFixed(1)}s ago`:'Awaiting engine feedback';
  const m=view.m||{},c=m.context||{},instrument=view.instrument;
  const holder=m.audience,holderAge=holder?.age;
  const holderLabel=holder?.holders!=null?Math.round(holder.holders).toLocaleString('en')+' wallets · '+(holder.countAt?(holderAge<3600000?Math.floor(holderAge/60000)+'m old':(holderAge/3600000).toFixed(1)+'h old'):'age unknown')+' · '+holder.state:m.replay?'Unavailable in candle history':'Unavailable';
  table('[data-market]',[['Market',view.coin||'Loading'],['Feed',view.feed||'Loading'],['Market cap',c.latestCap?'$'+Math.round(c.latestCap).toLocaleString('en')+(c.capEstimated?' (estimate)':''):'Unavailable'],['Liquidity',Number.isFinite(view.liquidity)?'$'+Math.round(view.liquidity).toLocaleString('en'):'Unavailable'],['Ensemble tempo',`${view.bpm||0} BPM · contextual percentage movement`],['EarthBound instrument',instrument?instrument.name+' · '+instrument.family+(instrument.fallback?' · fallback sample':' · coin seed'):'Loading'],['Melody trigger','≥'+PIANO_MOVE_PCT+'% since last note · finite patterns above $100k'],['Quiet notes',m.replay?'Zero-volume candles only · 45–60 sec spacing':'Connected decoded stream only · 45–60 sec spacing'],['Melodic voices',instrument?instrument.voices+' / 6':'—'],['Pattern',instrument?.phrase?(instrument.tempo||view.bpm)+' BPM · playing':'Rest'],['Coin voice','Whisper effect · measured other-instrument audio required'],['Instrument reverb send',instrument?Math.round(instrument.roomSend*100)+'% · instrument profile':'—'],['Room return',instrument?instrument.wetReturn.toFixed(2)+'× · decreases as market cap grows':'—'],['Data pulse density',Math.round((m.dataSignals?.density||0)*100)+'% · observed activity / contextual movement'],['Holder snapshot',holderLabel],['Wallet clusters',m.replay?'Unavailable in candle history':holder?.relationships?.weight>0?holder.relationships.clusters.length+' groups · InsightX snapshot · '+Math.round(holder.relationships.age/60000)+'m since fetched':holder?.relationships?.state||'Unavailable'],['Current viewers','Unavailable · no presence source'],['Selected notes',String(view.pianoChordCount||0)],['Historical intensity',pretty(m.music?.intensity??0)],['Snapshot age',Number.isFinite(m.snapshotAge)?(m.snapshotAge/1000).toFixed(1)+'s':'—']]);
  const v=view.visual;
  table('[data-visuals]',v?[
   ['Square size',pretty(v.pixelSize)+' px · market cap + sound'],
   ['Pattern scale',pretty(v.patternScale)+' · market structure + notes'],
   ['Grid spacing',pretty(v.cellSize)+' px · liquidity'],
   ['Density',pretty(v.patternDensity)+' · activity + melody'],
   ['Speed',pretty(v.speed)+' · movement + sound + tempo'],
   ['Size variation',pretty(v.pixelSizeJitter)+' · observed wallet-size inequality'],
   ['Edge taper',pretty(v.edgeFade)+' · market cap / fixed reference'],
   ['Local populations',pretty(v.ecosystem)+' · distributed across the field'],
   ['Audio waveform',v.waveformEnabled?'Active · actual output samples':'Rest'],
   ['Ripple intensity',pretty(v.rippleIntensityScale)+' · surge + notes'],
   ['Ripple speed',pretty(v.rippleSpeed)+' · movement + tempo'],
   ['Ripple width',pretty(v.rippleThickness)+' · flow + sound'],
   ['Liquid',v.liquid?'Active · local event disturbances':'Rest'],
   ['Liquid strength',pretty(v.liquidStrength)+' · movement + sound'],
   ['Liquid radius',pretty(v.liquidRadius)+' · liquidity + cap + flow'],
   ['Liquid wobble',pretty(v.liquidWobbleSpeed)+' · tempo + attacks'],
   ['Grain',pretty(v.noiseAmount)+' · flow + sound'],
   ['Shape / colour','Square · monochrome'],
  ]:[['Visual','Waiting for a rendered frame']]);
  table('[data-controls]',controls.size?[...controls].map(([name,value])=>[name,pretty(value)]):[['Engine','No controls sent yet']]);
  table('[data-events]',events.size?[...events].map(([name,value])=>[name,pretty(value)]):[['Engine','No feedback received yet']]);
 }
 let previewStarted=false;
 const timer=setInterval(()=>{if(document.hidden||container.hidden)return;if(!previewStarted&&!loaded){previewStarted=true;void preview();}paint();},500);
 return {
  update(next){const changed=view.native!==next.native;view=next;if(changed&&manifest){get('[data-source]').textContent=`${next.native?'Published source preview (native)':loaded?'Loaded browser sources':'Published source preview'} · orchestra v${manifest.version} · ${manifest.files.length} files`;draw(selected);}paint();},
  sent(name,value){controls.set(name,value);},
  receive(name,value){events.set(name,value);lastFeedback=performance.now();},
  log(text){messages.push(String(text).trim());if(messages.length>24)messages.shift();get('[data-log]').textContent=messages.join('\n');},
  setFiles,
  setTransport(state){transport=state;},
  reset(){events.clear();controls.clear();lastFeedback=0;transport=null;paint(true);},
  destroy(){disposed=true;clearInterval(timer);},
 };
}
