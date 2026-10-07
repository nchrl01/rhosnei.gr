import {createMarketLandmarks} from './market-landmarks.js?v=208';
import {seedTonic,keyName} from './seed-key.js?v=1';
import {knob} from './lab-knob.js?v=1';
import {marketSpecs,mixSpecs,pianoSpecs,dataSpecs,phraseSpecs,envionSpecs} from './audio-lab-specs.js?v=188';
import {createMusicContext,unlockPlayback,stopLegacyPlayback} from './audio-unlock.js?v=220';
import {createTradePiano} from './trade-piano.js?v=220';
import {EARTHBOUND_PRESETS,EARTHBOUND_INSTRUMENTS,instrumentProfile} from './earthbound-instruments.js?v=209';
import {createEnvion} from './envion.js?v=220';
import {createPd} from './vendor/libpd-wasm.js?v=220';
import {createDataSonification} from './data-sonification.js?v=214';
import {createMathPatterns,mathIdentity} from './math-patterns.js?v=208';
import {createArpeggioAI,seededArp} from './ai-instruments.js?v=209';
import {HARMONIES,CHARACTER_GROUPS,pianoHarmony,chartCharacter,resolveHarmonicCharacter} from './music-context.js?v=208';
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),combinedLab=Boolean(document.getElementById('patch-workspace'));
const connectionBaselines=new Map();
const KEY='upic-audio-lab-v1',groups={market:marketSpecs,mix:mixSpecs,piano:pianoSpecs};
const pdSpecs=[...envionSpecs,...dataSpecs,...phraseSpecs.flat()];
const defaults=()=>({schema:'upic-audio-lab',version:1,market:Object.fromEntries(marketSpecs.map(s=>[s[0],s[5]])),mix:Object.fromEntries(mixSpecs.map(s=>[s[0],s[5]])),piano:{},pd:{},enabled:Object.fromEntries(mixSpecs.map(([key])=>[key,!(combinedLab&&key==='math')])),slots:combinedLab?[false,false,false,false,false]:[true,true,true,true,true],slotLevels:[1,1,1,1,1],master:.5,instrument:-1,character:'auto',seedKey:true,autoTrades:true,arpeggios:true,notes:'',arp:seededArp(1917)});
let state=defaults(),ctx,piano,pd,envionReady=false,running=false,starting=false,closed=false,timer,saveTimer;
let transport,master,musicMeter,meter,meterData,musicData,elapsed=0,lastTime=null,nextTrade=0,tradeIndex=0,price=1,phraseViews=[],paints=[],pdValues={},lastUI=0;
let idleSuspend=null,seedTimer=null;
let solo=null,buses={},engineStatus={GeneralUser:'Not loaded','Pure Data':'Not loaded',ENVION:'Not loaded',Arpeggio:'Seeded phrase'},statuses={};
const report=text=>{$('status').textContent=text;};
function readPreset(data){
 if(data?.schema!=='upic-audio-lab'||data.version!==1)throw Error('Not an Audio Lab preset');
 const next=defaults();
 for(const [group,specs] of Object.entries(groups))for(const [key,,min,max,step] of specs)if(Number.isFinite(data[group]?.[key]))next[group][key]=clamp(Math.round(data[group][key]/step)*step,min,max);
 for(const [key,,min,max,step] of pdSpecs)if(Number.isFinite(data.pd?.[key]))next.pd[key]=clamp(Math.round(data.pd[key]/step)*step,min,max);
 for(const [key] of mixSpecs)if(typeof data.enabled?.[key]==='boolean')next.enabled[key]=data.enabled[key];
 for(let i=0;i<5;i++){if(typeof data.slots?.[i]==='boolean')next.slots[i]=data.slots[i];if(Number.isFinite(data.slotLevels?.[i]))next.slotLevels[i]=clamp(data.slotLevels[i],0,1);}
 for(const key of ['autoTrades','arpeggios','seedKey'])if(typeof data[key]==='boolean')next[key]=data[key];
 if(combinedLab){next.mix.math=0;next.enabled.math=false;next.slots.fill(false);}
 if(Number.isFinite(data.master))next.master=clamp(data.master,0,1);
 if(Number.isInteger(data.instrument)&&(data.instrument===-1||EARTHBOUND_PRESETS.includes(data.instrument)))next.instrument=data.instrument;
 if(typeof data.character==='string')next.character=data.character==='auto'?'auto':resolveHarmonicCharacter(data.character);
 if(typeof data.notes==='string')next.notes=data.notes.slice(0,10000);
 if(Array.isArray(data.arp)&&data.arp.length>=3&&data.arp.length<=16&&data.arp.every((p,i)=>Array.isArray(p)&&p.length===2&&Number.isInteger(p[0])&&p[0]>=0&&p[0]<16&&Number.isInteger(p[1])&&p[1]>=48&&p[1]<=83&&(!i||p[0]>data.arp[i-1][0])))next.arp=data.arp;
 else next.arp=seededArp(next.market.seed);
 if([[60,67,63,72,67,63,60,67],[60,64,67,72,67,64,60,67]].some(notes=>JSON.stringify(next.arp)===JSON.stringify(notes.map((n,i)=>[i,n]))))next.arp=seededArp(next.market.seed);
 return next;
}
try{const saved=localStorage.getItem(KEY);if(saved)state=readPreset(JSON.parse(saved));}catch{}
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(unpatchedState()));}catch{report('Browser storage unavailable. Export your preset to keep it.');}},200);}
const level=key=>state.enabled[key]&&(!solo||solo===key)?state.mix[key]:0;
function send(name,value){
 pdValues[name]=value;let v=Object.hasOwn(state.pd,name)?state.pd[name]:value;
 if(name==='melody')v*=level('envion');
 if(name==='data-level')v*=level('data');
 const slot=/^math-(\d)-level$/.exec(name);if(slot)v*=level('math')*state.slotLevels[Number(slot[1])];
 pd?.sendFloat(name,v);
}
const data=createDataSonification({send,event:name=>pd?.sendBang(name)});
const math=createMathPatterns({send,onView:view=>{phraseViews=view.slots;}});
const envion=createEnvion($('envion-host'));
const arpAI=createArpeggioAI({onStatus:text=>setStatus('Arpeggio',text),onPattern:pattern=>{state.arp=pattern;piano?.setArpeggioPattern(pattern);save();}});
function setStatus(name,text){engineStatus[name]=text;if(statuses[name])statuses[name].textContent=text;}
for(const [name,text] of Object.entries(engineStatus)){const row=document.createElement('div');row.className='engine-line';const a=document.createElement('span'),b=document.createElement('span');a.textContent=name;b.textContent=text;statuses[name]=b;row.append(a,b);$('engines').append(row);}
const labLandmarks=createMarketLandmarks();
function currentTonic(){return state.seedKey&&!connectionBaselines.has('market.tonic')?seedTonic(state.market.seed):state.market.tonic;}
function market(){
 const s=state.market;
 const movement=labLandmarks.observe(s.cap*price,elapsed*1000,'lab:'+s.seed);
 const features={movement,group:movement.group,capChangePct:movement.changePct,changePct:s.change,intensity:s.intensity,volatility:s.motion,trendConsistency:1-s.motion,volumeRatio:1+s.volume*8};
 const character=state.character==='auto'?chartCharacter(features):state.character;
 const music={...features,tempo:s.tempo,activity:s.activity,tonic:currentTonic(),character};
 music.harmony=pianoHarmony(s.seed,{chordStep:tradeIndex},music);
 return {activity:s.activity,volume:s.volume,motion:s.motion,texture:s.liquidity,balance:s.balance,fresh:s.fresh,tradeRate:s.activity*20,music,raw:{activity:s.activity,volume:s.volume,motion:s.motion},availability:{liquidity:true,balance:true,volume:true},context:{latestCap:s.cap*price,direction:Math.sign(s.change),pressure:s.pressure,shock:s.shock},replay:{sceneSeed:s.seed,at:0,volume:s.volume}};
}
function applyAudio(){
 if(!ctx)return;master.gain.setTargetAtTime(state.master,ctx.currentTime,.025);
 for(const key of ['earthbound'])buses[key]?.gain.setTargetAtTime(level(key),ctx.currentTime,.025);
 piano?.configure({...state.piano,preset:state.instrument,arpeggios:state.arpeggios});piano?.setEnabled(level('earthbound')>0);piano?.setArpeggioPattern(state.arp);

 data.setEnabled(level('data')>0);math.setEnabled(level('math')>0);state.slots.forEach((v,i)=>math.setSlot(i,v));
 // ENVION caches automatic writes. Reapply explicit overrides immediately.
 for(const [name,value] of Object.entries(state.pd))send(name,pdValues[name]??value);
 envion.setOverrides(Object.fromEntries(Object.entries(state.pd).filter(([name])=>/^av-envion-ui-c0-\d+$/.test(name))));
}
function resetScore(){
 clearTimeout(seedTimer);elapsed=0;lastTime=ctx?.currentTime??null;nextTrade=0;tradeIndex=0;price=1;pdValues={};
 piano?.reset(state.market.seed);math.setSeed(state.market.seed);data.reset(state.market.seed);envion.setSeed(state.market.seed);send('seed',state.market.seed);applyAudio();
}
async function asset(path,type='text'){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 try{const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error('Could not load '+path);return await response[type]();}finally{clearTimeout(timeout);}
}
let loadJob=null;
async function loadEngines(){
 if(loadJob)return loadJob;
 loadJob=(async()=>{
  const jobs=[];
  if(!piano){setStatus('GeneralUser','Loading samples…');jobs.push(createTradePiano(ctx,buses.earthbound,{initialSeed:state.market.seed,onVoice:event=>{$('last-note').textContent=event.instrument+' · '+event.notes.join(' / ')+' · '+event.reason;},onArpeggio:event=>{$('last-note').textContent='Arpeggio · MIDI '+event.midi;}}).then(result=>{if(closed){result.close();return;}piano=result;piano.reset(state.market.seed);piano.setMaster(1);piano.setRunning(running);applyAudio();refreshInstruments();setStatus('GeneralUser','Ready');}).catch(error=>setStatus('GeneralUser',error.message)));}
  if(!pd){setStatus('Pure Data','Loading patches…');setStatus('ENVION','Loading samples…');jobs.push((async()=>{
   const [orchestra,envionFiles]=await Promise.all([(async()=>{const manifest=await asset('patches/orchestra/manifest.json?v=214','json');const pairs=await Promise.all(manifest.files.map(async name=>['orchestra/'+name,await asset('patches/orchestra/'+name+'?v=214')]));return {manifest,files:Object.fromEntries(pairs)};})(),envion.files()]);
   if(closed)return;const files={...orchestra.files,...envionFiles};
   const result=await createPd({audioContext:ctx,packages:['vanilla','cyclone','else'],files,entry:'orchestra/'+orchestra.manifest.entry,workletUrl:'vendor/libpd-worklet-full.js?v=220',onPrint:text=>envion.printed(text),onError:error=>setStatus('Pure Data',String(error?.message||error))});
   if(closed){await result.close();return;}pd=result;pd.connect(musicMeter);send('master',1);send('seed',state.market.seed);send('run',running?1:0);setStatus('Pure Data','Ready');
   // Intercept only numeric controls; all other runtime methods retain their binding.
   const proxy=new Proxy(pd,{get(target,key){if(key==='sendFloat')return send;const value=target[key];return typeof value==='function'?value.bind(target):value;}});
   try{envionReady=await envion.attach(proxy,ctx,files);envion.setSeed(state.market.seed);envion.setRunning(running);setStatus('ENVION',envionReady?'Ready':'Not attached');}catch(error){setStatus('ENVION',error.message);send('av-envion-ready',0);}
   applyAudio();
  })().catch(error=>{setStatus('Pure Data',error.message);setStatus('ENVION','Unavailable · restart audio to retry');}));}
  await Promise.allSettled(jobs);
 })();try{await loadJob;}finally{loadJob=null;if(!running&&!closed)stop();}
}
function setup(){
 ctx=createMusicContext();transport=ctx.createGain();transport.gain.value=0;master=ctx.createGain();master.gain.value=state.master;
 const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;
 musicMeter=ctx.createAnalyser();musicMeter.fftSize=1024;musicData=new Float32Array(1024);musicMeter.connect(transport);
 transport.connect(limiter);limiter.connect(master);meter=ctx.createAnalyser();meter.fftSize=1024;master.connect(meter);meter.connect(ctx.destination);meterData=new Float32Array(1024);
 for(const key of ['earthbound']){const bus=ctx.createGain();bus.gain.value=level(key);bus.connect(musicMeter);buses[key]=bus;}
 ctx.addEventListener('statechange',()=>{if(ctx.state==='interrupted'||ctx.state==='suspended'){if(running)stop();report('Audio paused. Tap Start audio to resume.');}});
 timer=setInterval(tick,50);
}
async function start(){
 if(starting||closed)return;clearTimeout(idleSuspend);if(running){stop();return;}
 starting=true;$('play').disabled=true;
 try{
  if(!ctx)setup();await unlockPlayback(ctx);running=true;lastTime=ctx.currentTime;nextTrade=elapsed;transport.gain.setTargetAtTime(1,ctx.currentTime,.04);
  piano?.setRunning(true);envion.setRunning(true);send('run',1);
  $('play').textContent='Pause audio';$('chord').disabled=false;$('trade').disabled=false;
  void loadEngines().then(()=>{if(!closed&&running){nextTrade=elapsed;report(piano||pd?'Loading finished. Check the engine statuses, then audition a chord.':'Audio engines could not load. Pause and start to retry.');}});
  applyAudio();
 }catch(error){stop();report(error.message);}finally{starting=false;$('play').disabled=false;}
}
function stop(){
 running=false;lastTime=null;transport?.gain.setTargetAtTime(0,ctx.currentTime,.025);piano?.setRunning(false);envion.setRunning(false);math.stop();send('run',0);stopLegacyPlayback();arpAI.suspend();
 $('play').textContent='Start audio';$('chord').disabled=true;$('trade').disabled=true;clearTimeout(idleSuspend);if(ctx&&!closed&&!loadJob)idleSuspend=setTimeout(()=>{if(!running)void ctx.suspend().catch(()=>{});},120);paint();
}
function trigger(force=false){
 if(!running||!ctx||ctx.state!=='running')return;
 const at=elapsed*1000;price=clamp(price*(1+state.market.change/100),1e-12,1e12);const m=market();
 const event={kind:'swap',id:'lab-'+tradeIndex,at,receivedAt:at,occurredAt:at,price,priceUsd:price,referencePrice:price/(1+state.market.change/100),chordStep:tradeIndex,music:m.music};
 if(force)piano?.replay(event,{reason:'movement',at,changePct:state.market.change},m.context.latestCap,m.music);
 else piano?.trade(event,m.context.latestCap,m.music);
 data.event(event,{playing:true,clock:ctx.currentTime});tradeIndex++;
}
function tick(){
 if(!ctx||closed||!running)return;
 const now=ctx.currentTime;if(running&&ctx.state==='running'){
  elapsed+=Math.min(.25,Math.max(0,now-(lastTime??now)));lastTime=now;
  if(state.autoTrades&&state.market.activity>0&&state.market.fresh>0&&elapsed>=nextTrade){trigger();nextTrade=elapsed+60/state.market.tempo*state.market.tradeBeats;}
  const m=market();send('tempo',state.market.tempo);send('activity',m.activity);send('motion',m.motion);send('energy',m.music.intensity);send('balance',m.balance);send('texture',m.texture);send('heartbeat',1);send('tonic',currentTonic());send('cutoff',900+m.texture*3100+m.music.intensity*1800);
  send('melody',.6*m.music.intensity*m.fresh);if(envionReady)envion.market(m,state.market.tempo);
  data.frame(m,{playing:true,clock:now});math.frame(m,{playing:true,ready:!!pd,clock:now,event:tradeIndex?'lab-'+(tradeIndex-1):null});
  piano?.frame({...m,replay:null},{playing:true,at:elapsed*1000,price,known:true,quiet:state.market.activity===0});
 }
 if(now-lastUI>.15||!running){lastUI=now;paint();}
}
function section(title,description,open=false){const d=document.createElement('details');d.open=open;const s=document.createElement('summary');s.textContent=title;const p=document.createElement('p');p.className='group-note';p.textContent=description;const grid=document.createElement('div');grid.className='grid';d.append(s,p,grid);$('controls').append(d);return grid;}
function changed(){
 for(const [id,held] of connectionBaselines){const [group,key]=id.split('.');if(state[group][key]!==held.last)held.base=state[group][key];}
 applyAudio();save();paint();
}
function addKnob(parent,spec,get,set,auto,manual){knob(parent,spec,get,set,{auto,manual,onChange:changed,paints});}
function direct(parent,group,spec){addKnob(parent,spec,()=>group==='market'&&spec[0]==='tonic'?currentTonic():state[group][spec[0]],v=>{state[group][spec[0]]=v;if(spec[0]==='tonic')state.seedKey=false;if(spec[0]==='seed'){state.arp=seededArp(v);arpAI.setSeed(v,state.arp);clearTimeout(seedTimer);seedTimer=setTimeout(resetScore,180);}});}
function select(parent,label,options,value,onChange,id){const row=document.createElement('label');row.className='select-row';row.append(document.createTextNode(label));const el=document.createElement('select');if(id)el.id=id;const groups=new Map();for(const [v,name,group] of options){const option=document.createElement('option');option.value=v;option.textContent=name;if(group){if(!groups.has(group)){const section=document.createElement('optgroup');section.label=group;el.append(section);groups.set(group,section);}groups.get(group).append(option);}else el.append(option);}el.value=String(value);el.onchange=()=>{onChange(el.value);changed();};row.append(el);parent.append(row);return el;}
function action(parent,label,run){const b=document.createElement('button');b.textContent=label;b.className='action';b.onclick=run;parent.append(b);return b;}
function switchButton(parent,label,get,set){const b=document.createElement('button');b.onclick=()=>{set(!get());changed();};paints.push(()=>{b.textContent=label+' · '+(get()?'on':'off');b.setAttribute('aria-pressed',get());});parent.append(b);return b;}
function pianoAuto(key){
 const snapshot=piano?.snapshot(),profile=instrumentProfile(snapshot?.preset??1),a=clamp((Math.log10(Math.max(1000,state.market.cap))-4)/3,0,1);
 return ({roomSend:.7-.46*a,cutoff:profile.cutoff*(.7+.3*a),dry:.3+.55*a,wet:1.1-.45*a,q:.55,noteGain:1,chordGain:1,arpGain:1,...profile})[key]??pianoSpecs.find(s=>s[0]===key)?.[5]??0;
}
function pdKnobs(parent,specs){for(const spec of specs){const key=spec[0];addKnob(parent,spec,()=>state.pd[key]??pdValues[key]??spec[5],v=>state.pd[key]=v,()=>{delete state.pd[key];if(Number.isFinite(pdValues[key]))send(key,pdValues[key]);},()=>Object.hasOwn(state.pd,key));}}
function refreshInstruments(){const el=$('instrument-select');if(!el)return;el.replaceChildren();for(const [v,name] of [[-1,'AUTO · instrument from coin seed'],...(piano?.instruments()||EARTHBOUND_INSTRUMENTS).filter(x=>![145,146].includes(x.preset)).map(x=>[x.preset,x.name])]){const option=document.createElement('option');option.value=v;option.textContent=name;el.append(option);}if(![...el.options].some(o=>Number(o.value)===state.instrument)){state.instrument=-1;piano?.configure({...state.piano,preset:-1,arpeggios:state.arpeggios});}el.value=String(state.instrument);}
function build(){
 $('controls').replaceChildren();paints=[];$('notes').value=state.notes;
 const mixer=section('01 / Mixer','Mute or solo any layer. Listening volume is applied after the engines. The waveform shows what you hear.',true);
 addKnob(mixer,['master','Listening volume',0,1,.01],()=>state.master,v=>state.master=v);
 for(const spec of mixSpecs)direct(mixer,'mix',spec);
 const switches=document.createElement('div');switches.className='switches';mixer.append(switches);
 for(const [key,label] of mixSpecs){switchButton(switches,label,()=>state.enabled[key],v=>state.enabled[key]=v);const b=document.createElement('button');b.onclick=()=>{solo=solo===key?null:key;changed();};switches.append(b);paints.push(()=>{b.textContent='Solo '+label;b.setAttribute('aria-pressed',solo===key);});}
 const input=section('02 / Market + musical context','Simulated normalized inputs (0–1). Regular trades sound a phrase every four beats; ≥5% movement advances the chord. UP/DOWN follows the simulated market cap, with a directional phrase at each ±20% step. Price change compounds the simulated cap with each trade. Play chord auditions the next harmony immediately. Tempo is shared by the engines. No tokens are fetched. Trade interval sets the audition cadence; activity and freshness gate it. USD liquidity, USD volume, trade rate, holder count and concentration are raw routing inputs; connect them in the combined lab to drive normalized engine controls.',true);
 for(const spec of marketSpecs)direct(input,'market',spec);
 switchButton(input,'Key from seed',()=>state.seedKey,v=>state.seedKey=v);
 const keyInfo=document.createElement('p');keyInfo.className='lab-hint';input.append(keyInfo);const directionInfo=document.createElement('p');directionInfo.className='lab-hint';input.append(directionInfo);paints.push(()=>{const m=market().music;directionInfo.textContent=m.group.toUpperCase()+' · '+HARMONIES[m.character].name+' · '+Math.abs(m.capChangePct).toFixed(1)+'% toward the 20% landmark';});paints.push(()=>keyInfo.textContent='KEY · '+keyName(currentTonic())+' · '+(state.seedKey&&!connectionBaselines.has('market.tonic')?'fixed by coin seed':'manual / cable')+' · mood keeps this tonic');
 select(input,'Harmonic character',[['auto','AUTO · UP / DOWN from market cap'],...Object.entries(CHARACTER_GROUPS).flatMap(([group,keys])=>keys.map(k=>[k,HARMONIES[k].name,group.toUpperCase()]))],state.character,v=>state.character=v);
 const tradeSwitch=document.createElement('div');tradeSwitch.className='switches';input.append(tradeSwitch);switchButton(tradeSwitch,'Automatic trades',()=>state.autoTrades,v=>{state.autoTrades=v;nextTrade=elapsed;});
 const melodic=section('03 / GeneralUser · chords + arpeggios','Choose the actual sampled instrument. AUTO follows its envelope and market-cap articulation. Chords and arpeggios always share the selected instrument.',true);
 select(melodic,'Instrument',[[-1,'Load audio to see instrument library']],state.instrument,v=>state.instrument=Number(v),'instrument-select');refreshInstruments();
 for(const spec of pianoSpecs){const key=spec[0];addKnob(melodic,spec,()=>state.piano[key]??pianoAuto(key),v=>state.piano[key]=v,()=>delete state.piano[key],()=>Object.hasOwn(state.piano,key));}
 const arpSwitch=document.createElement('div');arpSwitch.className='switches';melodic.append(arpSwitch);switchButton(arpSwitch,'Arpeggios',()=>state.arpeggios,v=>state.arpeggios=v);
 action(melodic,'Generate AI phrase · download model',()=>{arpAI.setSeed(state.market.seed);arpAI.setContext(market().music);void arpAI.prepare();});
 action(melodic,'Restore seeded phrase',()=>{arpAI.suspend();state.arp=seededArp(state.market.seed);arpAI.setSeed(state.market.seed,state.arp);changed();});
 const arpInfo=document.createElement('p');arpInfo.className='lab-hint';melodic.append(arpInfo);paints.push(()=>arpInfo.textContent='Phrase pitches: '+state.arp.map(x=>x[1]).join(' · ')+' · interlocking layers remain market-cap gated');
 const env=section('04 / ENVION · granular + tape + effects','Every market-mapped ENVION parameter. AUTO shows the current performer value after audio loads. Overrides stay fixed while the market conductor keeps running. Original samples remain loaded.');pdKnobs(env,envionSpecs);
 const signals=section('05 / Data sonification','Pure Data pulses, noise and low tones. AUTO follows market excitation; manual pitch overrides can intentionally leave the current key. Mute this layer in the mixer.');pdKnobs(signals,dataSpecs);
 const identities=mathIdentity(state.market.seed);
 if(!combinedLab)for(let i=0;i<5;i++){
  const grid=section('06.'+(i+1)+' / Market phrase','Seeded function with a finite eight-beat passage. Pitch is tuned to the shared harmony unless overridden. Sawtooth synthesis is fixed.');
  const name=document.createElement('p');name.className='lab-hint';grid.append(name);paints.push(()=>{const view=phraseViews[i];name.textContent=(view?.name||identities[i].name)+' · ≥ $'+(view?.threshold||identities[i].threshold).toLocaleString()+' · '+(view?.status||'Start audio');});
  const sw=document.createElement('div');sw.className='switches';grid.append(sw);switchButton(sw,'Phrase '+(i+1),()=>state.slots[i],v=>state.slots[i]=v);
  addKnob(grid,['slot'+i,'Phrase level',0,1,.01],()=>state.slotLevels[i],v=>state.slotLevels[i]=v);pdKnobs(grid,phraseSpecs[i]);
 }
 paint();
}
function paint(){
 for(const fn of paints)fn();
 const m=market(),s=piano?.snapshot();$('instrument').textContent=s?.name||'Your sound. Your controls.';$('harmony').textContent=m.music.harmony.name+' · '+m.music.harmony.progression+' · '+state.market.tempo+' BPM';
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
 const lines=['# UPIC audio change note','',state.notes||'No written notes.','', '## Audition context','',`- Seed: ${state.market.seed}`,`- Instrument: ${piano?.snapshot()?.name||'Seeded / not loaded'} (preset ${state.instrument})`,`- Harmony: ${market().music.harmony.name}`,`- Tempo: ${state.market.tempo} BPM`,`- Solo during audition: ${solo||'none'}`,'','## Controls',''];
 for(const [group,specs] of Object.entries(groups)){lines.push('### '+group,'');for(const [key,label] of specs)lines.push('- '+label+': '+(state[group][key]??'AUTO'));lines.push('');}
 lines.push('### Pure Data overrides','');for(const [key,label] of pdSpecs)if(Object.hasOwn(state.pd,key))lines.push('- '+label+' ('+key+'): '+state.pd[key]);
 lines.push('','## Complete reproducible preset','','```json',JSON.stringify(state,null,2),'```','','Synthetic market inputs; manual controls can override live market gating. This export does not modify production.');
 download('upic-audio-change-note.md',lines.join('\n'),'text/markdown');report('Change note exported. Attach it in our chat.');
};
$('load').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('Preset is too large');const next=readPreset(JSON.parse(await file.text()));stop();arpAI.suspend();state=next;solo=null;resetScore();build();save();report('Preset loaded. Press Start audio to hear it.');}catch(error){report(error.message);}finally{event.target.value='';}};
$('reset').onclick=()=>{connectionBaselines.clear();stop();arpAI.suspend();state=defaults();solo=null;resetScore();build();save();report('Default settings restored. Press Start audio.');};
// Hidden pages stop expensive DSP and sequencing; return requires a deliberate tap.
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();void ctx?.suspend().catch(()=>{});}});
window.addEventListener('pagehide',()=>{closed=true;stop();clearInterval(timer);clearTimeout(saveTimer);clearTimeout(idleSuspend);clearTimeout(seedTimer);piano?.close();arpAI.close();envion.detach();void pd?.close();void ctx?.close();});
math.setSeed(state.market.seed);data.reset(state.market.seed);build();

