import {battlePatternNames} from './earthbound-pattern.js?v=172';
import {createPixelBlastField,pixelBlastParameters} from './pixel-blast-field.js?v=172';
import {coinVisualPreset,walletSizeVariation} from './visual-context.js?v=171';
import {suggestedLayers} from './earthbound-motion-presets.js?v=167';
const $=id=>document.getElementById(id),KEY='upic-visual-lab-v1';
const inputSpecs=[['marketCap','Market cap · USD',1000,1e9,1000,500000,true],['referenceCap','Reference cap · USD',1000,1e9,1000,100000,true],['level','Engine audio level',0,1,.01,.5],['tempo','Tempo · BPM',10,240,1,100],['activity','Trade activity',0,1,.01,.5],['volume','Volume intensity',0,1,.01,.5],['motion','Price motion',0,1,.01,.4],['change','Price change · %',-100,100,1,5],['depth','Liquidity → spacing',0,1,.01,.5],['drive','Movement drive',0,1,.01,.5],['pressure','Pressure',0,1,.01,.2],['surge','Volume surge',0,1,.01,.3],['imbalance','Imbalance',0,1,.01,.2],['balance','Buy balance',0,1,.01,.6],['fresh','Data freshness',0,1,.01,1],['piano','Melody energy',0,1,.01,.5],['transient','Attack energy',0,1,.01,.2]];
const visualSpecs=[['dotSize','Square size · px',.5,24,.1],['cellSize','Grid spacing · px',4,24,1],['scale','Pattern scale',.05,8,.01],['density','Pattern density',0,4,.01],['speed','Flow speed',0,4,.01],['edgeFade','Edge shrink',0,.5,.005],['jitter','Size variation',0,1,.01],['ecosystem','Local populations',0,1,.01],['pixelPresence','Pixel survival',0,1,.01],['identity','Image morph',0,1,.01],['identityMotion','Image flow',0,2,.01]];
const stage=$('preview');
let renderer=createPixelBlastField(stage,{generations:false}),seed=1917%suggestedLayers.length,inputs={},overrides={},knobs=[],groups=[],notes='',running=true,time=0,eventTime=0,last=0,lastReadout=0,saveTimer,image=null,cycles=false,dirty=true;
const initial=()=>Object.fromEntries(inputSpecs.map(s=>[s[0],s[5]]));
inputs=initial();
const defaultGroups=()=>Array.from({length:4},(_,i)=>({percentage:[20,10,5,2][i],wallets:[{address:'lab-wallet-'+i,percentage:[15,6,3,1][i]}]}));
groups=defaultGroups();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function mapped(){return {...pixelBlastParameters({...inputs,seed,walletVariation:walletSizeVariation(groups),capital:clamp((Math.log10(inputs.marketCap)-4)/4,0,1),active:true}),pixelPresence:Math.min(1,inputs.level/.02)};}
function params(){const p={...mapped(),...overrides};p.pixelSize=p.dotSize;p.patternScale=p.scale;p.patternDensity=p.density;p.pixelSizeJitter=p.jitter;return p;}
function draft(){return {schema:'upic-visual-lab',version:2,rendererVersion:172,seed,inputs,overrides,groups,cycles,notes:$('notes').value,image:image?'Local image must be reloaded':null};}
function save(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(draft()));}catch{$('status').textContent='Storage unavailable — export your preset to keep it.';}},250);}
function apply(data){
 if(data.schema!=='upic-visual-lab'||![1,2].includes(data.version))throw Error('Not a Visual Lab preset');
 inputs=initial();overrides={};
 for(const [key,,min,max] of inputSpecs)if(Number.isFinite(data.inputs?.[key]))inputs[key]=clamp(data.inputs[key],min,max);
 for(const [key,,min,max] of visualSpecs)if(Number.isFinite(data.overrides?.[key]))overrides[key]=clamp(data.overrides[key],min,max);
 if(data.version===1)for(const key of ['edgeFade','cellSize','density','jitter'])delete overrides[key];
 seed=Number.isFinite(data.seed)?clamp(Math.round(data.seed),0,999999)%suggestedLayers.length:1917%suggestedLayers.length;
 groups=defaultGroups();if(Array.isArray(data.groups))data.groups.slice(0,4).forEach((g,i)=>{if(Number.isFinite(g.percentage))groups[i].percentage=clamp(g.percentage,0,25);if(Number.isFinite(g.wallets?.[0]?.percentage))groups[i].wallets[0].percentage=clamp(g.wallets[0].percentage,0,groups[i].percentage);});
 notes=typeof data.notes==='string'?data.notes.slice(0,10000):'';cycles=data.cycles===true;
}
try{const stored=localStorage.getItem(KEY);if(stored)apply(JSON.parse(stored));}catch{}
function resetMotion(){time=0;eventTime=0;renderer.reset(seed);dirty=true;}
function rebuild(){renderer.close();renderer=createPixelBlastField(stage,{generations:cycles});if(image)renderer.setImage(image);resetMotion();}
function section(title,description,open=false){const d=document.createElement('details');d.open=open;const s=document.createElement('summary');s.textContent=title;d.append(s);const p=document.createElement('p');p.className='group-note';p.textContent=description;d.append(p);const grid=document.createElement('div');grid.className='grid';d.append(grid);$('controls').append(d);return grid;}
function knob(parent,spec,get,set,auto){
 const [key,label,min,max,step,,log]=spec;const card=document.createElement('div');card.className='control';
 const caption=document.createElement('label');caption.className='label';caption.textContent=label;
 const dial=document.createElement('div');dial.className='dial';dial.tabIndex=0;dial.setAttribute('role','slider');dial.setAttribute('aria-label',label);dial.setAttribute('aria-valuemin',min);dial.setAttribute('aria-valuemax',max);
 const number=document.createElement('input');number.type='number';number.className='value';number.min=min;number.max=max;number.step=step;number.setAttribute('aria-label',label+' value');
 const norm=v=>log?Math.log(v/min)/Math.log(max/min):(v-min)/(max-min);
 const value=t=>log?min*(max/min)**t:min+t*(max-min);
 function change(v){if(!Number.isFinite(v))return;v=clamp(Math.round(v/step)*step,min,max);set(v);save();paint();}
 function paint(){const v=get(),t=clamp(norm(v),0,1);dial.style.setProperty('--arc',t*270+'deg');dial.style.setProperty('--angle',-135+t*270+'deg');dial.setAttribute('aria-valuenow',v);if(document.activeElement!==number)number.value=Number(v.toFixed(4));if(autoButton){autoButton.textContent=Object.hasOwn(overrides,key)?'MANUAL · AUTO ↺':'AUTO';autoButton.classList.toggle('manual',Object.hasOwn(overrides,key));}}
 let drag=null;dial.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={y:e.clientY,x:e.clientX,t:norm(get())};dial.setPointerCapture(e.pointerId);dial.focus();});
 dial.addEventListener('pointermove',e=>{if(drag)change(value(clamp(drag.t+(drag.y-e.clientY+e.clientX-drag.x)/(e.shiftKey?1000:220),0,1)));});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(name,()=>{drag=null;});
 dial.addEventListener('keydown',e=>{const delta=({ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10})[e.key];if(delta){e.preventDefault();change(log?value(clamp(norm(get())+delta*.01,0,1)):get()+delta*step);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();change(e.key==='Home'?min:max);}});
 number.addEventListener('change',()=>{change(number.valueAsNumber);if(!Number.isFinite(number.valueAsNumber))number.value=get();});
 card.append(caption,dial,number);let autoButton=null;
 if(auto){autoButton=document.createElement('button');autoButton.className='auto';autoButton.onclick=()=>{auto();save();paint();};card.append(autoButton);dial.ondblclick=()=>autoButton.click();}
 parent.append(card);knobs.push(paint);paint();
}
function buildControls(){
 $('controls').replaceChildren();knobs=[];$('notes').value=notes;
 const global=section('01 / EarthBound scene','Coin seed selects the EarthBound Suggested Layers motion preset and a fixed graphic family. Market cap never changes the pattern. These adapt the original motion data, not game artwork.',true);
 knob(global,['seed','EarthBound coin seed',0,suggestedLayers.length-1,1],()=>seed%suggestedLayers.length,v=>{seed=v;resetMotion();});
 const presetName=document.createElement('p');presetName.className='group-note wide';global.append(presetName);knobs.push(()=>{presetName.textContent=coinVisualPreset(seed).name+' · '+battlePatternNames[coinVisualPreset(seed).index%8];});
 const toggle=document.createElement('button');toggle.textContent='Ink cycles: '+(cycles?'on':'off');toggle.onclick=()=>{cycles=!cycles;toggle.textContent='Ink cycles: '+(cycles?'on':'off');rebuild();save();};global.append(toggle);
 const a=section('02 / Market + sound','Simulated inputs. Engine audio level means sound inside the engine before the listening-volume slider. Lower relative cap shrinks the edges more; higher liquidity tightens grid spacing. Reference cap stays fixed until you turn it.',true);
 for(const spec of inputSpecs)knob(a,spec,()=>inputs[spec[0]],v=>{inputs[spec[0]]=v;});
 const b=section('03 / Renderer','Turning a knob overrides its mapping. Image knobs need a loaded image. Grid spacing changes the hidden lattice.',true);
 for(const spec of visualSpecs)knob(b,spec,()=>params()[spec[0]],v=>{overrides[spec[0]]=v;},()=>{delete overrides[spec[0]];});
 const c=section('04 / Wallet size variation','Synthetic wallet sizes, not InsightX data. More unequal wallet sizes produce more pixel-size variation. Wallets no longer add bubble shapes. Each group is capped at 25% of supply.');
 groups.forEach((_,i)=>{
  knob(c,['group'+i,'Group '+(i+1)+' · supply %',0,25,.1],()=>groups[i].percentage,v=>{groups=groups.map((g,j)=>j===i?{...g,percentage:v,wallets:[{...g.wallets[0],percentage:Math.min(v,g.wallets[0].percentage)}]}:g);});
  knob(c,['wallet'+i,'Largest wallet '+(i+1)+' · %',0,25,.1],()=>groups[i].wallets[0].percentage,v=>{groups=groups.map((g,j)=>j===i?{...g,wallets:[{...g.wallets[0],percentage:Math.min(v,g.percentage)}]}:g);});
 });
}
buildControls();rebuild();
$('notes').oninput=save;
$('pause').onclick=()=>{running=!running;$('pause').textContent=running?'Pause':'Play';dirty=true;};
$('restart').onclick=resetMotion;
$('pulse').onclick=()=>{renderer.pulse({key:'lab:'+eventTime,time:eventTime,strength:Math.max(.1,inputs.transient),balance:inputs.balance,direction:Math.sign(inputs.change)});dirty=true;};
$('expand').onclick=()=>{document.body.classList.toggle('expanded');$('expand').textContent=document.body.classList.contains('expanded')?'Return':'Expand';dirty=true;};
$('reset').onclick=()=>{inputs=initial();overrides={};seed=1917%suggestedLayers.length;groups=defaultGroups();notes='';cycles=false;image=null;buildControls();rebuild();save();};
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>download('upic-visual-preset.json',JSON.stringify(draft(),null,2),'application/json');
$('note').onclick=()=>{const d=draft();download('upic-visual-change-note.md','# UPIC visual change request\n\nUse this preset as the visual reference. Manual overrides are fixed values; all remaining parameters follow the current input mapping.\n\n'+d.notes+'\n\n## Preset\n```json\n'+JSON.stringify(d,null,2)+'\n```\n\n## Effective renderer values\n```json\n'+JSON.stringify(params(),null,2)+'\n```\n\nSynthetic market and holder inputs are examples, not real token data. Image files are not included.\n','text/markdown');};
$('load').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Preset is too large');apply(JSON.parse(await file.text()));buildControls();rebuild();save();$('status').textContent='Preset loaded. Reload its image separately if needed.';}catch(error){$('status').textContent=error.message;}e.target.value='';};
$('image').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>12000000){$('status').textContent='Choose an image under 12 MB.';return;}const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();image=img;renderer.setImage(img);overrides.identity=.7;save();$('status').textContent='Image loaded — turn Image morph to shape the field.';}catch{$('status').textContent='Could not load that image.';}finally{URL.revokeObjectURL(url);}};
let width=1,height=1;new ResizeObserver(entries=>{width=entries[0].contentRect.width;height=entries[0].contentRect.height;dirty=true;}).observe(stage);
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-(last||now))/1000);last=now;if(document.hidden)return;
 if(running){const p=params();time+=dt*p.speed;eventTime+=dt;dirty=true;}
 if(dirty){const p=params();renderer.render({width,height,time,eventTime,liquidTime:time,active:true,parameters:p});dirty=false;}
 if(now-lastReadout>120){lastReadout=now;knobs.forEach(p=>p());$('clock').textContent=Math.floor(eventTime/60).toString().padStart(2,'0')+':'+Math.floor(eventTime%60).toString().padStart(2,'0');$('renderer').textContent=(stage.dataset.pixelBlast||'pixel')+' · '+Math.round(width)+' × '+Math.round(height);}
}
requestAnimationFrame(frame);window.addEventListener('pagehide',()=>{try{localStorage.setItem(KEY,JSON.stringify(draft()));}catch{}});
