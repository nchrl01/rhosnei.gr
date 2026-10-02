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
export function createEngineView(container){
 container.innerHTML=`<details class="engine-panel" open><summary>LIVE ENGINE / PURE DATA</summary><p class="engine-note">Read-only view of the real patch files. Click a subpatch to look inside. Controls are values sent to the engine; feedback comes back from Pd.</p><div class="engine-status"><span data-state>Paused</span><span data-feedback>No engine feedback yet</span><span data-source>Loading patch sources…</span></div><div class="engine-overview"><dl data-market></dl><div><small>CONTROLS SENT TO PD</small><dl data-controls></dl></div><div><small>FEEDBACK FROM PD</small><dl data-events></dl></div></div><div class="engine-toolbar"><label>Inspect patch <select data-patch aria-label="Inspect a Pure Data patch"></select></label><button type="button" data-home>Top-level patch</button><a data-download download>Download this patch ↗</a></div><p class="engine-note" data-caption></p><div class="engine-graph" role="region" tabindex="0" aria-label="Scrollable read-only Pure Data patch"><svg data-graph role="img" aria-label="Pure Data objects and connections"></svg></div><details class="engine-source"><summary>Patch source</summary><pre data-code></pre></details><details class="engine-console"><summary>Pd console</summary><pre data-log>No console messages yet.</pre></details></details>`;
 const get=selector=>container.querySelector(selector),select=get('[data-patch]'),svg=get('[data-graph]');
 let files={},manifest=null,selected='market.pd',loaded=false,lastFeedback=0,lastPaint=0,view={},transport=null,disposed=false;
 const controls=new Map(),events=new Map(),messages=[];
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
  get('[data-code]').textContent=source;get('[data-download]').href=(name.startsWith('envion/')?'patches/':'patches/orchestra/')+name.split('/').map(encodeURIComponent).join('/')+'?v=30';
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
  const response=await fetch('patches/orchestra/manifest.json?v=30');if(!response.ok)throw Error('Patch manifest unavailable');const info=await response.json();
  const entries=await Promise.all(info.files.map(async name=>{const r=await fetch((name.startsWith('envion/')?'patches/':'patches/orchestra/')+name.split('/').map(encodeURIComponent).join('/')+'?v=30');if(!r.ok)throw Error('Patch unavailable: '+name);return [name,await r.text()];}));
  if(!disposed&&!loaded)setFiles(Object.fromEntries(entries),info);
 }catch(error){if(!disposed&&!loaded)get('[data-source]').textContent=error.message;}}
 function paint(force=false){
  const now=performance.now();if(!force&&now-lastPaint<250)return;lastPaint=now;
  const active=view.playing;
  get('[data-state]').textContent=(view.native?'NATIVE PD':'BROWSER PD')+' · '+(active?'RUNNING':'PAUSED');
  get('[data-feedback]').textContent=!active?'Feedback paused':transport?.connected===false?'Native connection lost':lastFeedback?`${now-lastFeedback>3000?'STALE':'LIVE'} feedback · ${((now-lastFeedback)/1000).toFixed(1)}s ago`:'Awaiting engine feedback';
  const m=view.m||{},c=m.context||{};
  table('[data-market]',[['Market',view.coin||'Synthetic demo'],['Feed',view.feed||'Synthetic demo'],['Market cap',c.latestCap?'$'+Math.round(c.latestCap).toLocaleString('en')+(c.capEstimated?' (estimate)':''):'Unavailable'],['Liquidity',Number.isFinite(view.liquidity)?'$'+Math.round(view.liquidity).toLocaleString('en'):'Synthetic / unavailable'],['Tempo',`${view.bpm||120} BPM${c.latestCap?'':' (demo / fallback)'}`],['Historical intensity',pretty(m.pressure??0)],['Snapshot age',Number.isFinite(m.snapshotAge)?(m.snapshotAge/1000).toFixed(1)+'s':'—']]);
  table('[data-controls]',controls.size?[...controls].map(([name,value])=>[name,pretty(value)]):[['Engine','No controls sent yet']]);
  table('[data-events]',events.size?[...events].map(([name,value])=>[name,pretty(value)]):[['Engine','No feedback received yet']]);
 }
 const timer=setInterval(()=>paint(),500);preview();
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
