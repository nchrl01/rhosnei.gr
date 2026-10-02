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
export const MATH_SLOT_COUNT=4;
const rhythm=[0,2,4,5,9],tonal=[1,3,6,7,8];
export function mathIdentity(seed){
 const r=hash(seed)%rhythm.length,t=hash(seed^0xa53c)%tonal.length;
 const chosen=[rhythm[r],tonal[t],rhythm[(r+1+hash(seed^0x1717)%4)%5],tonal[(t+1+hash(seed^0xbebe)%4)%5]];
 return chosen.map((index,slot)=>({...MATH_FAMILIES[index],slot,threshold:slot<2?1000000:10000000,
  curve:Array.from({length:161},(_,i)=>normalize(MATH_FAMILIES[index].sample(Math.min(.99999,i/160))[0]))}));
}
const UNLOCK_KEY='av.math-unlocks.v1';
function readUnlocks(){
 try{
  const rows=JSON.parse(globalThis.localStorage?.getItem(UNLOCK_KEY)||'[]');
  return new Map(Array.isArray(rows)?rows.filter(row=>Array.isArray(row)&&Number.isInteger(row[0])&&[1000000,10000000].includes(row[1])).slice(-64):[]);
 }catch{return new Map();}
}
export function createMathPatterns({send=()=>{},onView=()=>{}}={}){
 let seed=0,profile=mathIdentity(seed),enabled=true,beat=0,last=null,wasRunning=false;
 let slots=profile.map(()=>({enabled:true,level:0}));
 const preferences=new Map(),unlocks=readUnlocks();
 function silence(){for(let i=0;i<MATH_SLOT_COUNT;i++){send(`math-${i}-gate`,0);send(`math-${i}-level`,0);}}
 function observeCap(cap){
  const tier=cap>=10000000?10000000:cap>=1000000?1000000:0;
  if(tier<=(unlocks.get(seed)||0))return;
  unlocks.delete(seed);unlocks.set(seed,tier);
  if(unlocks.size>64)unlocks.delete(unlocks.keys().next().value);
  try{globalThis.localStorage?.setItem(UNLOCK_KEY,JSON.stringify([...unlocks]));}catch{}
 }
 return {
  setSeed(value){preferences.set(seed,slots.map(s=>s.enabled));if(preferences.size>64)preferences.delete(preferences.keys().next().value);seed=Number(value)>>>0;profile=mathIdentity(seed);slots=profile.map((_,i)=>({enabled:preferences.get(seed)?.[i]??true,level:0}));this.reset();},
  // Transport reset clears audio, but does not forget a coin's reached tiers.
  reset(){beat=0;last=null;wasRunning=false;for(const slot of slots)slot.level=0;silence();},
  setEnabled(value){enabled=Boolean(value);if(!enabled)silence();},
  setSlot(slot,value){if(!slots[slot])return;slots[slot].enabled=Boolean(value);if(!value){send(`math-${slot}-gate`,0);send(`math-${slot}-level`,0);}},
  frame(m={},options={}){
   const clock=Number(options.clock)||0,transport=Boolean(options.playing),running=transport&&options.ready!==false,elapsed=last===null?0:Math.max(0,clock-last),dt=Math.min(.1,elapsed);last=clock;
   const cap=Number(m.context?.latestCap)||0,rate=Math.max(0,Number(m.tradeRate)||0),fresh=clamp(m.fresh);
   // Remember observed live tiers, including observations made before Listen.
   // Replay uses its historical cap, never a future live unlock.
   if(!m.replay&&fresh>0&&Number.isFinite(cap))observeCap(cap);
   const reached=m.replay?cap:(unlocks.get(seed)||0);
   const unlocked=profile.map(pattern=>reached>=pattern.threshold);
   const count=Math.max(1,slots.filter((slot,i)=>slot.enabled&&unlocked[i]).length);
   // Once unlocked, curves keep moving on fresh market controls, even when
   // individual trade events are unavailable. This does not trigger piano notes.
   if(Number.isFinite(options.position))beat=options.position*(m.music?.tempo??40)/60;
   else if(running&&fresh>0)beat+=Math.min(.25,elapsed)*(m.music?.tempo??40)/60;
   if(!running&&wasRunning)silence();wasRunning=running;
   const views=profile.map((pattern,i)=>{
    const state=slots[i],entered=unlocked[i];
    const allowed=enabled&&state.enabled&&running&&fresh>0&&entered;
    const emergence=clamp(cap/pattern.threshold-1);
    const phase=fract(beat/8+i/4),[raw,gate]=pattern.sample(phase),value=normalize(raw);
    const target=allowed ? .28*(.04+.96*clamp(m.music?.intensity))*fresh/Math.sqrt(count):0;
    state.level+=(target-state.level)*(1-Math.exp(-dt/(target>state.level ? .12 : .35)));
    if(!running||!enabled||!state.enabled)state.level=0;
    const audibleGate=allowed?clamp(gate):0;
    const pitch=clamp(pattern.base+(seed%5)+value*19,24,78);
    send(`math-${i}-pitch`,pitch);send(`math-${i}-cutoff`,350+value*2200);send(`math-${i}-shape`,pattern.shape);
    send(`math-${i}-drive`,pattern.drive);send(`math-${i}-level`,state.level);send(`math-${i}-gate`,audibleGate);
    const status=!enabled||!state.enabled?'Muted':!transport?'Paused':!running?(options.error?'Audio unavailable':'Loading audio'):!entered?'Waiting for market cap':!fresh?'Waiting for fresh data':'Playing';
    return {slot:i,id:pattern.id,name:pattern.name,formula:pattern.formula,threshold:pattern.threshold,unlocked:entered,enabled:enabled&&state.enabled,level:state.level,active:audibleGate>0&&state.level>.0001,phase,value,curve:pattern.curve,pitch,gate:audibleGate,status};
   });
   const view={playing:transport,seed,cap,globalEnabled:enabled,slots:views};onView(view);return view;
  },
  stop(){last=null;wasRunning=false;silence();},
 };
}
