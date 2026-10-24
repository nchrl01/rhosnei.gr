// Inspector for the same three four-channel APUs that produce the app's sound.
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
const chipNames=['Melody and bass','Harmony A','Harmony B and texture'];
const roles=[['Melodic phrase','Reserved','Sine bass','Reserved'],['Chord low A','Chord high A','Reserved','Reserved'],['Chord low B','Chord high B','Sustained texture','Reserved']];
const duties=['12.5%','25%','50%','75%'];

export function createEngineView(container,{onBundle=()=>{}}={}){
 container.innerHTML=`<details class="engine-panel" open>
  <summary>Live engine · Game Boy chip rack</summary>
  <p class="engine-note">Three Game Boy chips provide twelve sound channels for independent melody, harmony, bass and texture. Each coin has its own circuit; observed market changes control when it sounds and how it changes.</p>
  <div class="engine-status"><span data-state>Paused</span><span data-feedback>Waiting for chip snapshots</span><span data-source>Three chips · Twelve hardware channels</span></div>
  <section class="engine-bundles" aria-label="Sound layers"><small>Sound layers</small><p>These layers use the same three-chip rack. Turning a layer off removes its events from the composition.</p><div data-bundles></div></section>
  <div class="engine-overview">
   <section><small>Market observations</small><dl data-market></dl></section>
   <section><small>Chip and transport</small><dl data-chip></dl></section>
   <section><small>Visual field</small><dl data-visuals></dl></section>
  </div>
  <div class="engine-overview" data-channels aria-label="Three Game Boy chips with twelve hardware channels"></div>
  <p class="engine-note">Market cap shapes rhythm; liquidity shapes harmonic stability and sustain; holders shape arpeggio length and range; rising and falling prices shape contour and tone; activity sets tempo. Learned MIDI phrasing supplies motif, timing and articulation. Audible attacks, holds and echoes also move the visual. Missing measurements stay neutral; missing or stale activity stops new sound.</p>
  <details class="engine-source"><summary>Controls and accepted events</summary><div class="engine-overview"><section><small>App controls</small><dl data-controls></dl></section><section><small>Event feedback</small><dl data-events></dl></section></div></details>
  <details class="engine-console"><summary>Engine messages</summary><pre data-log>No engine messages.</pre></details>
 </details>`;
 const get=selector=>container.querySelector(selector);
 let view={},transport=null,lastPaint=0,lastFeedback=0,disposed=false;
 const chipProgress=Array.from({length:3},()=>({at:0,sample:null}));
 const controls=new Map(),events=new Map(),messages=[],bundleState={piano:true,envion:true,data:true};
 const bundleLabels={piano:'Signal',envion:'Texture',data:'Packets'};
 const buttons=[],channelCards=[];
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
 for(let index=0;index<12;index++){
  const chipIndex=Math.floor(index/4),channelIndex=index%4;
  const section=document.createElement('section'),title=document.createElement('small'),description=document.createElement('p'),list=document.createElement('dl');
  title.textContent='Chip '+(chipIndex+1)+' · '+channelNames[channelIndex];description.className='engine-note';description.textContent=chipNames[chipIndex]+' · '+roles[chipIndex][channelIndex];
  section.append(title,description,list);channelHost.append(section);channelCards.push({section,title,description,list});
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
  const chips=Array.isArray(chip.chips)&&chip.chips.length?chip.chips.slice(0,3):apu?[chip]:[{},{},{}];
  const snapshots=chips.filter(state=>state.apu),channelCount=chips.length*4;
  const signal=instrument.signal||{},m=view.m||{},context=m.context||{};
  chips.forEach((state,index)=>{if(state.apu&&state.apu.samples!==chipProgress[index].sample){chipProgress[index].sample=state.apu.samples;chipProgress[index].at=now;}});
  const stale=chips.some((state,index)=>state.apu&&now-chipProgress[index].at>3000);
  const error=instrument.error||chip.error;
  get('[data-state]').textContent=error?'Engine unavailable':view.playing?'Running':'Paused';
  get('[data-feedback]').textContent=error?String(error):!snapshots.length?'Waiting for chip snapshots':!view.playing?'Chips paused':stale?'A chip snapshot is stale':snapshots.length<chips.length?'Waiting for all chip snapshots':'Chip snapshots received';
  get('[data-source]').textContent=chips.length+' Game Boy '+(chips.length===1?'APU':'APUs')+' · '+channelCount+' channels · '+String(chip.model||apu?.model||'DMG').toUpperCase();
  const observed=signal.observed===true;
  const metric=value=>observed?percent(value):'Unavailable';
  const balanceKnown=signal.balanceKnown===true&&observed;
  const cap=context.latestCap;
  table('[data-market]',[
   ['Coin',view.coin||'Waiting'],['Source',signal.source||view.feed||'Waiting'],
   ['Observations',observed?'Available':'Unavailable'],
   ['Freshness',metric(signal.fresh)],
   ['Recent market activity',metric(signal.tradingActivity)],['Shared excitation',metric(signal.excitation)],
   ['Activity',metric(signal.activity)],['Volume intensity',signal.volumeKnown===true?metric(signal.volume):'Unavailable'],
   ['Motion',metric(signal.motion)],
   ['Price change',observed&&finite(signal.delta)?pretty(signal.delta)+'%':'Unavailable'],
   ['Buy share',balanceKnown?percent(signal.balance):'Unavailable'],
   ['Trade rate',observed&&signal.tradeRateKnown===true&&finite(signal.tradeRate)?pretty(signal.tradeRate)+'/sec':'Unavailable'],
   ['Market cap',finite(cap)&&Number(cap)>0?'$'+Math.round(Number(cap)).toLocaleString('en')+(context.capEstimated?' (estimate)':''):'Unavailable'],
  ]);
  const channels=chips.flatMap(state=>Array.isArray(state.apu?.channels)?state.apu.channels:[]);
  const sounding=channels.length?channels.filter(channel=>channel.enabled).length:null;
  const drums=instrument.drums||{},mapping=instrument.musicalMapping;
  table('[data-chip]',[
   ['Instrument',instrument.name||'Waiting'],
   ['Hardware',chips.length+' chips · '+channelCount+' channels'],
   ['Active generators',sounding===null?'Awaiting snapshots':sounding+' / '+channelCount+(snapshots.length<chips.length?' (partial snapshot)':'')],
   ['Chip clock',apu?pretty(apu.clock)+' Hz per chip':'4,194,304 Hz per chip'],
   ['Transport tempo',finite(instrument.tempo??view.bpm)?pretty(instrument.tempo??view.bpm)+' BPM':'Unavailable'],
   ['Queued events',finite(chip.pending)?chip.pending:'Unavailable'],
   ['Rejected events',finite(chip.rejected)?chip.rejected:'Unavailable'],
   ['Packet identity',drums.patternId||'Waiting'],
   ['Packet density',percent(drums.density)],['Packet deviation',percent(drums.deviation)],
   ['Cap → rhythm',mapping?.known?.marketCap?signal.marketCap>=1e6?'Denser chord and bass rhythm':'Spacious chord and bass rhythm':'Neutral · cap unavailable'],
   ['Liquidity → sustain',mapping?.known?.liquidity?percent(.78+.12*(mapping.harmony.musicality-.5)):'Neutral · liquidity unavailable'],
   ['Holders → arpeggio',mapping?.known?.holders?mapping.arpeggio.span+' semitone melody range':'Neutral · holders unavailable'],
   ['Price → contour',mapping?.known?.change?mapping.change.direction>0?'Rising':mapping.change.direction<0?'Falling':'Level':'Neutral · change unavailable'],
   ['Activity → tempo',mapping?.known?.activity?pretty(mapping.tempo.bpm)+' BPM before replay folding':'Neutral · activity unavailable'],
   ...chips.flatMap((state,index)=>[['Chip '+(index+1)+' routing',hex(state.apu?.routing)],['Chip '+(index+1)+' master',hex(state.apu?.master)]]),
   ['MIDI phrasing',chip.phrasing?.ready?'Source checks ready':chip.phrasing?.state||'Waiting'],
   ['Output','Chip mixers and DC removal'],
   ['Per-chip headroom',finite(chip.outputGain)?percent(chip.outputGain):'Unavailable'],
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
  for(let i=0;i<channelCards.length;i++){
   const card=channelCards[i],chipIndex=Math.floor(i/4),channelIndex=i%4,state=chips[chipIndex];
   card.section.hidden=!state;
   if(!state)continue;
   card.description.textContent=(state.name||chipNames[chipIndex])+' · '+(state.channelRoles?.[channelIndex]||roles[chipIndex][channelIndex]);
   table(card.list,channelRows(state.apu?.channels?.[channelIndex],channelIndex,state.apu));
  }
  table('[data-controls]',controls.size?[...controls]:[['Controls','No changes received']]);
  table('[data-events]',events.size?[...events]:[['Feedback','No events received']]);
  if(transport?.connected===false&&!error)get('[data-feedback]').textContent='Audio transport disconnected';
  else if(!error&&!snapshots.length&&lastFeedback)get('[data-feedback]').textContent='Event feedback received; chip snapshots pending';
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
  reset(){if(disposed)return;view={};events.clear();controls.clear();lastFeedback=0;for(const state of chipProgress){state.at=0;state.sample=null;}transport=null;paint(true);},
  destroy(){disposed=true;clearInterval(timer);for(const button of buttons)button.onclick=null;},
 };
}
