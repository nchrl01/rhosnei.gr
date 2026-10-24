import {createVinylTransport} from './vinyl-transport.js?v=480';
import {knob} from './lab-knob.js?v=1';
import {marketSpecs,mixSpecs,pianoSpecs,phraseSpecs,drumSpecs,chipSpecs} from './audio-lab-specs.js?v=480';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=220';
import {createTradePiano} from './trade-piano.js?v=494';
import {gameBoyDrumControls,gameBoyDrumPattern} from './gameboy-drum-pattern.js?v=473';
import {marketChipSignal} from './market-chip-score.js?v=480';
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const connectionBaselines=new Map();
const KEY='upic-audio-lab-v1',groups={market:marketSpecs,mix:mixSpecs,piano:[...pianoSpecs,...phraseSpecs,...drumSpecs,...chipSpecs]};
const defaults=()=>({schema:'upic-audio-lab',version:1,market:Object.fromEntries(marketSpecs.map(s=>[s[0],s[5]])),mix:Object.fromEntries(mixSpecs.map(s=>[s[0],s[5]])),piano:{},enabled:Object.fromEntries(mixSpecs.map(([key])=>[key,true])),master:.5,autoTrades:true,arpeggios:true,drums:true,notes:''});
let state=defaults(),ctx,piano,running=false,starting=false,closed=false,timer,saveTimer;
let vinylTransport,transport,master,musicMeter,meter,meterData,musicData,elapsed=0,lastTime=null,nextTrade=0,tradeIndex=0,price=1,paints=[],lastUI=0;
let idleSuspend=null,seedTimer=null;
let solo=null,buses={},engineStatus={'GB chip':'Not loaded'},statuses={};
const report=text=>{$('status').textContent=text;};
function readPreset(data){
 if(data?.schema!=='upic-audio-lab'||data.version!==1)throw Error('Not an Audio Lab preset');
 const next=defaults();
 for(const [group,specs] of Object.entries(groups))for(const [key,,min,max,step] of specs)if(Number.isFinite(data[group]?.[key]))next[group][key]=clamp(Math.round(data[group][key]/step)*step,min,max);
 for(const [key] of mixSpecs)if(typeof data.enabled?.[key]==='boolean')next.enabled[key]=data.enabled[key];
 for(const key of ['autoTrades','arpeggios','drums'])if(typeof data[key]==='boolean')next[key]=data[key];
 if(Number.isFinite(data.master))next.master=clamp(data.master,0,1);
 if(typeof data.notes==='string')next.notes=data.notes.slice(0,10000);
 return next;
}
try{const saved=localStorage.getItem(KEY);if(saved)state=readPreset(JSON.parse(saved));}catch{}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(unpatchedState()));}catch{report('Browser storage unavailable. Export your preset to keep it.');}},200);}
const level=key=>state.enabled[key]&&(!solo||solo===key)?state.mix[key]:0;
function setStatus(name,text){engineStatus[name]=text;if(statuses[name])statuses[name].textContent=text;}
for(const [name,text] of Object.entries(engineStatus)){const row=document.createElement('div');row.className='engine-line';const a=document.createElement('span'),b=document.createElement('span');a.textContent=name;b.textContent=text;statuses[name]=b;row.append(a,b);$('engines').append(row);}
function market(){
 const s=state.market;
 const music={tempo:s.tempo,activity:s.activity,changePct:s.change,intensity:s.intensity,volatility:s.motion,group:s.change<0?'down':'up'};
 return {activity:s.activity,volume:s.volume,motion:s.motion,texture:s.liquidity,liquidity:s.liquidityUsd,holders:s.holders,delta:s.change,balance:s.balance,fresh:s.fresh,tradeRate:s.activity*20,observed:true,source:'lab',music,arrangement:piano?.arrangement?.(),raw:{activity:s.activity,volume:s.volume,motion:s.motion},availability:{liquidity:true,holders:true,activity:true,change:true,balance:true,volume:true},context:{latestCap:s.cap*price,direction:Math.sign(s.change),pressure:s.pressure,shock:s.shock},replay:{sceneSeed:s.seed,at:0,volume:s.volume}};
}
function chipConfiguration(){
 return {...state.piano,arpeggios:state.arpeggios,drums:state.drums&&level('earthbound')>0,
  noteGain:(state.piano.noteGain??1)*level('earthbound'),chordGain:(state.piano.chordGain??1)*level('earthbound'),arpGain:state.piano.arpGain??1,
  drumGain:(state.piano.drumGain??1)*level('earthbound'),textureGain:(state.piano.textureGain??1)*level('envion'),dataGain:(state.piano.dataGain??1)*level('data')};
}
function applyAudio(){
 if(!ctx)return;master.gain.setTargetAtTime(state.master,ctx.currentTime,.025);
 piano?.setTempo(state.market.tempo);piano?.configure(chipConfiguration());piano?.setEnabled(mixSpecs.some(([key])=>level(key)>0));
}
function resetScore(){
 clearTimeout(seedTimer);elapsed=0;lastTime=ctx?.currentTime??null;nextTrade=0;tradeIndex=0;price=1;
 piano?.reset(state.market.seed);applyAudio();
}
let loadJob=null;
async function loadEngines(){
 if(loadJob)return loadJob;
 loadJob=(async()=>{
  if(piano)return;
  setStatus('GB chip','Starting musical layers…');
  try{
   const result=await createTradePiano(ctx,buses.earthbound,{initialSeed:state.market.seed,onVoice:event=>{$('last-note').textContent=(event.instrument||'GB chip')+' · '+(event.notes||[]).join(' / ')+' · '+(event.reason||'market packet');},onArpeggio:event=>{$('last-note').textContent='Pulse packet · MIDI '+event.midi;}});
   if(closed){result.close();return;}
   piano=result;piano.reset(state.market.seed);piano.setMaster(1);piano.setRunning(running);applyAudio();setStatus('GB chip','Ready · three Game Boy chips');
  }catch(error){setStatus('GB chip',error.message);throw error;}
 })();try{await loadJob;}finally{loadJob=null;if(!running&&!closed)stop();}
}
async function setup(){
 ctx=createMusicContext();transport=ctx.createGain();transport.gain.value=0;master=ctx.createGain();master.gain.value=state.master;
 const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
 musicMeter=ctx.createAnalyser();musicMeter.fftSize=1024;musicData=new Float32Array(1024);musicMeter.connect(transport);
 vinylTransport=await createVinylTransport(ctx);transport.connect(vinylTransport.node);vinylTransport.node.connect(limiter);limiter.connect(master);meter=ctx.createAnalyser();meter.fftSize=1024;master.connect(meter);meter.connect(ctx.destination);meterData=new Float32Array(1024);
 for(const key of ['earthbound']){const bus=ctx.createGain();bus.gain.value=1;bus.connect(musicMeter);buses[key]=bus;}
 ctx.addEventListener('statechange',()=>{if(ctx.state==='interrupted'||ctx.state==='suspended'){if(running)stop();report('Audio paused. Tap Start audio to resume.');}});
 timer=setInterval(tick,50);
}
async function start(){
 if(starting||closed)return;clearTimeout(idleSuspend);if(running){stop();return;}
 starting=true;$('play').disabled=true;
 try{
  if(!ctx)await setup();await unlockPlayback(ctx);running=true;vinylTransport?.play();lastTime=ctx.currentTime;nextTrade=elapsed;transport.gain.setTargetAtTime(1,ctx.currentTime,.04);
  piano?.setRunning(true);
  $('play').textContent='Pause audio';$('chord').disabled=false;$('trade').disabled=false;
  void loadEngines().then(()=>{if(!closed&&running){nextTrade=elapsed;report('GB ensemble ready. Every tone, packet and noise voice comes from the Game Boy cores.');}}).catch(error=>{if(!closed){stop();report('GB chip could not start: '+error.message);}});
  applyAudio();
 }catch(error){stop();report(error.message);}finally{starting=false;$('play').disabled=false;}
}
function stop(){
 running=false;lastTime=null;
 const finish=()=>{if(running)return;transport?.gain.setTargetAtTime(0,ctx.currentTime,.025);piano?.setRunning(false);stopLegacyPlayback();};
 if(vinylTransport&&!closed&&ctx?.state==='running')vinylTransport.pause(finish);else finish();
 $('play').textContent='Start audio';$('chord').disabled=true;$('trade').disabled=true;clearTimeout(idleSuspend);if(ctx&&!closed&&!loadJob)idleSuspend=setTimeout(()=>{if(!running)void ctx.suspend().catch(()=>{});},1050);paint();
}
function trigger(force=false){
 if(!running||!ctx||ctx.state!=='running')return;
 const at=elapsed*1000;price=clamp(price*(1+state.market.change/100),1e-12,1e12);const m=market();
 const event={kind:'swap',id:'lab-'+tradeIndex,at,receivedAt:at,occurredAt:at,price,priceUsd:price,referencePrice:price/(1+state.market.change/100),chordStep:tradeIndex,music:m.music,metrics:{...m,replay:null,price,referencePrice:price/(1+state.market.change/100),source:'lab',observed:true}};
 if(force)piano?.replay(event,{reason:'movement',at,changePct:state.market.change},m.context.latestCap,m.music);
 else piano?.trade(event,m.context.latestCap,m.music);
 tradeIndex++;
}
function tick(){
 if(!ctx||closed||!running)return;
 const now=ctx.currentTime;if(running&&ctx.state==='running'){
  elapsed+=Math.min(.25,Math.max(0,now-(lastTime??now)));lastTime=now;
  if(state.autoTrades&&state.market.activity>0&&state.market.fresh>0&&elapsed>=nextTrade){trigger();nextTrade=elapsed+60/state.market.tempo*state.market.tradeBeats;}
  const m=market();piano?.frame({...m,replay:null},{playing:true,at:elapsed*1000,price,known:true,quiet:state.market.activity===0});

 }
 if(now-lastUI>.15||!running){lastUI=now;paint();}
}
function section(title,description,open=false){const d=document.createElement('details');d.open=open;const s=document.createElement('summary');s.textContent=title;const p=document.createElement('p');p.className='group-note';p.textContent=description;const grid=document.createElement('div');grid.className='grid';d.append(s,p,grid);$('controls').append(d);return grid;}
function changed(){
 for(const [id,held] of connectionBaselines){const [group,key]=id.split('.');if(state[group][key]!==held.last)held.base=state[group][key];}
 applyAudio();save();paint();
}
function addKnob(parent,spec,get,set,auto,manual){knob(parent,spec,get,set,{auto,manual,onChange:changed,paints});}
function direct(parent,group,spec){addKnob(parent,spec,()=>state[group][spec[0]],v=>{state[group][spec[0]]=v;if(spec[0]==='seed'){clearTimeout(seedTimer);seedTimer=setTimeout(resetScore,180);}});}
function action(parent,label,run){const b=document.createElement('button');b.textContent=label;b.className='action';b.onclick=run;parent.append(b);return b;}
// Random choices happen only on an explicit lab action. The chosen values are
// saved with the preset; score playback itself remains entirely seeded.
function randomizeDrum(key){
 const current=state.piano[key]??0,values=new Uint16Array(1);
 if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(values);
 else values[0]=(current+1)%65536;
 state.piano[key]=values[0]===current?(current+1)%65536:values[0];
 changed();
}
function drumPatternPreview(parent){
 const preview=document.createElement('div');preview.className='drum-pattern-preview';
 const caption=document.createElement('p');caption.className='lab-hint';caption.textContent='First eight beats · packet preview';
 const diagram=document.createElement('div');diagram.setAttribute('role','img');
 const names={kick:'Kick',snare:'Snare',hat:'Hat',tom:'Tom'},marks={};
 for(const [drum,name] of Object.entries(names)){
  const row=document.createElement('div');row.className='drum-pattern-row';
  const label=document.createElement('span');label.textContent=name;
  const cells=document.createElement('div');cells.className='drum-pattern-cells';
  marks[drum]=Array.from({length:16},()=>{const cell=document.createElement('span');cell.setAttribute('aria-hidden','true');cells.append(cell);return cell;});
  row.append(label,cells);diagram.append(row);
 }
 preview.append(caption,diagram);parent.append(preview);let previous='';
 paints.push(()=>{
  const signal=marketChipSignal({metrics:market()}),density=state.piano.drumDensity??pianoAuto('drumDensity');
  const signature=[state.market.seed,state.piano.drumVariation??0,density,signal.fingerprint,signal.fresh].join(':');
  if(signature===previous)return;previous=signature;
  const pattern=gameBoyDrumPattern(state.market.seed,{...state.piano,drumDensity:density,signal}),description=[];
  for(const [drum,name] of Object.entries(names)){
   const hits=[];pattern.cells[drum].forEach((hit,index)=>{marks[drum][index].dataset.hit=String(hit);if(hit)hits.push(index+1);});
   description.push(name+': '+(hits.length?'steps '+hits.join(', '):'no base hits'));
  }
  diagram.setAttribute('aria-label','First eight beats shown in sixteen display bins. '+description.join('. ')+'. This shows asynchronous packets, not a fixed playback grid. Market data and channel contention affect playback.');
 });
}
function switchButton(parent,label,get,set){const b=document.createElement('button');b.onclick=()=>{set(!get());changed();};paints.push(()=>{b.textContent=label+' · '+(get()?'on':'off');b.setAttribute('aria-pressed',get());});parent.append(b);return b;}
function pianoAuto(key){
 const snapshot=piano?.snapshot();
 if(key==='drumDensity'||key==='drumDeviation'){
  const field=key==='drumDensity'?'density':'deviation';
  return snapshot?.drums?.[field]??gameBoyDrumControls({signal:marketChipSignal({metrics:market()})})[field];
 }
 return snapshot?.chip?.settings?.[key]??[...pianoSpecs,...phraseSpecs,...drumSpecs,...chipSpecs].find(s=>s[0]===key)?.[5]??0;
}
function build(){
 $('controls').replaceChildren();paints=[];$('notes').value=state.notes;
 const mixer=section('01 / Mixer','Signal, texture and packets share three GB chips. Mute or solo their score roles; the channels are shared. Listening volume follows the chip.',true);
 addKnob(mixer,['master','Listening volume',0,1,.01],()=>state.master,v=>state.master=v);
 for(const spec of mixSpecs)direct(mixer,'mix',spec);
 const switches=document.createElement('div');switches.className='switches';mixer.append(switches);
 for(const [key,label] of mixSpecs){switchButton(switches,label,()=>state.enabled[key],v=>state.enabled[key]=v);const b=document.createElement('button');b.onclick=()=>{solo=solo===key?null:key;changed();};switches.append(b);paints.push(()=>{b.textContent='Solo '+label;b.setAttribute('aria-pressed',solo===key);});}
 const input=section('02 / Market + musical context','Simulated market observations control the same chip used on the homepage. Activity, price movement, volume and freshness shape the transmission. Send a packet to hear one observation; automatic trades follow the selected interval. Price change compounds the simulated price. Raw holder, liquidity and volume inputs are also available for connections in the combined lab.',true);
 for(const spec of marketSpecs)direct(input,'market',spec);
 const tradeSwitch=document.createElement('div');tradeSwitch.className='switches';input.append(tradeSwitch);switchButton(tradeSwitch,'Automatic trades',()=>state.autoTrades,v=>{state.autoTrades=v;nextTrade=elapsed;});
 const melodic=section('03 / Transmission score','New motifs use the MIDI collection’s phrasing, with a shared harmonic base and room to breathe. Market observations shape the machine rhythms, accents and disruption. Every sound comes from the Game Boy cores.',true);
 melodic.parentElement.id='market-phrase';
 for(const spec of [...phraseSpecs,...pianoSpecs]){const key=spec[0];addKnob(melodic,spec,()=>state.piano[key]??pianoAuto(key),v=>state.piano[key]=v,()=>delete state.piano[key],()=>Object.hasOwn(state.piano,key));}
 const pulseSwitch=document.createElement('div');pulseSwitch.className='switches';melodic.append(pulseSwitch);switchButton(pulseSwitch,'Pitched packets',()=>state.arpeggios,v=>state.arpeggios=v);
 action(melodic,'Reset score controls',()=>{for(const [key] of [...phraseSpecs,...pianoSpecs])delete state.piano[key];changed();report('Automatic market-driven score restored.');});
 const texture=section('04 / Psychedelic texture + counterrhythm','Detuned wave shadows and phrase replies sit around the held harmony. The original independent prime clocks change with observed market data. The countervoice has separate channels so it cannot interrupt held chords or bass. Shared rests silence every lane.',true);
 const packetSwitch=document.createElement('div');packetSwitch.className='switches';texture.append(packetSwitch);
 switchButton(packetSwitch,'Broken-clock packets',()=>state.drums,v=>state.drums=v);
 const chip=section('05 / Chip registers','The chip supplies two pulse channels, one 32-step wave channel and one noise channel. Duty, stepped envelope, wave table, noise clock and stereo routing change those channels directly. AUTO lets the score choose registers per event; the displayed values are fallback settings. Automatic voices use role-specific ADSR. Manual Envelope step overrides it until reset. Wave choices: 0 triangle, 1 hollow, 2 bright, 3 pad, 4 sine. Manual controls override those choices until reset.',true);
 chip.parentElement.id='chip-controls';
 for(const spec of chipSpecs){const key=spec[0];addKnob(chip,spec,()=>state.piano[key]??pianoAuto(key),v=>state.piano[key]=v,()=>delete state.piano[key],()=>Object.hasOwn(state.piano,key));}
 action(chip,'Reset chip controls',()=>{for(const [key] of chipSpecs)delete state.piano[key];changed();report('Automatic chip settings restored.');});

 paint();
 if(['#chip-controls','#market-phrase','#gb-drums'].includes(location.hash))requestAnimationFrame(()=>document.querySelector(location.hash)?.scrollIntoView({block:'start'}));
}
function paint(){
 for(const fn of paints)fn();
 const s=piano?.snapshot();$('instrument').textContent=s?.name||'Four channels. One machine.';$('harmony').textContent=state.market.tempo+' BPM · harmony · texture · bass · rhythm';
 $('clock').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
 const canvas=$('scope'),draw=canvas.getContext('2d'),width=Math.max(1,Math.round(canvas.clientWidth)),height=Math.max(1,Math.round(canvas.clientHeight)),ratio=Math.min(2,devicePixelRatio||1);
 if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}draw.setTransform(ratio,0,0,ratio,0,0);draw.clearRect(0,0,width,height);
 if(!meter)return;if(running)meter.getFloatTimeDomainData(meterData);else meterData.fill(0);let sum=0,peak=0;for(const v of meterData){sum+=v*v;peak=Math.max(peak,Math.abs(v));}const rms=Math.sqrt(sum/meterData.length),db=20*Math.log10(Math.max(rms,1e-6));
 $('meter-fill').style.width=clamp((db+60)/60*100,0,100)+'%';$('meter-text').textContent=rms<1e-5?'Silent':db.toFixed(1)+' dBFS · peak '+(20*Math.log10(Math.max(peak,1e-6))).toFixed(1);
 draw.strokeStyle='#ddd';draw.lineWidth=1;draw.beginPath();for(let i=0;i<meterData.length;i++){const x=i/(meterData.length-1)*width,y=height/2-meterData[i]*height*.47;if(i===0)draw.moveTo(x,y);else draw.lineTo(x,y);}draw.stroke();
}
function download(filename,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('play').onclick=start;$('chord').onclick=()=>trigger(true);$('trade').onclick=()=>trigger(false);$('restart').onclick=()=>{resetScore();paint();report('Score restarted from the current seed.');};
$('notes').oninput=()=>{state.notes=$('notes').value.slice(0,10000);save();};
$('save').onclick=()=>download('upic-audio-preset.json',JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json');
$('note').onclick=()=>{
 const lines=['# UPIC audio change note','',state.notes||'No written notes.','', '## Audition context','',`- Seed: ${state.market.seed}`,`- Instrument: ${piano?.snapshot()?.name||'Seeded / not loaded'}`,'- Score: Market transmission',`- Tempo: ${state.market.tempo} BPM`,`- Solo during audition: ${solo||'none'}`,'','## Controls',''];
 for(const [group,specs] of Object.entries(groups)){lines.push('### '+group,'');for(const [key,label] of specs)lines.push('- '+label+': '+(state[group][key]??'AUTO'));lines.push('');}
 lines.push('','## Complete reproducible preset','','```json',JSON.stringify(state,null,2),'```','','Synthetic market inputs; sound still requires fresh activity, volume or price movement. This export does not modify production.');
 download('upic-audio-change-note.md',lines.join('\n'),'text/markdown');report('Change note exported. Attach it in our chat.');
};
$('load').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('Preset is too large');const next=readPreset(JSON.parse(await file.text()));stop();state=next;solo=null;resetScore();build();save();report('Preset loaded. Press Start audio to hear it.');}catch(error){report(error.message);}finally{event.target.value='';}};
$('reset').onclick=()=>{connectionBaselines.clear();stop();state=defaults();solo=null;resetScore();build();save();report('Control defaults restored. Press Start audio.');};
// Hidden pages stop expensive DSP and sequencing; return requires a deliberate tap.
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();void ctx?.suspend().catch(()=>{});}});
window.addEventListener('pagehide',()=>{closed=true;stop();clearInterval(timer);clearTimeout(saveTimer);clearTimeout(idleSuspend);clearTimeout(seedTimer);vinylTransport?.close();piano?.close();void ctx?.close();});
build();

