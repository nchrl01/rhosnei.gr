// Bounded adaptations of the supplied function reel. The plotted value is the
// same normalized pitch-control value sent to Pd, not a measured waveform.
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number(n)||0));
const fract=n=>n-Math.floor(n);
const hash=n=>{n=Math.imul((n>>>0)^0x9e3779b9,0x85ebca6b);n^=n>>>13;return Math.imul(n,0xc2b2ae35)>>>0;};
const notes=[0,0,3,-2];
const normalize=y=>clamp((y+2.5)/5.5);
export const MATH_FAMILIES=[
 {id:'funk',name:'3 + 3 + 2',formula:'y = 4.2e⁻¹⁶ᵈ − 1.7 + m/12',base:32,shape:.6,drive:1.5,sample:p=>{const b=p*8,d=b-(b>=6?6:b>=3?3:0);return [4.2*Math.exp(-16*d)-1.7+notes[Math.floor(b/2)%4]/12,Math.exp(-5*d)];}},
 {id:'fourier',name:'Fourier series',formula:'y = 1 + (4/π) Σ sin((2k+1)x)/(2k+1)',base:43,shape:.2,drive:1,sample:p=>{const n=2**Math.floor(p*4),x=p*Math.PI*8;let y=0;for(let k=0;k<n;k++)y+=Math.sin((2*k+1)*x)/(2*k+1);return [1+4/Math.PI*y,.5*Math.sin(Math.PI*p)];}},
 {id:'phonk',name:'Drift envelope',formula:'y = −1.6 + m/12 + 3.6e⁻¹⁴ʳ',base:34,shape:.85,drive:1.8,sample:p=>{const b=p*8,r=b%2;return [-1.6+notes[Math.floor(b/2)%4]/12+3.6*Math.exp(-14*r),Math.exp(-5*r)];}},
 {id:'tangent',name:'Tangent',formula:'y = ½tan(πx) + step(x); muted near asymptotes',base:41,shape:.3,drive:1,sample:p=>{const x=p*8,c=Math.cos(Math.PI*x);return [.5*clamp(Math.tan(Math.PI*x),-4,4)+.75+.25*(Math.floor(x/4)%2),Math.abs(c)>.24?.4:0];}},
 {id:'kick',name:'Reverse kick',formula:'y = 5e⁻¹⁴ʳ − 1 − r/2; reverse curve after r = .55',base:27,shape:.9,drive:2.2,sample:p=>{const r=fract(p*8),w=(r-.55)/.45;return [r<.55?5*Math.exp(-14*r)-1-r/2:-1.19+1.6*w*w,r<.55?Math.exp(-8*r):.2*w*w];}},
 {id:'bounce',name:'Bouncing ball',formula:'y = 3.6r²ⁿ · 4v(1−v) − .8; r = .65',base:38,shape:.15,drive:1,sample:p=>{const r=.65,s=(p*8)%4,n=Math.floor(Math.log(Math.max(.00001,1-s/4))/Math.log(r)),v=clamp((s-4*(1-r**n))/(4*(1-r)*r**n));const h=3.6*r**(2*n)*4*v*(1-v);return [h-.8,clamp(h/2.5)];}},
 {id:'wobble',name:'Wobble',formula:'y = −1.2 + 1.3sin(2πrₖ frac(x))',base:32,shape:.7,drive:1.4,sample:p=>{const b=p*8,r=[1,2,1,3,1,2,3,3][Math.min(7,Math.floor(b))];return [-1.2+1.3*Math.sin(2*Math.PI*r*fract(b)),.42];}},
 {id:'heart',name:'Heart function',formula:'y = 1.25(|u|²ᐟ³ + .9√(3.3−u²)sin(17.6πu)) − .6',base:41,shape:.1,drive:1,sample:p=>{const u=(p*2-1)*1.8;return [1.25*(Math.abs(u)**(2/3)+.9*Math.sqrt(Math.max(0,3.3-u*u))*Math.sin(17.6*Math.PI*u))-.6,.38*Math.sin(Math.PI*p)];}},
 {id:'build',name:'Chirp build',formula:'y = p − 1.2 + (.4 + .64p)sin(32πp²)',base:40,shape:.35,drive:1,sample:p=>[p-1.2+(.4+.64*p)*Math.sin(32*Math.PI*p*p),.15+.4*p]},
 {id:'drop',name:'Drop envelope',formula:'y = 4.7e⁻¹²ʳ − 1.9 + m/12',base:31,shape:.75,drive:1.7,sample:p=>{const b=p*8,r=fract(b);return [4.7*Math.exp(-12*r)-1.9+[0,0,-4,-2][Math.floor(b/2)%4]/12,Math.exp(-5*r)];}},
];
export const MATH_THRESHOLDS=[100000,500000,1000000,2000000,5000000];
export const MATH_SLOT_COUNT=MATH_THRESHOLDS.length;
const rhythm=[0,2,4,5,9],tonal=[1,3,6,7,8];
export function mathIdentity(seed){
 const r=hash(seed)%rhythm.length,t=hash(seed^0xa53c)%tonal.length;
 const r2=(r+1+hash(seed^0x1717)%4)%5,t2=(t+1+hash(seed^0xbebe)%4)%5;
 const r3=rhythm.find((_,i)=>i!==r&&i!==r2);
 const chosen=[rhythm[r],tonal[t],rhythm[r2],tonal[t2],r3];
 return chosen.map((index,slot)=>({...MATH_FAMILIES[index],slot,threshold:MATH_THRESHOLDS[slot],
  curve:Array.from({length:161},(_,i)=>normalize(MATH_FAMILIES[index].sample(Math.min(.99999,i/160))[0]))}));
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
 function silence(){for(let i=0;i<MATH_SLOT_COUNT;i++){slots[i].level=0;send(`math-${i}-gate`,0);send(`math-${i}-level`,0);}}
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
  setSlot(index,value){const slot=slots[index];if(!slot)return;slot.enabled=Boolean(value);if(!value){slot.start=null;slot.queued=null;slot.level=0;send(`math-${index}-gate`,0);send(`math-${index}-level`,0);}},
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
   let queuedUntil=Math.max(beat,...slots.map(s=>s.start===null?s.queued===null?beat:s.queued+8:s.start+8));
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
    const [raw,gate]=pattern.sample(phase),value=normalize(raw);
    const target=performing ? .28*intensity*fresh:0;
    s.level+=(target-s.level)*(1-Math.exp(-dt/.08));if(!performing)s.level=0;
    const audibleGate=performing?clamp(gate):0,pitch=clamp(pattern.base+(seed%5)+value*19,24,78);
    send(`math-${i}-pitch`,pitch);send(`math-${i}-cutoff`,350+value*2200);send(`math-${i}-shape`,pattern.shape);
    send(`math-${i}-drive`,pattern.drive);send(`math-${i}-level`,s.level);send(`math-${i}-gate`,audibleGate);
    const status=!enabled||!s.enabled?'Muted':!transport?'Paused':!running?(options.error?'Audio unavailable':'Loading audio'):!entered?'Waiting for market cap':!fresh?'Waiting for fresh data':performing?'Playing':s.queued!==null?'Queued':intensity<=.015?'Quiet market':'Rest · awaiting new activity';
    return {slot:i,id:pattern.id,name:pattern.name,formula:pattern.formula,threshold:pattern.threshold,unlocked:entered,enabled:enabled&&s.enabled,level:s.level,active:performing&&audibleGate>0&&s.level>.0001,performing,phase,value,curve:pattern.curve,pitch,gate:audibleGate,status,beats:performing?(beat-s.start):0};
   });
   const view={playing:transport,seed,cap,tempo,globalEnabled:enabled,slots:views};onView(view);return view;
  },
  stop(){last=null;lastPosition=null;wasRunning=false;cancel();},
 };
}