window.addEventListener('pageshow',event=>{if(event.persisted&&closed)location.reload();});

function unpatchedState(){
 const result=JSON.parse(JSON.stringify(state));
 for(const [id,held] of connectionBaselines){const [group,key]=id.split('.');if(held.base===undefined)delete result[group][key];else result[group][key]=held.base;}
 return result;
}
const connectionSpecs={...Object.fromEntries(Object.entries(groups).flatMap(([group,specs])=>specs.filter(s=>s[0]!=='seed').map(spec=>[group+'.'+spec[0],spec]))),...Object.fromEntries(pdSpecs.map(spec=>['pd.'+spec[0],spec]))};
function readControl(id){if(id==='market.tonic')return currentTonic();const [group,key]=id.split('.');return state[group]?.[key]??(group==='piano'?pianoAuto(key):group==='pd'?pdValues[key]:undefined)??connectionSpecs[id]?.[5]??0;}
function connectionValue(id,value){const spec=connectionSpecs[id];if(!spec||!Number.isFinite(value))return null;return clamp(Math.round(value/spec[4])*spec[4],spec[2],spec[3]);}
// Shared-engine interface for the combined audiovisual workspace.
export const audioLab={
 descriptors(){return Object.entries(connectionSpecs).filter(([id])=>!combinedLab||(!id.startsWith('math.')&&!id.startsWith('pd.math-')&&id!=='mix.math')).map(([id,s])=>({id,label:s[1],min:s[2],max:s[3],step:s[4],category:id.startsWith('market.')?'Market':id.startsWith('pd.av-envion-ui-c0-')?'ENVION':'Audio'}));},
 controls(){return Object.fromEntries(Object.keys(connectionSpecs).map(id=>[id,readControl(id)]));},
 setControl(id,value){if(id==='market.tonic')state.seedKey=false;const v=connectionValue(id,value);if(v===null)return;const [group,key]=id.split('.');if(connectionBaselines.has(id))connectionBaselines.get(id).base=v;else state[group][key]=v;changed();},
 connect(patch={}){
  let dirty=false;
  for(const [id,held] of connectionBaselines)if(!Object.hasOwn(patch,id)){const [group,key]=id.split('.');if(held.base===undefined)delete state[group][key];else state[group][key]=held.base;if(group==='pd'&&Number.isFinite(pdValues[key]))send(key,pdValues[key]);connectionBaselines.delete(id);dirty=true;}
  for(const [id,value] of Object.entries(patch)){const v=connectionValue(id,value);if(v===null)continue;const [group,key]=id.split('.');if(!connectionBaselines.has(id))connectionBaselines.set(id,{base:state[group][key],last:state[group][key]});if(state[group][key]!==v){state[group][key]=v;dirty=true;}connectionBaselines.get(id).last=v;}
  envion.setOverrides(Object.fromEntries(Object.entries(state.pd).filter(([name])=>/^av-envion-ui-c0-\d+$/.test(name))));
  if(dirty){applyAudio();paint();}
 },
 snapshot(){
  let rms=0;if(running&&musicMeter){musicMeter.getFloatTimeDomainData(musicData);for(const v of musicData)rms+=v*v;rms=Math.sqrt(rms/musicData.length);}
  return {running,elapsed:elapsed+(running&&ctx?Math.max(0,ctx.currentTime-(lastTime??ctx.currentTime)):0),market:{...state.market,tonic:currentTonic()},music:market().music,audioLevel:clamp(rms*8,0,1),rms,seed:state.market.seed};
 },
 preset(){return unpatchedState();},
 load(value){const next=readPreset(value);connectionBaselines.clear();stop();arpAI.suspend();state=next;solo=null;resetScore();build();save();},
};