window.addEventListener('pageshow',event=>{if(event.persisted&&closed)location.reload();});

function unpatchedState(){
 const result=JSON.parse(JSON.stringify(state));
 for(const [id,held] of connectionBaselines){const [group,key]=id.split('.');if(held.base===undefined)delete result[group][key];else result[group][key]=held.base;}
 return result;
}
const connectionSpecs=Object.fromEntries(Object.entries(groups).flatMap(([group,specs])=>specs.filter(s=>s[0]!=='seed').map(spec=>[group+'.'+spec[0],spec])));
function readControl(id){const [group,key]=id.split('.');return state[group]?.[key]??(group==='piano'?pianoAuto(key):undefined)??connectionSpecs[id]?.[5]??0;}
function connectionValue(id,value){const spec=connectionSpecs[id];if(!spec||!Number.isFinite(value))return null;return clamp(Math.round(value/spec[4])*spec[4],spec[2],spec[3]);}
// Shared-engine interface for the combined audiovisual workspace.
export const audioLab={
 descriptors(){return Object.entries(connectionSpecs).map(([id,s])=>({id,label:s[1],min:s[2],max:s[3],step:s[4],category:id.startsWith('market.')?'Market':'Audio'}));},
 controls(){return Object.fromEntries(Object.keys(connectionSpecs).map(id=>[id,readControl(id)]));},
 setControl(id,value){const v=connectionValue(id,value);if(v===null)return;const [group,key]=id.split('.');if(connectionBaselines.has(id))connectionBaselines.get(id).base=v;else state[group][key]=v;changed();},
 connect(patch={}){
  let dirty=false;
  for(const [id,held] of connectionBaselines)if(!Object.hasOwn(patch,id)){const [group,key]=id.split('.');if(held.base===undefined)delete state[group][key];else state[group][key]=held.base;connectionBaselines.delete(id);dirty=true;}
  for(const [id,value] of Object.entries(patch)){const v=connectionValue(id,value);if(v===null)continue;const [group,key]=id.split('.');if(!connectionBaselines.has(id))connectionBaselines.set(id,{base:state[group][key],last:state[group][key]});if(state[group][key]!==v){state[group][key]=v;dirty=true;}connectionBaselines.get(id).last=v;}
  if(dirty){applyAudio();paint();}
 },
 snapshot(){
  let rms=0;if(running&&musicMeter){musicMeter.getFloatTimeDomainData(musicData);for(const v of musicData)rms+=v*v;rms=Math.sqrt(rms/musicData.length);}
  return {running,elapsed:elapsed+(running&&ctx?Math.max(0,ctx.currentTime-(lastTime??ctx.currentTime)):0),market:{...state.market},music:market().music,audioLevel:clamp(rms*8,0,1),rms,seed:state.market.seed,phraseSource:'Original market transmission'};
 },
 preset(){return unpatchedState();},
 load(value){const next=readPreset(value);connectionBaselines.clear();stop();state=next;solo=null;resetScore();build();save();},
};
