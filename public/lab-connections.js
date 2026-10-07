import {createCablePanel} from './lab-cables.js?v=193';
// Bounded, one-update-delayed routing. No evaluation of code from presets.
export function createLabConnections({audio,visualSpecs,onChange=()=>{},canPrewire=()=>true}){
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const descriptors=[...audio.descriptors(),...visualSpecs.map(([key,label,min,max,step])=>({id:'visual.'+key,label,min,max,step,category:'Visual'}))];
 const sourceList=[{id:'signal.level',label:'Engine audio level · before volume',min:0,max:1,step:.01,category:'Audio'},{id:'signal.rms',label:'Measured engine RMS',min:0,max:.2,step:.001,category:'Audio'},...descriptors];
 const sourceById=new Map(sourceList.map(s=>[s.id,s])),targetById=new Map(descriptors.map(s=>[s.id,s]));
 let routes=[],enabled=true,nextId=1,smoothed=new Map(),outputs={},latest={},lastAt=null,readouts=[],marketPaints=[];
 const button=document.createElement('button');button.id='connections-button';button.textContent='Connections · 0';document.querySelector('header').insertBefore(button,document.getElementById('play'));
 const embeddedHost=document.getElementById('patch-workspace'),embedded=Boolean(embeddedHost);
 const dialog=document.createElement(embedded?'section':'dialog');dialog.className='connections-menu';dialog.setAttribute('aria-label','Market parameters and signal connections');
 dialog.innerHTML='<div class="connections-head"><h2>PATCH / MARKET → SOUND → IMAGE</h2><button data-close aria-label="Close connections">Close</button></div><p class="connections-intro">The starter cables are live mappings. Drag a socket to connect, or select a cable to change its range. Other engine parameters keep their AUTO mappings. Market values here are simulations, never edits to real market data. Feedback reads the previous update; one active connection controls each destination. Removing a cable restores that parameter’s AUTO or manual setting.</p><div class="connections-actions"><button data-tab="cables">Cables</button><button data-tab="routes">Cable settings</button><button data-tab="market">Market parameters</button><button data-toggle>Connections on</button><button data-add>+ Add connection</button><button data-starter>Restore starter cables</button><button data-export>Export change note</button></div><div data-market hidden><p class="group-note">Raw USD values, holder counts and trade rate are available as sources. Connect them to the normalized controls or a sound/visual parameter. A connected destination is controlled by its route until bypassed.</p><div class="grid"></div></div><div data-cables></div><div data-routes hidden></div><p class="connection-message" role="status"></p>';
 (embeddedHost||document.body).append(dialog);const container=dialog.querySelector('[data-routes]'),message=dialog.querySelector('.connection-message');
 dialog.querySelector('[data-close]').hidden=embedded;dialog.querySelector('[data-close]').onclick=()=>dialog.close();button.onclick=()=>{if(embedded)dialog.scrollIntoView({block:'start',behavior:'smooth'});else dialog.showModal();paint();cablePanel.refresh();};
 dialog.querySelector('[data-export]').onclick=()=>document.getElementById('note').click();
 dialog.querySelector('[data-toggle]').onclick=()=>{enabled=!enabled;if(!enabled){outputs={};smoothed.clear();audio.connect({});}paint();cablePanel.refresh();onChange();};
 function showTab(name){dialog.querySelector('[data-market]').hidden=name!=='market';container.hidden=name!=='routes';dialog.querySelector('[data-cables]').hidden=name!=='cables';for(const b of dialog.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',b.dataset.tab===name);if(name==='cables')cablePanel.refresh();}
 for(const tab of dialog.querySelectorAll('[data-tab]'))tab.onclick=()=>showTab(tab.dataset.tab);
 const cablePanel=createCablePanel({host:dialog.querySelector('[data-cables]'),sources:sourceList,targets:descriptors,getRoutes:()=>routes.map(r=>({...r,enabled:enabled&&r.enabled})),getValue:id=>latest[id],onConnect:(source,target)=>add(source,target),onSelect:id=>{showTab('routes');const card=container.querySelector('[data-route="'+id+'"]');card?.scrollIntoView({block:'nearest'});card?.querySelector('select')?.focus({preventScroll:true});}});
 function select(list,value,label){const el=document.createElement('select');el.setAttribute('aria-label',label);for(const category of ['Market','Audio','Visual']){const group=document.createElement('optgroup');group.label=category;for(const d of list.filter(d=>d.category===category)){const option=document.createElement('option');option.value=d.id;option.textContent=(d.category==='Audio'&&!d.id.startsWith('signal.')?d.id.split('.')[0]+' · ':'')+d.label;group.append(option);}el.append(group);}el.value=value;return el;}
 function number(parent,label,value,min,max,step,change){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step=step;input.value=value;input.onchange=()=>{const v=input.valueAsNumber;if(!Number.isFinite(v)){input.value=value;return;}value=clamp(v,min,max);input.value=value;change(value);smoothed.clear();onChange();};wrap.append(input);parent.append(wrap);return input;}
 function exclusive(route){if(!route.enabled)return;for(const other of routes)if(other!==route&&other.enabled&&other.target===route.target){other.enabled=false;message.textContent='Previous connection to this destination was bypassed.';}}
 function add(source='market.tempo',target='visual.speed'){
  if(routes.length>=32){message.textContent='Maximum 32 connections. Remove one to add another.';return;}
  const s=sourceById.get(source),t=targetById.get(target),route={id:nextId++,source,target,inMin:s.min,inMax:s.max,outMin:t.min,outMax:t.max,curve:1,smoothing:.3,log:s.min>0&&s.max/s.min>1000,enabled:true};routes.push(route);exclusive(route);build();onChange();
 }
 dialog.querySelector('[data-add]').onclick=()=>add();
 function fieldName(id){const d=sourceById.get(id)||targetById.get(id);return d?d.category+' / '+d.label:id;}
 function build(){
  container.replaceChildren();readouts=[];
  if(!routes.length){const p=document.createElement('p');p.className='empty-connections';p.textContent='No custom connections yet. The existing engine mappings are still active. Add a connection to override one parameter.';container.append(p);}
  for(const route of routes){
   const card=document.createElement('section');card.className='connection-card';card.dataset.route=route.id;const line=document.createElement('div');line.className='connection-path';
   const from=select(sourceList,route.source,'Source signal'),arrow=document.createElement('span'),to=select(descriptors,route.target,'Destination parameter');arrow.textContent='→';line.append(from,arrow,to);card.append(line);
   from.onchange=()=>{route.source=from.value;const s=sourceById.get(route.source);route.inMin=s.min;route.inMax=s.max;route.log=s.min>0&&s.max/s.min>1000;smoothed.clear();build();onChange();};
   to.onchange=()=>{route.target=to.value;const t=targetById.get(route.target);route.outMin=t.min;route.outMax=t.max;exclusive(route);smoothed.clear();build();onChange();};
   const fields=document.createElement('div');fields.className='connection-fields';card.append(fields);const s=sourceById.get(route.source),t=targetById.get(route.target);
   number(fields,'Source from',route.inMin,s.min,s.max,s.step,v=>route.inMin=v);number(fields,'Source to',route.inMax,s.min,s.max,s.step,v=>route.inMax=v);
   number(fields,'Destination from',route.outMin,t.min,t.max,t.step,v=>route.outMin=v);number(fields,'Destination to',route.outMax,t.min,t.max,t.step,v=>route.outMax=v);
   number(fields,'Response curve',route.curve,.1,4,.1,v=>route.curve=v);number(fields,'Smoothing · sec',route.smoothing,.05,10,.05,v=>route.smoothing=v);
   const actions=document.createElement('div');actions.className='connection-row';const active=document.createElement('button');active.textContent=route.enabled?'Connected':'Bypassed';active.setAttribute('aria-pressed',route.enabled);active.onclick=()=>{route.enabled=!route.enabled;exclusive(route);smoothed.clear();build();onChange();};
   const logarithm=document.createElement('button');logarithm.textContent=route.log?'Logarithmic input':'Linear input';logarithm.onclick=()=>{route.log=!route.log;smoothed.clear();build();onChange();};
   const remove=document.createElement('button');remove.textContent='Remove → AUTO';remove.onclick=()=>{routes=routes.filter(r=>r!==route);smoothed.delete(route.id);build();onChange();};const outputLog=document.createElement('button');outputLog.textContent=route.logOutput?'Exponential output':'Linear output';outputLog.onclick=()=>{route.logOutput=!route.logOutput;smoothed.clear();build();onChange();};actions.append(active,logarithm,outputLog,remove);card.append(actions);
   const live=document.createElement('p');live.className='connection-live';card.append(live);readouts.push(()=>{const source=latest[route.source],out=outputs[route.target];live.textContent=(Number.isFinite(source)?Number(source.toFixed(4)):'—')+' → '+(enabled&&route.enabled&&Number.isFinite(out)?Number(out.toFixed(4)):'bypassed')+(route.inMin===route.inMax?' · source range must have different endpoints':'')+(route.log&&(route.inMin<=0||route.inMax<=0)?' · log needs positive endpoints; using linear':'');});
   container.append(card);
  }paint();cablePanel.refresh();
 }
 function starter(respectOverrides=false){
  const specs=[
   ['market.activity','visual.speed',0,1,0,2.7,1,false,false],
   ['market.cap','visual.cellSize',1000,1e9,24,4,1,true,false],
   ['market.cap','visual.edgeFade',1000,1e9,.5,.015,1,true,false],
   ['market.cap','visual.survivalRelease',10000,1e9,.25,4,1,true,true],
   ['signal.level','visual.pixelPresence',0,.02,0,1,1,false,false],
   ['market.liquidity','pd.data-duration',0,1,.7,1.5,1,false,false],
   ['market.balance','pd.data-pan-left',1,0,0,1,.5,false,false],
   ['market.balance','pd.data-pan-right',0,1,0,1,.5,false,false],
  ];
  return {version:2,enabled:true,routes:specs.map(([source,target,inMin,inMax,outMin,outMax,curve,log,logOutput])=>({source,target,inMin,inMax,outMin,outMax,curve,log,logOutput,smoothing:.05,enabled:true})).filter(route=>!respectOverrides||canPrewire(route.target))};
 }
 dialog.querySelector('[data-starter]').onclick=()=>{audio.connect({});const next=clean(starter());enabled=true;routes=next.routes;outputs={};smoothed.clear();lastAt=null;build();onChange();message.textContent='Starter cables restored. Other controls stay as set.';};
 function clean(value){
  if(!value||typeof value!=='object')return {enabled:true,routes:[]};const result=[];
  for(const raw of (Array.isArray(value.routes)?value.routes:[]).slice(0,32)){
   const s=sourceById.get(raw?.source),t=targetById.get(raw?.target);if(!s||!t)continue;
   const finite=(key,fallback,min,max)=>Number.isFinite(raw[key])?clamp(raw[key],min,max):fallback;
   const r={id:nextId++,source:s.id,target:t.id,inMin:finite('inMin',s.min,s.min,s.max),inMax:finite('inMax',s.max,s.min,s.max),outMin:finite('outMin',t.min,t.min,t.max),outMax:finite('outMax',t.max,t.min,t.max),curve:finite('curve',1,.1,4),smoothing:finite('smoothing',.3,.05,10),log:raw.log===true,logOutput:raw.logOutput===true,enabled:raw.enabled!==false};
   if(r.enabled)for(const old of result)if(old.target===r.target)old.enabled=false;result.push(r);
  }return {enabled:value.enabled!==false,routes:result};
 }
 function paint(){button.textContent='Patch · '+routes.filter(r=>enabled&&r.enabled).length;dialog.querySelector('[data-toggle]').textContent=enabled?'Connections on':'Connections bypassed';if(embedded||dialog.open){for(const fn of readouts)fn();for(const fn of marketPaints)fn();cablePanel.updateValues();}}
 build();showTab('cables');
 return {
  dialog,
  owns(id){return enabled&&routes.some(r=>r.enabled&&r.target===id);},
  marketGrid:dialog.querySelector('[data-market] .grid'),marketPaints,
  changed(){onChange();},
  describe(){return routes.map(r=>'- '+fieldName(r.source)+' → '+fieldName(r.target)+' | '+r.inMin+'…'+r.inMax+' → '+r.outMin+'…'+r.outMax+' | '+(r.log?'log input':'linear input')+' / '+(r.logOutput?'exponential output':'linear output')+' | curve '+r.curve+' | smoothing '+r.smoothing+'s | '+(r.enabled&&enabled?'enabled':'bypassed')).join('\n')||'No custom connections.';},
  draft(){return {version:2,enabled,routes:routes.map(r=>({...r}))};},
  load(value){audio.connect({});const seedDefaults=!value||(value.version!==2&&!value.routes?.length);const preset=seedDefaults?{...starter(true),enabled:value?.enabled!==false}:value;const next=clean(preset);enabled=next.enabled;routes=next.routes;outputs={};smoothed.clear();lastAt=null;build();},
  step(snapshot,visual,now){
   if(lastAt!==null&&now-lastAt<.1)return outputs;const dt=lastAt===null?.1:Math.min(.25,Math.max(0,now-lastAt));lastAt=now;
   latest={...audio.controls(),...Object.fromEntries(Object.entries(visual).map(([k,v])=>['visual.'+k,v])),'signal.level':snapshot.audioLevel,'signal.rms':snapshot.rms};
   const next={};if(enabled)for(const r of routes){if(!r.enabled||r.inMin===r.inMax||!Number.isFinite(latest[r.source]))continue;let x=latest[r.source],t;
    if(r.log&&r.inMin>0&&r.inMax>0)t=Math.log(Math.max(Number.MIN_VALUE,x)/r.inMin)/Math.log(r.inMax/r.inMin);else t=(x-r.inMin)/(r.inMax-r.inMin);
    const amount=clamp(t,0,1)**r.curve;
    const goal=r.logOutput&&r.outMin>0&&r.outMax>0?r.outMin*Math.pow(r.outMax/r.outMin,amount):r.outMin+(r.outMax-r.outMin)*amount;
    const prior=smoothed.get(r.id)??latest[r.target]??goal,value=prior+(goal-prior)*(1-Math.exp(-dt/r.smoothing));
    const d=targetById.get(r.target);next[r.target]=clamp(value,d.min,d.max);smoothed.set(r.id,next[r.target]);
   }
   outputs=next;audio.connect(Object.fromEntries(Object.entries(next).filter(([id])=>!id.startsWith('visual.'))));paint();return outputs;
  },
 };
}
