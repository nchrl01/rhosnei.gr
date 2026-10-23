// Inspector for the same four-channel APU that produces the application's sound.
// It consumes existing snapshots; it does not load patches, start an engine,
// or synthesize a separate preview.
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const pretty=value=>finite(value)?Number(Number(value).toFixed(4)).toString():'Unavailable';
const percent=value=>finite(value)?Math.round(Number(value)*100)+'%':'Unavailable';
const hex=value=>finite(value)?'0x'+Number(value).toString(16).toUpperCase().padStart(2,'0'):'—';
const display=value=>{
 if(value===null||value===undefined)return 'Unavailable';
 if(typeof value==='number')return pretty(value);
 if(typeof value==='boolean')return value?'On':'Off';
 if(typeof value==='object'){try{return JSON.stringify(value).slice(0,220);}catch{return 'Unavailable';}}
 return String(value).slice(0,220);
};
const channelNames=['CH1 · Pulse + sweep','CH2 · Pulse','CH3 · Wave RAM','CH4 · Noise'];
const roles=['Signal and tonal packets','Interlocking harmony','4-bit bass and wave shapes','Texture and noise packets'];
const duties=['12.5%','25%','50%','75%'];

export function createEngineView(container,{onBundle=()=>{}}={}){
 container.innerHTML=`<details class="engine-panel" open>
  <summary>Live engine · Game Boy APU</summary>
  <p class="engine-note">Signal, texture and packets share four sound channels. Each coin has its own circuit; observed market changes control when it sounds and how it changes.</p>
  <div class="engine-status"><span data-state>Paused</span><span data-feedback>Waiting for a chip snapshot</span><span data-source>Four-channel reconstruction</span></div>
  <section class="engine-bundles" aria-label="Sound layers"><small>Sound layers</small><p>These layers share the same chip. Turning a layer off removes its events from the composition.</p><div data-bundles></div></section>
  <div class="engine-overview">
   <section><small>Market observations</small><dl data-market></dl></section>
   <section><small>Chip and transport</small><dl data-chip></dl></section>
   <section><small>Visual field</small><dl data-visuals></dl></section>
  </div>
  <div class="engine-overview" data-channels aria-label="Four hardware channels"></div>
  <p class="engine-note">Activity controls occupancy, volume controls packet bursts, price changes bend pitch, and motion changes the noise clock. Missing or stale observations stop new sound. These are artistic mappings of the available data.</p>
  <details class="engine-source"><summary>Controls and accepted events</summary><div class="engine-overview"><section><small>App controls</small><dl data-controls></dl></section><section><small>Event feedback</small><dl data-events></dl></section></div></details>
  <details class="engine-console"><summary>Engine messages</summary><pre data-log>No engine messages.</pre></details>
 </details>`;
 const get=selector=>container.querySelector(selector);
 let view={},transport=null,lastPaint=0,lastFeedback=0,lastChipAt=0,lastChipSample=null,disposed=false;
 const controls=new Map(),events=new Map(),messages=[],bundleState={piano:true,envion:true,data:true};
 const bundleLabels={piano:'Signal',envion:'Texture',data:'Packets'};
 const buttons=[],channelTables=[];
 const row=(name,value)=>{
  const fragment=document.createDocumentFragment(),term=document.createElement('dt'),definition=document.createElement('dd');
  term.textContent=name;definition.textContent=display(value);fragment.append(term,definition);return fragment;
 };
 const table=(target,items)=>{
  const node=typeof target==='string'?get(target):target;
  node.replaceChildren(...items.map(([name,value])=>row(name,value)));
 };
 const remember=(map,name,value)=>{
  const key=String(name);map.set(key,value);
  if(map.size>32)map.delete(map.keys().next().value);
 };
 for(const [name,label] of Object.entries(bundleLabels)){
  const button=document.createElement('button');button.type='button';button.dataset.bundle=name;
  const labelButton=()=>{button.setAttribute('aria-pressed',String(bundleState[name]));button.textContent=label+' '+(bundleState[name]?'on':'off');};
  button.onclick=()=>{if(disposed)return;bundleState[name]=!bundleState[name];labelButton();onBundle(name,bundleState[name]);};
  labelButton();buttons.push(button);get('[data-bundles]').append(button);
 }
 const channelHost=get('[data-channels]');
 channelHost.style.gridTemplateColumns='repeat(auto-fit, minmax(min(100%, 210px), 1fr))';
 for(let index=0;index<4;index++){
  const section=document.createElement('section'),title=document.createElement('small'),description=document.createElement('p'),list=document.createElement('dl');
  title.textContent=channelNames[index];description.className='engine-note';description.textContent=roles[index];
  section.append(title,description,list);channelHost.append(section);channelTables.push(list);
 }
 function channelRows(channel,index,apu){
  if(!channel)return [['State','Waiting for snapshot']];
  const route=Number(apu.routing)||0,left=!!(route&(16<<index)),right=!!(route&(1<<index));
  const items=[
   ['Generator',channel.enabled?'Active':'Stopped'],
   ['DAC',channel.dac?'Enabled':'Off'],
   ['Digital level',finite(channel.digital)?channel.digital+' / 15':'Unavailable'],
   ['Stereo',left&&right?'Both':left?'Left':right?'Right':'Disconnected'],
  ];
  if(index<3){
   const frequency=Number(channel.frequency);
   items.push(['Pitch',finite(channel.frequency)&&frequency>=0&&frequency<2048?pretty((index===2?65536:131072)/(2048-frequency))+' Hz':'Unavailable']);
  }
  if(index<2)items.push(['Duty',duties[channel.duty]??'Unavailable'],['Envelope volume',finite(channel.volume)?channel.volume+' / 15':'Unavailable']);
  if(index===2)items.push(['Wave level',['Muted','Full','Half','Quarter'][channel.outputLevel]??'Unavailable'],['Sample position',finite(channel.position)?channel.position+' / 31':'Unavailable']);
  if(index===3){
   const noise=Number(channel.noise)||0;
   items.push(['Noise mode',noise&8?'7-bit':'15-bit'],['Clock shift',noise>>>4],['Clock divider',noise&7],['Envelope volume',finite(channel.volume)?channel.volume+' / 15':'Unavailable']);
  }
  items.push(['Length',channel.lengthEnabled?pretty(channel.length)+' ticks':'Disabled']);
  return items;
 }
 function paint(force=false){
  if(disposed||container.hidden)return;
  const now=performance.now();if(!force&&now-lastPaint<250)return;lastPaint=now;
  const instrument=view.instrument||{},chip=instrument.chip||{},apu=chip.apu;
  const signal=instrument.signal||{},m=view.m||{},context=m.context||{};
  if(apu&&apu.samples!==lastChipSample){lastChipSample=apu.samples;lastChipAt=now;}
  const error=instrument.error||chip.error;
  get('[data-state]').textContent=error?'Engine unavailable':view.playing?'Running':'Paused';
  get('[data-feedback]').textContent=error?String(error):!apu?'Waiting for a chip snapshot':!view.playing?'Chip paused':now-lastChipAt>3000?'Chip snapshot is stale':'Chip snapshot received';
  get('[data-source]').textContent='Game Boy APU · '+String(chip.model||apu?.model||'DMG').toUpperCase();
  const observed=signal.observed===true;
  const metric=value=>observed?percent(value):'Unavailable';
  const balanceKnown=signal.balanceKnown===true&&observed;
  const cap=context.latestCap;
  table('[data-market]',[
   ['Coin',view.coin||'Waiting'],['Source',signal.source||view.feed||'Waiting'],
   ['Observations',observed?'Available':'Unavailable'],
   ['Freshness',metric(signal.fresh)],
   ['Activity',metric(signal.activity)],['Volume intensity',signal.volumeKnown===true?metric(signal.volume):'Unavailable'],
   ['Motion',metric(signal.motion)],
   ['Price change',observed&&finite(signal.delta)?pretty(signal.delta)+'%':'Unavailable'],
   ['Buy share',balanceKnown?percent(signal.balance):'Unavailable'],
   ['Trade rate',observed&&signal.tradeRateKnown===true&&finite(signal.tradeRate)?pretty(signal.tradeRate)+'/sec':'Unavailable'],
   ['Market cap',finite(cap)&&Number(cap)>0?'$'+Math.round(Number(cap)).toLocaleString('en')+(context.capEstimated?' (estimate)':''):'Unavailable'],
  ]);
  const channels=Array.isArray(apu?.channels)?apu.channels:[];
  const sounding=channels.length?channels.filter(channel=>channel.enabled).length:null;
  const drums=instrument.drums||{};
  table('[data-chip]',[
   ['Instrument',instrument.name||'Waiting'],
   ['Active generators',sounding===null?'Awaiting snapshot':sounding+' / 4'],
   ['Chip clock',apu?pretty(apu.clock)+' Hz':'4,194,304 Hz'],
   ['Transport tempo',finite(instrument.tempo??view.bpm)?pretty(instrument.tempo??view.bpm)+' BPM':'Unavailable'],
   ['Queued events',finite(chip.pending)?chip.pending:'Unavailable'],
   ['Rejected events',finite(chip.rejected)?chip.rejected:'Unavailable'],
   ['Packet identity',drums.patternId||'Waiting'],
   ['Packet density',percent(drums.density)],['Packet deviation',percent(drums.deviation)],
   ['Stereo routing',hex(apu?.routing)],['Master register',hex(apu?.master)],
   ['Output','Chip mixer and DC removal'],
  ]);
  const v=view.visual;
  table('[data-visuals]',v?[
   ['Renderer',v.renderer==='earthbound'?'Earthbound · '+(v.backend||'preparing'):v.renderer||'Available'],
   ['Mark size',finite(v.baseMarkSize)?pretty(v.baseMarkSize)+' px':'Unavailable'],
   ['Empty gap',finite(v.gapPx)?pretty(v.gapPx)+' px':'Unavailable'],
   ['Marks',finite(v.markCount)?v.markCount:'Unavailable'],
   ['Holder data',v.holderSource==='observed-wallet-sample'?'Observed wallet snapshot':'Unavailable'],
   ['Coverage',v.holderCoverage||'Unavailable'],
   ['Market motion',percent(v.marketActivity)],
   ['Score accents',v.scoreReactive?'Accepted sound events':'Unavailable'],
   ['Queued accents',finite(v.scheduledScoreEvents)?v.scheduledScoreEvents:'Unavailable'],
   ['Accent level',finite(v.scoreAccent)?pretty(v.scoreAccent):'Unavailable'],
  ]:[['Visual','Waiting for a rendered frame']]);
  for(let i=0;i<4;i++)table(channelTables[i],channelRows(channels[i],i,apu));
  table('[data-controls]',controls.size?[...controls]:[['Controls','No changes received']]);
  table('[data-events]',events.size?[...events]:[['Feedback','No events received']]);
  if(transport?.connected===false&&!error)get('[data-feedback]').textContent='Audio transport disconnected';
  else if(!error&&!apu&&lastFeedback)get('[data-feedback]').textContent='Event feedback received; chip snapshot pending';
 }
 const timer=setInterval(()=>{if(!document.hidden)paint();},500);
 paint(true);
 return {
  update(next){if(disposed)return;view=next||{};paint();},
  sent(name,value){if(!disposed)remember(controls,name,value);},
  receive(name,value){if(disposed)return;remember(events,name,value);lastFeedback=performance.now();},
  log(text){if(disposed)return;messages.push(String(text).trim().slice(0,500));if(messages.length>24)messages.shift();get('[data-log]').textContent=messages.join('\n');},
  // Compatibility for callers from older builds; no obsolete patches load.
  setFiles(){},
  setTransport(state){if(disposed)return;transport=state;paint(true);},
  reset(){if(disposed)return;view={};events.clear();controls.clear();lastFeedback=0;lastChipAt=0;lastChipSample=null;transport=null;paint(true);},
  destroy(){disposed=true;clearInterval(timer);for(const button of buttons)button.onclick=null;},
 };
}
