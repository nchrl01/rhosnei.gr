// A patch-board view of the same saved routing graph. Wires never own DSP state.
export function createCablePanel({host,sources,targets,getRoutes,onConnect,onSelect,getValue=()=>undefined}){
 const NS='http://www.w3.org/2000/svg',layoutKey='upic-lab-node-layout-v1';
 const definitions=[
  {id:'market',title:'MARKET',subtitle:'Shared simulated inputs',x:24,y:80,accept:d=>d.category==='Market'},
  {id:'audio',title:'AUDIO ENGINE',subtitle:'Sound controls and returns',x:414,y:80,accept:d=>d.category==='Audio'&&!d.id.startsWith('signal.')},
  {id:'signals',title:'SOUND SIGNALS',subtitle:'Measured before listening volume',x:414,y:480,accept:d=>d.id.startsWith('signal.')},
  {id:'visual',title:'VISUAL ENGINE',subtitle:'Pattern and mark controls',x:804,y:80,accept:d=>d.category==='Visual'},
 ];
 const defaults={
  out:new Set(['market.cap','market.activity','market.tempo','market.change','market.liquidity','market.holderConcentration','signal.level','signal.rms','piano.arpGain','piano.roomSend','visual.dotSize','visual.speed']),
  in:new Set(['market.tempo','market.activity','market.intensity','market.tonic','piano.chordGain','piano.arpGain','piano.roomSend','pd.data-reverb','visual.speed','visual.cellSize','visual.dotSize','visual.edgeFade','visual.jitter','visual.pixelPresence']),
 };
 let pending=null,drag=null,nodeDrag=null,suppressUntil=0,raf=0,allPorts=false,savedLayout={};
 try{savedLayout=JSON.parse(localStorage.getItem(layoutKey)||'{}')||{};}catch{}
 host.innerHTML='<div class="cable-tools"><label>Find a parameter<input type="search" placeholder="Tempo, filter, liquidity…" aria-label="Find cable ports"></label><button type="button" data-all-ports aria-pressed="false">All ports</button><button type="button" data-reset-layout>Reset layout</button><button type="button" data-cancel disabled>Cancel cable</button></div><p class="cable-help" role="status">Drag OUT to IN, or tap the two jacks. Select a cable to change its mapping. Drag a node header to arrange the patch.</p><div class="cable-scroll"><div class="cable-board patch-board"><svg class="cable-wires" aria-label="Signal cables"></svg></div></div>';
 const board=host.querySelector('.cable-board'),scroll=host.querySelector('.cable-scroll'),svg=host.querySelector('svg'),search=host.querySelector('input'),help=host.querySelector('.cable-help'),cancel=host.querySelector('[data-cancel]'),ports=new Map(),nodes=[];
 const key=(kind,id)=>kind+':'+id;
 const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
 const label=d=>d.category==='Audio'&&!d.id.startsWith('signal.')?d.id.split('.')[0]+' · '+d.label:d.label;
 const idleHelp='Drag OUT to IN, or tap the two jacks. Select a cable to change its mapping. Drag a node header to arrange the patch.';
 function release(element,pointer){if(element?.hasPointerCapture(pointer))element.releasePointerCapture(pointer);}
 function reset(){
  const gesture=drag;drag=null;if(gesture)release(gesture.port.button,gesture.pointer);
  pending=null;cancel.disabled=true;help.textContent=idleHelp;
  for(const p of ports.values())p.button.setAttribute('aria-pressed','false');schedule();
 }
 function choose(port){
  if(!port)return;
  if(pending&&pending.kind!==port.kind){const source=port.kind==='out'?port.id:pending.id,target=port.kind==='in'?port.id:pending.id;reset();onConnect(source,target);refresh();return;}
  if(pending?.id===port.id&&pending.kind===port.kind){reset();return;}
  pending=port;cancel.disabled=false;help.textContent='Choose an '+(port.kind==='out'?'IN destination':'OUT source')+' for '+port.label+'.';
  for(const p of ports.values())p.button.setAttribute('aria-pressed',p.id===port.id&&p.kind===port.kind?'true':'false');schedule();
 }
 function makePort(d,kind,node,column){
  const button=document.createElement('button');button.className='cable-port';button.type='button';button.dataset.kind=kind;button.dataset.id=d.id;
  button.setAttribute('aria-label',(kind==='out'?'Output ':'Input ')+d.category+' '+label(d));button.setAttribute('aria-pressed','false');
  const jack=document.createElement('span');jack.className='cable-jack';jack.setAttribute('aria-hidden','true');const text=document.createElement('span');text.className='cable-port-label';text.textContent=label(d);const value=document.createElement('span');value.className='cable-port-value';value.setAttribute('aria-hidden','true');button.append(...(kind==='in'?[jack,text,value]:[value,text,jack]));
  const port={id:d.id,kind,label:label(d),button,jack,value,node,column,search:(d.category+' '+label(d)+' '+d.id).toLowerCase()};ports.set(key(kind,d.id),port);node.members.push(port);column.append(button);
  button.onclick=()=>{if(performance.now()>=suppressUntil)choose(port);};
  button.onpointerdown=e=>{if(e.button!==0)return;drag={port,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pointer:e.pointerId};button.setPointerCapture(e.pointerId);};
  button.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;drag.moved||=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;if(drag.moved){e.preventDefault();schedule();}};
  button.onpointerup=e=>{
   if(!drag||drag.pointer!==e.pointerId)return;const gesture=drag;drag=null;release(button,e.pointerId);
   if(gesture.moved){suppressUntil=performance.now()+300;const endpoint=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cable-port');const other=endpoint&&host.contains(endpoint)?ports.get(key(endpoint.dataset.kind,endpoint.dataset.id)):null;
    if(other&&other.kind!==port.kind){pending=port;choose(other);}else{pending=null;choose(port);}
   }schedule();
  };
  button.onpointercancel=e=>{if(drag?.pointer!==e.pointerId)return;drag=null;release(button,e.pointerId);schedule();};
  button.onlostpointercapture=e=>{if(drag?.pointer===e.pointerId){drag=null;schedule();}};
 }
 function saveLayout(){try{localStorage.setItem(layoutKey,JSON.stringify(Object.fromEntries(nodes.map(n=>[n.id,{x:n.x,y:n.y}]))));}catch{}}
 function place(node,x,y){node.x=bound(x,12,4000);node.y=bound(y,12,2200);node.element.style.left=node.x+'px';node.element.style.top=node.y+'px';schedule();}
 for(const def of definitions){
  const element=document.createElement('section');element.className='patch-node';element.dataset.node=def.id;element.setAttribute('aria-label',def.title+' patch node');
  const header=document.createElement('div');header.className='patch-node-header';header.tabIndex=0;header.setAttribute('aria-label','Move '+def.title+' node. Use arrow keys to move.');
  const title=document.createElement('h3');title.className='patch-node-title';title.textContent=def.title;const summary=document.createElement('small');summary.className='patch-node-summary';header.append(title,summary);
  const subtitle=document.createElement('p');subtitle.className='patch-node-subtitle';subtitle.textContent=def.subtitle;
  const columns=document.createElement('div');columns.className='patch-node-ports';element.append(header,subtitle,columns);board.append(element);
  const node={...def,element,header,summary,members:[],columns:[]};nodes.push(node);
  const saved=savedLayout[def.id];place(node,Number.isFinite(saved?.x)?saved.x:def.x,Number.isFinite(saved?.y)?saved.y:def.y);
  for(const [kind,list] of [['in',targets],['out',sources]]){
   const members=list.filter(def.accept);if(!members.length)continue;
   const column=document.createElement('div');column.className=kind==='in'?'patch-ports-in':'patch-ports-out';const heading=document.createElement('div');heading.className='patch-port-heading';heading.textContent=kind==='in'?'IN':'OUT';column.append(heading);columns.append(column);node.columns.push(column);
   for(const d of members)makePort(d,kind,node,column);column.addEventListener('scroll',schedule,{passive:true});
  }
  if(node.columns.length===1)element.classList.add('patch-node--source');
  header.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();nodeDrag={node,pointer:e.pointerId,x:e.clientX,y:e.clientY,startX:node.x,startY:node.y,scrollX:scroll.scrollLeft,scrollY:scroll.scrollTop};header.setPointerCapture(e.pointerId);element.classList.add('is-moving');};
  header.onpointermove=e=>{if(!nodeDrag||nodeDrag.pointer!==e.pointerId)return;e.preventDefault();const d=nodeDrag;place(node,Math.round((d.startX+e.clientX-d.x+scroll.scrollLeft-d.scrollX)/4)*4,Math.round((d.startY+e.clientY-d.y+scroll.scrollTop-d.scrollY)/4)*4);};
  const endMove=e=>{if(nodeDrag?.pointer!==e.pointerId)return;nodeDrag=null;element.classList.remove('is-moving');release(header,e.pointerId);saveLayout();schedule();};
  header.onpointerup=endMove;header.onpointercancel=endMove;header.onlostpointercapture=endMove;
  header.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();place(node,node.x+delta[0]*(e.shiftKey?40:8),node.y+delta[1]*(e.shiftKey?40:8));saveLayout();};
 }
 function point(port){
  if(!port||port.button.hidden||port.node.element.hidden)return null;
  const r=port.jack.getBoundingClientRect(),b=board.getBoundingClientRect(),c=port.column.getBoundingClientRect(),heading=port.column.querySelector('.patch-port-heading').getBoundingClientRect(),y=r.top+r.height/2;
  if(y<Math.max(c.top,heading.bottom)||y>c.bottom)return null;
  return {x:r.left+r.width/2-b.left,y:y-b.top,node:port.node};
 }
 function curve(a,b,lane){
  if(lane!==undefined){const outward=34;return `M${a.x},${a.y} C${a.x+outward},${a.y} ${a.x+outward},${lane} ${a.x+outward*2},${lane} L${b.x-outward*2},${lane} C${b.x-outward},${lane} ${b.x-outward},${b.y} ${b.x},${b.y}`;}
  const bend=Math.max(35,Math.abs(b.x-a.x)*.45);return `M${a.x},${a.y} C${a.x+bend},${a.y} ${b.x-bend},${b.y} ${b.x},${b.y}`;
 }
 function path(d,className){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('class',className);svg.append(p);return p;}
 function draw(){
  raf=0;if(!host.isConnected||!board.getClientRects().length)return;
  const visible=nodes.filter(n=>!n.element.hidden),right=Math.max(900,...visible.map(n=>n.x+n.element.offsetWidth))+24,bottom=Math.max(350,...visible.map(n=>n.y+n.element.offsetHeight)),top=Math.min(...visible.map(n=>n.y));
  const width=Math.max(scroll.clientWidth,right),height=Math.max(620,bottom+140);if(board.style.width!==width+'px')board.style.width=width+'px';if(board.style.height!==height+'px')board.style.height=height+'px';
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px';
  getRoutes().forEach((route,index)=>{
   const a=point(ports.get(key('out',route.source))),b=point(ports.get(key('in',route.target)));if(!a||!b)return;
   const detour=a.node===b.node||b.x<a.x||b.x-a.x>420,lane=detour?(top>=72?top-24-(index%6)*8:bottom+30+(index%8)*12):undefined,d=curve(a,b,lane),wire=path(d,'cable-line'+(route.enabled?'':' bypassed'));wire.style.stroke='hsl(0 0% '+(65+(index%4)*9)+'%)';
   const hit=path(d,'cable-hit');hit.setAttribute('role','button');hit.setAttribute('tabindex','0');hit.setAttribute('aria-label','Edit cable: '+ports.get(key('out',route.source)).label+' to '+ports.get(key('in',route.target)).label);hit.onclick=()=>onSelect(route.id);hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(route.id);}};
  });
  if(drag?.moved){
   const viewport=scroll.getBoundingClientRect(),oldX=scroll.scrollLeft,oldY=scroll.scrollTop;
   if(drag.x<viewport.left+35)scroll.scrollLeft-=10;else if(drag.x>viewport.right-35)scroll.scrollLeft+=10;
   if(drag.y<viewport.top+30)scroll.scrollTop-=10;else if(drag.y>viewport.bottom-30)scroll.scrollTop+=10;
   if(oldX!==scroll.scrollLeft||oldY!==scroll.scrollTop)schedule();
   for(const node of visible)for(const column of node.columns){const bounds=column.getBoundingClientRect();if(drag.x<bounds.left||drag.x>bounds.right||drag.y<bounds.top||drag.y>bounds.bottom)continue;const before=column.scrollTop;if(drag.y<bounds.top+40)column.scrollTop-=8;else if(drag.y>bounds.bottom-30)column.scrollTop+=8;if(before!==column.scrollTop)schedule();}
   const origin=point(drag.port),r=board.getBoundingClientRect(),end={x:drag.x-r.left,y:drag.y-r.top};if(origin)path(drag.port.kind==='out'?curve(origin,end):curve(end,origin),'cable-line pending');
  }
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(draw);}
 function updateValues(){
  if(!host.isConnected||!host.getClientRects().length)return;
  for(const port of ports.values())if(!port.button.hidden){const v=getValue(port.id);const formatted=Number.isFinite(v)?Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'m':Math.abs(v)>=1000?(v/1000).toFixed(1)+'k':Number(v.toFixed(3)).toString():'—';if(port.value.textContent!==formatted)port.value.textContent=formatted;}
 }
 function refresh(){
  const routes=getRoutes(),query=search.value.trim().toLowerCase(),attached=new Set(routes.flatMap(r=>[key('out',r.source),key('in',r.target)]));
  for(const node of nodes){let count=0;for(const p of node.members){const wired=attached.has(key(p.kind,p.id)),selected=pending?.id===p.id&&pending.kind===p.kind;
    p.button.hidden=query?!p.search.includes(query)&&!wired&&!selected:!allPorts&&!wired&&!selected&&!defaults[p.kind].has(p.id);count+=!p.button.hidden;p.button.classList.toggle('wired',wired);
   }
   // Keep patched jacks at the top so existing cables remain visible when a
   // node's optional parameter catalogue is longer than its viewport.
   for(const column of node.columns){
    const members=node.members.filter(p=>p.column===column),priority=p=>attached.has(key(p.kind,p.id))?2:defaults[p.kind].has(p.id)?1:0;
    members.sort((a,b)=>priority(b)-priority(a));for(const p of members)column.append(p.button);
    // refresh means the graph/filter changed, not a live-value update. Reveal
    // the patched endpoints after changing the graph or reopening the board.
    column.scrollTop=0;
   }
   node.element.hidden=!!query&&!count;node.summary.textContent=count+' / '+node.members.length+' ports';
  }updateValues();schedule();
 }
 search.oninput=refresh;cancel.onclick=reset;
 host.querySelector('[data-all-ports]').onclick=e=>{allPorts=!allPorts;e.currentTarget.setAttribute('aria-pressed',String(allPorts));e.currentTarget.textContent=allPorts?'Connected + key ports':'All ports';refresh();};
 host.querySelector('[data-reset-layout]').onclick=()=>{for(const node of nodes){const def=definitions.find(d=>d.id===node.id);place(node,def.x,def.y);}scroll.scrollTo({left:0,top:0});saveLayout();};
 scroll.addEventListener('scroll',schedule,{passive:true});
 const observer=new ResizeObserver(schedule);observer.observe(scroll);for(const node of nodes)observer.observe(node.element);
 host.addEventListener('keydown',e=>{if(e.key==='Escape'&&(pending||drag)){e.preventDefault();e.stopPropagation();reset();}});
 host.closest('dialog')?.addEventListener('cancel',e=>{if(pending||drag){e.preventDefault();reset();}});host.closest('dialog')?.addEventListener('close',reset);
 refresh();return {refresh,reset,updateValues};
}
