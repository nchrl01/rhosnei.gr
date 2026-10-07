import {labVisualMappings,LAB_MAPPING_VERSION,UPDATED_TARGETS} from './lab-visual-mappings.js?v=3';
import {createLabConnections} from './lab-connections.js?v=198';
import {audioLab} from './audio-lab.js?v=209';
import {knob} from './lab-knob.js?v=1';
import {createPixelBlastField,pixelBlastParameters} from './pixel-blast-field.js?v=209';
import {advancePixelSurvival} from './pixel-blast-parameters.js?v=192';
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),KEY='upic-av-lab-v1';
const specs=[['dotSize','Mark size · px',.5,12,.1],['cellSize','Grid spacing · px',4,24,1],['speed','Flow speed',0,2.7,.01],['edgeFade','Edge shrink',0,.5,.005],['jitter','Wallet size variation',0,1,.01],['pixelPresence','Audio presence',0,1,.01],['survivalRelease','Pixel survival · sec',.25,12,.01]];
const sources=[['auto','AUTO · existing mapping'],['manual','MANUAL · fixed value'],['audio','Engine audio level'],['tempo','Tempo · 40–140 BPM'],['cap','Market cap · logarithmic'],['relativeCap','Cap / reference · logarithmic'],['liquidity','Liquidity depth'],['activity','Trade activity'],['volume','Trade volume'],['motion','Price motion'],['intensity','Musical intensity'],['change','Price direction · −90% to +100%'],['balance','Buy share'],['wallet','Wallet inequality'],['fresh','Data freshness']];
const initial=()=>({referenceCap:100000,wallet:.3,cycles:false,mappingVersion:LAB_MAPPING_VERSION,routes:{}});
let connections=null,pendingConnections=null;
let settings=initial(),renderer,paints=[],width=1,height=1,last=0,lastReadout=0,lastSeed=null,lastElapsed=0,time=0,effective={},smooth={},previousLevel=0,pixelSurvival=0,pulseIndex=0,saveTimer;
const stage=$('visual-preview');
function readVisual(value){
 const next=initial();if(!value||typeof value!=='object')return next;
 if(Number.isFinite(value.referenceCap))next.referenceCap=clamp(value.referenceCap,1000,1e9);
 if(Number.isFinite(value.wallet))next.wallet=clamp(value.wallet,0,1);next.cycles=value.cycles===true;
 for(const [key,,min,max] of specs){const route=value.routes?.[key];if(!route||!sources.some(([s])=>s===route.source))continue;next.routes[key]={source:route.source,min:Number.isFinite(route.min)?clamp(route.min,min,max):min,max:Number.isFinite(route.max)?clamp(route.max,min,max):max,value:Number.isFinite(route.value)?clamp(route.value,min,max):min};}
 if((value.mappingVersion||0)<LAB_MAPPING_VERSION)for(const key of UPDATED_TARGETS)delete next.routes[key];
 return next;
}
function migrateConnections(value,visual){return !value||(visual?.mappingVersion||0)<LAB_MAPPING_VERSION?null:value;}
function draft(){return {schema:'upic-av-lab',version:2,audio:audioLab.preset(),visual:settings,connections:connections?.draft()??pendingConnections,notes:$('notes').value};}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(draft()));}catch{$('status').textContent='Storage unavailable. Save a preset to keep these connections.';}},250);}
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.schema==='upic-av-lab'&&[1,2].includes(saved.version)){audioLab.load(saved.audio);settings=readVisual(saved.visual);pendingConnections=migrateConnections(saved.connections,saved.visual);}}catch{}
function rebuild(){renderer?.close();renderer=createPixelBlastField(stage,{generations:settings.cycles});lastSeed=null;time=0;smooth={};pixelSurvival=0;}
function base(snapshot){const m=snapshot.market;return {...labVisualMappings(pixelBlastParameters({seed:snapshot.seed,marketCap:m.cap,referenceCap:settings.referenceCap,level:snapshot.audioLevel,tempo:m.tempo,activity:m.activity,volume:m.volume,motion:m.motion,change:m.change,depth:m.liquidity,drive:m.intensity,pressure:m.pressure,surge:m.shock,imbalance:Math.abs(m.balance-.5)*2,balance:m.balance,fresh:m.fresh,piano:snapshot.audioLevel,transient:Math.max(0,snapshot.audioLevel-previousLevel),walletVariation:settings.wallet,capital:clamp((Math.log10(m.cap)-4)/4,0,1),active:snapshot.running}),{marketCap:m.cap,activity:m.activity,fresh:m.fresh,active:snapshot.running})};}
function values(s){const m=s.market;return {audio:s.audioLevel,tempo:(m.tempo-40)/100,cap:clamp((Math.log10(m.cap)-3)/6,0,1),relativeCap:clamp((Math.log10(m.cap/settings.referenceCap)+2)/4,0,1),liquidity:m.liquidity,activity:m.activity,volume:m.volume,motion:m.motion,intensity:m.intensity,change:(m.change+90)/190,balance:m.balance,wallet:settings.wallet,fresh:m.fresh};}
function routeFor(key){return settings.routes[key]||{source:'auto'};}
function configureRoute(key,patch){const spec=specs.find(s=>s[0]===key);settings.routes[key]={min:spec[2],max:spec[3],value:effective[key]??spec[2],...routeFor(key),...patch};persist();}
function section(title,note){const d=document.createElement('details');d.open=true;const h=document.createElement('summary');h.textContent=title;const p=document.createElement('p');p.className='group-note';p.textContent=note;const grid=document.createElement('div');grid.className='grid';d.append(h,p,grid);$('visual-controls').append(d);return grid;}
function build(){
 $('visual-controls').replaceChildren();paints=[];
 const global=section('Shared context','The current defaults are already wired: market activity drives tempo and flow; cap controls grid spacing, edge shrink and how long marks survive; wallet concentration changes mark size; price direction chooses + or ×. Envion receives the same activity, liquidity, motion, volume, tempo and direction.');
 knob(global,['reference','Reference cap · USD',1000,1e9,1000,100000,true],()=>settings.referenceCap,v=>settings.referenceCap=v,{paints,onChange:persist});
 knob(global,['wallet','Wallet size variation',0,1,.01],()=>settings.wallet,v=>settings.wallet=v,{paints,onChange:persist});
 const cycle=document.createElement('button');cycle.className='action';cycle.onclick=()=>{settings.cycles=!settings.cycles;rebuild();persist();};global.append(cycle);paints.push(()=>{cycle.textContent='White / black cycles · '+(settings.cycles?'on':'off');cycle.setAttribute('aria-pressed',settings.cycles);});
 for(const spec of specs){const [key,label,min,max,step]=spec;const card=document.createElement('div');card.className='route';const heading=document.createElement('h3');heading.textContent=label;card.append(heading);
  const select=document.createElement('select');select.setAttribute('aria-label',label+' source');for(const [value,text] of sources){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.onchange=()=>configureRoute(key,{source:select.value});card.append(select);
  const status=document.createElement('p');status.className='route-status';card.append(status);const grid=document.createElement('div');grid.className='grid';card.append(grid);
  knob(grid,spec,()=>effective[key]??base(audioLab.snapshot())[key]??min,v=>configureRoute(key,{source:'manual',value:v}),{paints,onChange:persist,manual:()=>routeFor(key).source==='manual',auto:()=>{delete settings.routes[key];persist();}});
  for(const side of ['min','max'])knob(grid,[key+side,side==='min'?'At input 0':'At input 1',min,max,step],()=>routeFor(key)[side]??(side==='min'?min:max),v=>configureRoute(key,{[side]:v}),{paints,onChange:persist});
  paints.push(()=>{select.value=routeFor(key).source;status.textContent=connections?.owns('visual.'+key)?'Driven by patch cable':select.value==='auto'?'Following the shared engine mapping':select.value==='manual'?'Fixed value · turn AUTO to reconnect':'Input 0 → '+(routeFor(key).min??min)+' / input 1 → '+(routeFor(key).max??max);});
  $('visual-controls').append(card);
 }
}
function saveFile(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>saveFile('upic-av-preset.json',JSON.stringify(draft(),null,2),'application/json');
$('note').onclick=()=>{const d=draft();saveFile('upic-av-change-note.md','# UPIC audiovisual change note\n\n'+(d.notes||'No written notes.')+'\n\n## Patch cables\n\n'+connections.describe()+'\n\n## Visual panel mappings\n\n'+specs.map(([key,label])=>'- '+label+': '+JSON.stringify(routeFor(key))).join('\n')+'\n\n## Current visual output values\n\n```json\n'+JSON.stringify(effective,null,2)+'\n```\n\n## Complete preset\n\n```json\n'+JSON.stringify(d,null,2)+'\n```\n\nThe audio and visual outputs share one clock and simulated market. Envion’s automatic market mappings are described in the patch.\n','text/markdown');$('status').textContent='Combined change note exported. Attach it in our chat.';};
$('load').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>300000)throw Error('Preset is too large');const d=JSON.parse(await file.text());if(d.schema!=='upic-av-lab'||![1,2].includes(d.version))throw Error('Choose a combined audiovisual preset');const next=readVisual(d.visual);connections.load(null);audioLab.load(d.audio);settings=next;connections.load(migrateConnections(d.connections,d.visual));build();rebuild();persist();$('status').textContent='Both engines loaded. Press Start audio.';}catch(error){$('status').textContent=error.message;}finally{e.target.value='';}};
const resetAudio=$('reset').onclick;$('reset').onclick=()=>{resetAudio();settings=initial();connections.load(null);build();rebuild();persist();};
// Save both halves whenever a knob/input changes, including pointer-driven audio controls.
document.querySelector('.audio-controls').addEventListener('input',persist);
document.querySelector('.audio-controls').addEventListener('change',persist);
document.querySelector('.audio-controls').addEventListener('pointerup',persist);
document.querySelector('.audio-controls').addEventListener('keyup',persist);
document.querySelector('.audio-controls').addEventListener('click',persist);
new ResizeObserver(entries=>{width=Math.max(1,entries[0].contentRect.width);height=Math.max(1,entries[0].contentRect.height);}).observe(stage);
rebuild();build();
connections=createLabConnections({audio:audioLab,visualSpecs:specs,onChange:persist,canPrewire:id=>{if(id.startsWith('visual.'))return routeFor(id.slice(7)).source==='auto';const [group,key]=id.split('.');return !Object.hasOwn(audioLab.preset()[group]||{},key);}});
connections.load(pendingConnections);
const primaryMarketInputs=new Set(['market.seed','market.tempo','market.cap','market.activity','market.volume','market.motion','market.liquidity','market.change','market.intensity','market.balance','market.pressure','market.shock','market.fresh','market.tonic','market.holderConcentration']);
for(const d of audioLab.descriptors().filter(d=>primaryMarketInputs.has(d.id))){
 knob(connections.marketGrid,[d.id,d.label,d.min,d.max,d.step],()=>audioLab.controls()[d.id],v=>audioLab.setControl(d.id,v),{paints:connections.marketPaints,onChange:persist});
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-(last||now))/1000);last=now;if(document.hidden)return;
 const snapshot=audioLab.snapshot(),p=base(snapshot),signals=values(snapshot);
 if(lastSeed!==snapshot.seed||snapshot.elapsed<lastElapsed){renderer.reset(snapshot.seed);time=0;smooth={};pixelSurvival=0;lastSeed=snapshot.seed;}const audioDelta=Math.max(0,snapshot.elapsed-lastElapsed);lastElapsed=snapshot.elapsed;
 const soundPresence=p.pixelPresence;
 for(const [key,,min,max] of specs){const route=routeFor(key);let target=p[key]??min;if(route.source==='manual')target=route.value;else if(route.source!=='auto')target=route.min+(route.max-route.min)*(signals[route.source]??0);target=clamp(target,min,max);smooth[key]=smooth[key]===undefined||key==='pixelPresence'?target:smooth[key]+(target-smooth[key])*(1-Math.exp(-dt/.16));p[key]=smooth[key];}
 const connected=connections.step(snapshot,effective,now/1000);
 for(const [key,,min,max] of specs)if(Number.isFinite(connected['visual.'+key]))p[key]=clamp(connected['visual.'+key],min,max);
 // Sound excites survival; market cap controls how long its pixel tail lasts.
 // Manual routes cannot create marks before sound or after its tail finishes.
 pixelSurvival=advancePixelSurvival(pixelSurvival,Math.min(p.pixelPresence,soundPresence),dt,snapshot.market.cap,p.survivalRelease);
 p.pixelPresence=pixelSurvival;p.pixelSize=p.dotSize;p.patternScale=p.scale;p.patternDensity=p.density;p.pixelSizeJitter=p.jitter;
 if(snapshot.running)time+=Math.min(.25,audioDelta)*p.speed;
 if(snapshot.audioLevel-previousLevel>.08)renderer.pulse({key:'audio:'+pulseIndex++,time:snapshot.elapsed,strength:snapshot.audioLevel,balance:snapshot.market.balance,direction:Math.sign(snapshot.market.change)});
 previousLevel=snapshot.audioLevel;effective=p;
 renderer.render({width,height,time,eventTime:snapshot.elapsed,liquidTime:time,active:snapshot.running,parameters:p});
 if(now-lastReadout>150){lastReadout=now;for(const paint of paints)paint();$('visual-readout').textContent=(snapshot.running?'CONNECTED':'PAUSED')+' · '+snapshot.market.tempo+' BPM · engine '+(snapshot.rms>0?(20*Math.log10(snapshot.rms)).toFixed(1)+' dBFS':'silent')+' · '+Math.round(width)+' × '+Math.round(height);}
}
requestAnimationFrame(frame);window.addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(draft()));}catch{}renderer.close();});
