import {composeGameBoyDrumBar} from './gameboy-drum-pattern.js?v=468';

// Original market-to-register composition. No imported songs, drum loops,
// learned melodies, or human backbeat templates. A seed chooses the circuit;
// observed data supplies its excitation. Time only advances that circuit.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(n,fallback=0)=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):fallback;
const unit=n=>clamp(number(n),0,1);
export const chipHash=(seed,n)=>{let x=((seed>>>0)^Math.imul((n|0)+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0;};
const roll=(seed,n)=>chipHash(seed,n)/4294967296;
function fingerprint(values){let h=2166136261;for(const value of values){for(const char of String(value))h=Math.imul(h^char.charCodeAt(0),16777619)>>>0;}return h;}

export function marketChipSignal(context={}){
 if(context.signal)return context.signal;
 const m=context.metrics||context,music=context.music||m.music||{},raw=m.raw||m;
 const price=number(m.price??m.context?.latestPrice??m.replay?.price);
 const reference=number(m.referencePrice);
 const delta=reference>0&&price>0?100*(price/reference-1):number(m.delta??music.lastMove??music.changePct);
 const activity=unit(raw.activity??music.activity),volume=unit(raw.volume);
 const motion=unit(raw.motion??music.volatility),intensity=unit(music.intensity);
 const observed=m.observed??(price>0||[raw.activity,raw.motion,raw.volume,music.activity,music.intensity,music.changePct].some(x=>x!=null&&Number.isFinite(Number(x))));
 const fresh=unit(m.fresh??(observed?1:0));
 const balance=m.availability?.balance===false?.5:clamp(number(m.balance,.5),0,1),tradeRate=Math.max(0,number(m.tradeRate));
 const source=m.source??m.replay?.source??(m.decoded?'trades':'snapshots');
 const balanceKnown=m.availability?.balance!==false&&Number.isFinite(m.balance)&&source!=='candles';
 const tradeRateKnown=m.availability?.tradeRate===true||m.decoded===true||source==='lab'||source==='trades';
 const volumeKnown=m.availability?.volume!==false&&raw.volume!=null;
 const data=[price>0?price.toPrecision(10):0,delta.toFixed(5),activity.toFixed(4),volume.toFixed(4),motion.toFixed(4),balance.toFixed(3),tradeRate.toFixed(3)];
 const observationFingerprint=fingerprint(data);
 // Cache identity includes every feature that affects the sound. Freshness
 // can change expression without pretending a new market event arrived.
 return {price,delta,activity,volume,motion,intensity,balance,tradeRate,fresh,observed:!!observed,balanceKnown,tradeRateKnown,volumeKnown,observationFingerprint,fingerprint:fingerprint([...data,intensity.toFixed(4),fresh.toFixed(3),!!observed,source,balanceKnown,tradeRateKnown,volumeKnown]),source};
}

export function chipSignalActive(signal){
 return !!signal.observed&&signal.fresh>0&&(signal.activity>0||signal.volume>0||signal.tradeRate>0||Math.abs(signal.delta)>1e-9||signal.motion>0);
}

export function composeChipBar(seed,bar,context={}){
 const signal=marketChipSignal(context),active=context.active!==false&&chipSignalActive(signal);
 const identity=chipHash(seed,113),state=chipHash(identity,signal.observationFingerprint??signal.fingerprint),events=[];
 const root=36+identity%12,direction=Math.sign(signal.delta),fracture=unit(context.phraseDepth??.82),gate=clamp(number(context.phraseGate,.6),.2,1);
 const energy=unit(Math.max(signal.activity,signal.motion,signal.volume*.7,Math.min(1,signal.tradeRate/8))),tension=unit(signal.motion+Math.abs(signal.delta)/8);
 const harmony={root,index:state%4,notes:[root+12,root+19,root+24+(tension>.5?1:0)],name:'Market transmission',character:'machine',group:direction<0?'down':'up'};
 const development={stage:tension>.35?'fracture':'transmit',motifId:identity.toString(16),supportGain:1,cadenceBeat:null,sourceBar:bar};
 const meta={signal,development,harmony,groove:'Asynchronous market packets'};
 if(!active)return {...meta,events,drums:{patternId:state.toString(16),density:0,deviation:0}};
 const start=bar*4,end=start+4,memory=clamp(Math.round(number(context.phraseLength,9)),4,16);
 const pulseGain=number(context.dataGain,1),textureGain=number(context.textureGain,.55);
 const expression=(id)=>({duty:chipHash(identity,id)%4,envelope:1+Math.floor((1-energy)*5),wave:chipHash(identity,id+7)%4,pan:signal.balance<.4?-1:signal.balance>.6?1:(chipHash(state,id)%3)-1,slide:direction*(.25+fracture*5)*tension,noiseWidth:signal.balance>.5?1:0,noiseShift:clamp(Math.round(11-9*energy-2*signal.motion),0,13)});
 const add=(beat,midi,duration,gain,kind,id)=>{
  gain*=kind==='chord'?(context.chordGain??1):kind==='arp'?(context.arpGain??1):(context.noteGain??1);
  if(beat<0||beat>=4||gain<=0)return;
  events.push({beat,midi,duration:Math.min(duration,4-beat),gain:gain*signal.fresh,kind,expression:expression(id),seed:chipHash(state,id)});
 };
 // Incommensurate clocks keep a stable coin identity without recycling a
 // two-bar kick/snare pattern. Market levels alter occupancy and fragmentation.
 const periods=[5,7,11,13,17,19,23];
 for(let lane=0;lane<3;lane++){
  const period=periods[chipHash(identity,lane)%periods.length]/(lane===2?5:11);
  const phase=roll(identity,lane+41)*period;
  for(let step=Math.max(0,Math.ceil((start-phase)/period));step*period+phase<end;step++){
   const absolute=step*period+phase,beat=absolute-start,cell=chipHash(state,step+lane*7919);
   const occupy=(lane===0?.16:lane===1?.09:.12)+energy*(lane===0?.7:.43);
   if(roll(cell,13)>occupy)continue;
   // Hardware intervals and integer-register bends supply harmony and grit;
   // these are not contours sampled from the reference MIDI collection.
   const interval=[0,7,12,19,24,1,6][chipHash(cell,7)%(tension>.35?7:5)];
   const midi=root+(lane===2?0:12)+direction*interval+(lane===1?7:0);
   const kind=lane===0?'arp':lane===1?'chord':'bass';
   const duration=Math.max(.04,period*gate*(.3+roll(cell,23)));
   if(kind==='arp'&&context.arpeggios===false)continue;
   const gain=(lane===2?.075:.045)*(.3+.7*energy)*(lane===0?pulseGain:1);
   add(beat,clamp(midi,lane===2?28:40,lane===2?64:92),duration,gain,kind,cell);
   if(lane===0&&fracture>.25&&energy>.15&&roll(cell,31)<fracture*signal.volume){
    const gap=.055+.11*(1-energy),count=1+Math.floor(signal.volume*3);
    for(let burst=1;burst<=count;burst++)add(beat+gap*burst,midi+direction*(burst%3),gap*.48,gain*.72,'arp',cell+burst);
   }
  }
 }
 // Residual carrier packets occupy CH4 itself. There is no parallel texture
 // synth or sample player. Silence is scheduled when observations expire.
 if(textureGain>0){
  const period=(periods[identity%periods.length]+memory)/13,phase=roll(identity,71)*period;
  for(let step=Math.max(0,Math.ceil((start-phase)/period));step*period+phase<end;step++){
   const beat=step*period+phase-start;
   if(roll(state,step+601)>.12+.65*energy)continue;
   const e={kind:'texture',drum:'texture',beat,duration:Math.min(.05+.45*signal.volume,4-beat),gain:.028*textureGain*(.35+.65*energy)*signal.fresh,seed:chipHash(state,step+601),expression:expression(step+601)};
   events.push(e);
  }
 }
 const drums=composeGameBoyDrumBar(seed,bar,{...context,signal},development);
 events.push(...drums.events.map(event=>({...event,gain:event.gain*(context.drumGain??1)})).filter(event=>event.gain>0));
 // Canonical mono channel allocation before scheduling. Every accepted event
 // has a unique hardware slot, which is also the visual event's identity.
 const channel=e=>e.kind==='texture'||(e.kind==='drum'&&['hat','snare'].includes(e.drum))?3:e.kind==='bass'?2:e.kind==='chord'||e.kind==='interlock'?1:0;
 const priority=e=>e.kind==='drum'?4:e.kind==='texture'?1:3;
 events.sort((a,b)=>a.beat-b.beat||priority(b)-priority(a));
 const accepted=[],last=[null,null,null,null];
 for(const event of events){
  const ch=channel(event),previous=last[ch];
  if(previous&&event.beat-previous.beat<.012)continue;
  if(previous)previous.duration=Math.min(previous.duration,event.beat-previous.beat);
  event.channel=ch;accepted.push(event);last[ch]=event;
 }
 return {...meta,events:accepted.filter(e=>e.duration>=.012),drums:{patternId:drums.patternId,density:drums.density,deviation:drums.deviation,performance:drums.performance}};
}
