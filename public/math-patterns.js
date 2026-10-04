// Both source reels share one data-gated, finite-phrase Pure Data transport.
import {REFERENCE_FUNCTIONS} from './math-reference-functions.js?v=85';
import {REEL_FUNCTIONS} from './math-reel-functions.js?v=85';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const hash=n=>{n=Math.imul((n>>>0)^0x9e3779b9,0x85ebca6b);n^=n>>>13;return Math.imul(n,0xc2b2ae35)>>>0;};
export const MATH_FAMILIES=[...REEL_FUNCTIONS,...REFERENCE_FUNCTIONS];
export const MATH_THRESHOLDS=[100000,500000,1000000,2000000,5000000];
export const MATH_SLOT_COUNT=MATH_THRESHOLDS.length;
const GRAPH_SAMPLES=1200;
function graphCache(pattern,seed){
 const [xMin,xMax]=pattern.graphSpan,[yMin,yMax]=pattern.graphRange;
 const points=[],auxiliary=[];
 let previous;
 for(let i=0;i<=GRAPH_SAMPLES;i++){
  const x=xMin+(xMax-xMin)*Math.min(i/GRAPH_SAMPLES,1-1e-9),y=pattern.graph(x);
  const broken=previous==null||!Number.isFinite(y)||(pattern.breakBetween?.(previous,x)??pattern.breakAt?.(x,previous)??false);
  points.push({x,y,breakBefore:broken});
  if(pattern.aux){const [ay,gate]=pattern.aux(x,seed);auxiliary.push({x,y:gate>.002?ay:NaN,breakBefore:i===0||Math.floor(x*4)!==Math.floor(previous*4)});}
  previous=x;
 }
 return {points,auxiliary,domain:{xMin,xMax,yMin,yMax}};
}
export function mathIdentity(seed){
 // Both reels occur in every coin's score. Five distinct functions remain fixed
 // for the coin; market cap unlocks them without making every function play.
 const order=pool=>pool.map(p=>({p,rank:hash(seed^hash(MATH_FAMILIES.indexOf(p)+1))})).sort((a,b)=>a.rank-b.rank).map(x=>x.p);
 const first=order(REFERENCE_FUNCTIONS),second=order(REEL_FUNCTIONS);
 const chosen=[first[0],second[0],first[1],second[1]];
 chosen.push(order(MATH_FAMILIES.filter(p=>!chosen.includes(p)))[0]);
 return chosen.map((pattern,slot)=>({...pattern,slot,threshold:MATH_THRESHOLDS[slot],graphCache:graphCache(pattern,seed)}));
}
function graphSnapshot(pattern,phase,seed){
 const {points,auxiliary,domain}=pattern.graphCache;
 const x=domain.xMin+(domain.xMax-domain.xMin)*clamp(phase);
 return {graphPoints:points,graphCursor:{x,y:pattern.graph(x)},graphDomain:domain,graphOverlays:auxiliary.length?[{points:auxiliary}]:[]};
}
const UNLOCK_KEY='av.math-unlocks.v2';
function readUnlocks(){
 try{const saved=globalThis.localStorage?.getItem(UNLOCK_KEY),old=!saved;const rows=JSON.parse(saved||globalThis.localStorage?.getItem('av.math-unlocks.v1')||'[]');return new Map(Array.isArray(rows)?rows.filter(row=>Array.isArray(row)&&Number.isInteger(row[0])&&(MATH_THRESHOLDS.includes(row[1])||old&&row[1]===10000000)).slice(-64).map(([seed,cap])=>[seed,Math.min(cap,5000000)]):[]);}catch{return new Map();}
}
const slotState=enabled=>({enabled,level:0,start:null,queued:null,played:false,next:0,event:null,phase:0});
export function createMathPatterns({send=()=>{},onView=()=>{}}={}){
 let seed=0,profile=mathIdentity(seed),enabled=true,beat=0,last=null,lastPosition=null,wasRunning=false;
 let slots=profile.map(()=>slotState(true));
 const preferences=new Map(),unlocks=readUnlocks();
 function silence(){for(let i=0;i<MATH_SLOT_COUNT;i++){slots[i].level=0;send(`math-${i}-gate`,0);send(`math-${i}-aux-gate`,0);send(`math-${i}-level`,0);}}
 function cancel(){for(const slot of slots){slot.start=null;slot.queued=null;}silence();}
 function observeCap(cap){
  const tier=MATH_THRESHOLDS.filter(value=>cap>=value).at(-1)||0;
  if(tier<=(unlocks.get(seed)||0))return;
  unlocks.delete(seed);unlocks.set(seed,tier);if(unlocks.size>64)unlocks.delete(unlocks.keys().next().value);
  try{globalThis.localStorage?.setItem(UNLOCK_KEY,JSON.stringify([...unlocks]));}catch{}
 }
 return {
  setSeed(value){preferences.set(seed,slots.map(s=>s.enabled));if(preferences.size>64)preferences.delete(preferences.keys().next().value);seed=Number(value)>>>0;profile=mathIdentity(seed);slots=profile.map((_,i)=>slotState(preferences.get(seed)?.[i]??true));this.reset();},
  reset(){beat=0;last=null;lastPosition=null;wasRunning=false;slots=slots.map(s=>slotState(s.enabled));silence();},
  setEnabled(value){enabled=Boolean(value);if(!enabled)cancel();},
  setSlot(index,value){const slot=slots[index];if(!slot)return;slot.enabled=Boolean(value);if(!value){slot.start=null;slot.queued=null;slot.level=0;send(`math-${index}-gate`,0);send(`math-${index}-aux-gate`,0);send(`math-${index}-level`,0);}},
  frame(m={},options={}){
   const clock=Number(options.clock)||0,transport=Boolean(options.playing)&&!options.ended&&!options.seeking;
   const running=transport&&options.ready!==false,elapsed=last===null?0:Math.max(0,clock-last),dt=Math.min(.1,elapsed);last=clock;
   const cap=Number(m.context?.latestCap)||0,fresh=clamp(m.fresh),intensity=clamp(m.music?.intensity),tempo=clamp(m.music?.tempo||40,10,240);
   if(!m.replay&&fresh>0)observeCap(cap);
   const reached=m.replay?cap:(unlocks.get(seed)||0),unlocked=profile.map(pattern=>reached>=pattern.threshold);
   // One shared beat clock. Replay supplies elapsed playback seconds, not epoch time.
   const position=Number.isFinite(options.position)?options.position:null;
   const delta=position!==null?(lastPosition===null?0:Math.max(0,position-lastPosition)):elapsed;
   lastPosition=position;if(running&&fresh>0)beat+=Math.min(.25,delta)*tempo/60;
   if(!running&&wasRunning)cancel();wasRunning=running;
   const event=options.event??null;
   let queuedUntil=Math.max(beat,...slots.map(s=>s.start===null?s.queued===null?beat:s.queued+10:s.start+10));
   // At most one eight-beat phrase at a time; subsequent functions wait two beats.
   for(let i=0;i<slots.length;i++){
    const s=slots[i],allowed=enabled&&s.enabled&&running&&fresh>0&&unlocked[i]&&intensity>.015;
    if(!allowed){s.start=null;s.queued=null;s.level=0;continue;}
    if(s.start!==null&&beat-s.start>=8){s.start=null;s.next=beat+24;}
    if(s.queued!==null&&beat>=s.queued){s.start=s.queued;s.queued=null;s.played=true;s.event=event;}
    if(s.start===null&&s.queued===null&&event!==null&&(!s.played||beat>=s.next&&event!==s.event)){
     s.queued=Math.ceil(queuedUntil/4)*4;queuedUntil=s.queued+10;
     if(s.queued<=beat){s.start=s.queued;s.queued=null;s.played=true;s.event=event;}
    }
   }
   const views=profile.map((pattern,i)=>{
    const s=slots[i],entered=unlocked[i],performing=running&&s.start!==null;
    const phase=performing?clamp((beat-s.start)/8,0,.99999):s.phase;s.phase=phase;
    const [raw,gate]=pattern.sample(phase),[yMin,yMax]=pattern.graphRange,value=clamp((raw-yMin)/(yMax-yMin));
    const sourceX=pattern.graphSpan[0]+phase*(pattern.graphSpan[1]-pattern.graphSpan[0]);
    const [auxRaw,auxEnvelope]=pattern.aux?.(sourceX,seed)||[0,0];
    const target=performing ? .28*intensity*fresh:0;
    s.level+=(target-s.level)*(1-Math.exp(-dt/.08));if(!performing)s.level=0;
    const audibleGate=performing?clamp(gate):0,auxGate=performing?clamp(auxEnvelope):0;
    // One graph unit is one octave above MIDI 48, bounded for playback.
    const pitch=clamp(48+raw*12,24,84);
    send(`math-${i}-pitch`,pitch);send(`math-${i}-cutoff`,350+value*2200);send(`math-${i}-shape`,pattern.shape);
    send(`math-${i}-drive`,pattern.drive);send(`math-${i}-level`,s.level);send(`math-${i}-gate`,audibleGate);
    send(`math-${i}-aux-pitch`,clamp(48+auxRaw*12,24,96));send(`math-${i}-aux-gate`,auxGate);
    const status=!enabled||!s.enabled?'Muted':!transport?'Paused':!running?(options.error?'Audio unavailable':'Loading audio'):!entered?'Waiting for market cap':!fresh?'Waiting for fresh data':performing?'Playing':s.queued!==null?'Queued':intensity<=.015?'Quiet market':'Rest · awaiting new activity';
    return {slot:i,id:pattern.id,name:pattern.name,formula:pattern.formula,threshold:pattern.threshold,unlocked:entered,enabled:enabled&&s.enabled,level:s.level,active:performing&&(audibleGate>0||auxGate>0)&&s.level>.0001,performing,phase,value,...graphSnapshot(pattern,s.played?phase:0,seed),pitch,gate:audibleGate,auxGate,status,beats:performing?(beat-s.start):0};
   });
   const view={playing:transport,seed,cap,tempo,globalEnabled:enabled,slots:views};onView(view);return view;
  },
  stop(){last=null;lastPosition=null;wasRunning=false;cancel();},
 };
}
