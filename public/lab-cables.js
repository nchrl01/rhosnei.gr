// Cable editing is a view of the same saved routing graph.
export function createCablePanel({host,sources,targets,getRoutes,onConnect,onSelect}){
 const NS='http://www.w3.org/2000/svg';let pending=null,drag=null,suppressUntil=0,raf=0;
 host.innerHTML='<div class="cable-tools"><label>Find a parameter<input type="search" placeholder="Tempo, filter, liquidity…" aria-label="Find cable ports"></label><button data-cancel disabled>Cancel cable</button></div><p class="cable-help" role="status">Drag OUT to IN, or tap one port then the other. Select a cable to edit its settings below.</p><div class="cable-scroll"><div class="cable-board"><svg class="cable-wires" aria-label="Signal cables"></svg><div class="cable-bank" data-outputs><h3>OUT / SOURCES</h3></div><div class="cable-bank" data-inputs><h3>IN / DESTINATIONS</h3></div></div></div>';
 const board=host.querySelector('.cable-board'),svg=host.querySelector('svg'),search=host.querySelector('input'),help=host.querySelector('.cable-help'),cancel=host.querySelector('[data-cancel]'),ports=new Map(),groups=[];
 const key=(kind,id)=>kind+':'+id;
 function label(d){return d.category==='Audio'&&!d.id.startsWith('signal.')?d.id.split('.')[0]+' · '+d.label:d.label;}
 function reset(){pending=null;drag=null;cancel.disabled=true;help.textContent='Drag OUT to IN, or tap one port then the other. Select a cable to edit its settings below.';for(const p of ports.values())p.button.setAttribute('aria-pressed','false');schedule();}
 function choose(port){
  if(pending&&pending.kind!==port.kind){const source=port.kind==='out'?port.id:pending.id,target=port.kind==='in'?port.id:pending.id;reset();onConnect(source,target);refresh();return;}
  if(pending?.id===port.id&&pending.kind===port.kind){reset();return;}
  pending=port;cancel.disabled=false;help.textContent='Choose an '+(port.kind==='out'?'IN destination':'OUT source')+' for '+port.label+'.';for(const p of ports.values())p.button.setAttribute('aria-pressed',p.id===port.id&&p.kind===port.kind?'true':'false');schedule();
 }
 function makeBank(list,kind,parent){
  for(const category of ['Market','Audio','Visual']){
   const group=document.createElement('details');group.className='cable-group';group.open=category!=='Audio';const title=document.createElement('summary');title.textContent=category;group.append(title);const members=[];
   for(const d of list.filter(d=>d.category===category)){
    const button=document.createElement('button');button.className='cable-port';button.type='button';button.dataset.kind=kind;button.dataset.id=d.id;button.setAttribute('aria-label',(kind==='out'?'Output ':'Input ')+category+' '+label(d));button.setAttribute('aria-pressed','false');
    const jack=document.createElement('span');jack.className='cable-jack';jack.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=label(d);button.append(...(kind==='in'?[jack,text]:[text,jack]));
    const port={id:d.id,kind,label:label(d),button,jack,group,bank:parent,search:(category+' '+label(d)).toLowerCase()};ports.set(key(kind,d.id),port);members.push(port);group.append(button);
    button.onclick=()=>{if(performance.now()<suppressUntil)return;choose(port);};
    button.onpointerdown=e=>{if(e.button!==0)return;drag={port,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pointer:e.pointerId};button.setPointerCapture(e.pointerId);};
    button.onpointermove=e=>{if(!drag||drag.pointer!==e.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;drag.moved||=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;if(drag.moved){e.preventDefault();schedule();}};
    button.onpointerup=e=>{if(!drag||drag.pointer!==e.pointerId)return;const gesture=drag;drag=null;if(gesture.moved){suppressUntil=performance.now()+300;const endpoint=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cable-port');if(endpoint&&host.contains(endpoint)&&endpoint.dataset.kind!==port.kind){const other=ports.get(key(endpoint.dataset.kind,endpoint.dataset.id));pending=port;choose(other);}else{pending=null;choose(port);}}schedule();};
    button.onpointercancel=()=>{drag=null;schedule();};button.onlostpointercapture=()=>{drag=null;schedule();};
   }
   group.addEventListener('toggle',schedule);parent.append(group);groups.push({group,members});
  }
 }
 makeBank(sources,'out',host.querySelector('[data-outputs]'));makeBank(targets,'in',host.querySelector('[data-inputs]'));
 function point(port){if(!port||port.button.hidden||!port.group.open)return null;const r=port.jack.getBoundingClientRect(),b=board.getBoundingClientRect(),bank=port.bank.getBoundingClientRect(),header=port.bank.querySelector('h3').getBoundingClientRect();const y=r.top+r.height/2;if(y<header.bottom||y>bank.bottom)return null;return {x:r.left+r.width/2-b.left,y:y-b.top};}
 function curve(a,b){const bend=Math.max(45,Math.abs(b.x-a.x)*.45);return `M${a.x},${a.y} C${a.x+bend},${a.y} ${b.x-bend},${b.y} ${b.x},${b.y}`;}
 function path(d,className){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.setAttribute('class',className);svg.append(p);return p;}
 function draw(){
  raf=0;if(!host.isConnected||!board.getClientRects().length)return;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${board.clientWidth} ${board.clientHeight}`);svg.style.height=board.clientHeight+'px';
  for(const route of getRoutes()){
   const a=point(ports.get(key('out',route.source))),b=point(ports.get(key('in',route.target)));if(!a||!b)continue;const d=curve(a,b),wire=path(d,'cable-line'+(route.enabled?'':' bypassed'));wire.style.stroke='hsl(0 0% '+(65+(route.id%4)*9)+'%)';
   const hit=path(d,'cable-hit');hit.setAttribute('role','button');hit.setAttribute('tabindex','0');hit.setAttribute('aria-label','Edit cable: '+(ports.get(key('out',route.source))?.label||route.source)+' to '+(ports.get(key('in',route.target))?.label||route.target));hit.onclick=()=>onSelect(route.id);hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(route.id);}};
  }
  if(drag?.moved){for(const bank of host.querySelectorAll('.cable-bank')){const bounds=bank.getBoundingClientRect();if(drag.x<bounds.left||drag.x>bounds.right)continue;const before=bank.scrollTop;if(drag.y<bounds.top+45)bank.scrollTop-=12;else if(drag.y>bounds.bottom-40)bank.scrollTop+=12;if(before!==bank.scrollTop)schedule();}const origin=point(drag.port),r=board.getBoundingClientRect(),end={x:drag.x-r.left,y:drag.y-r.top};if(origin)path(drag.port.kind==='out'?curve(origin,end):curve(end,origin),'cable-line pending');}
 }
 function schedule(){if(!raf)raf=requestAnimationFrame(draw);}
 function refresh(){
  const routes=getRoutes(),query=search.value.trim().toLowerCase(),attached=new Set(routes.flatMap(r=>[key('out',r.source),key('in',r.target)]));
  for(const {group,members} of groups){let visible=0,connected=false;for(const p of members){const wired=attached.has(key(p.kind,p.id));p.button.hidden=!!query&&!p.search.includes(query)&&!wired;visible+=!p.button.hidden;connected||=wired;p.button.classList.toggle('wired',wired);}group.hidden=!visible;if(query||connected)group.open=true;}
  schedule();
 }
 for(const bank of host.querySelectorAll('.cable-bank'))bank.addEventListener('scroll',schedule,{passive:true});
 search.oninput=refresh;cancel.onclick=reset;new ResizeObserver(schedule).observe(board);host.closest('dialog')?.addEventListener('cancel',e=>{if(pending||drag){e.preventDefault();reset();}});host.closest('dialog')?.addEventListener('close',reset);
 refresh();return {refresh,reset};
}
