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
const rhythm=[0,2,4,5,9],tonal=[1,3,6,7,8];
export function mathIdentity(seed){
 const chosen=[rhythm[hash(seed)%rhythm.length],tonal[hash(seed^0xa53c)%tonal.length]];
 return chosen.map((index,slot)=>({...MATH_FAMILIES[index],slot,threshold:slot?10000000:1000000,
  curve:Array.from({length:161},(_,i)=>normalize(MATH_FAMILIES[index].sample(Math.min(.99999,i/160))[0]))}));
}
export function createMathPatterns({send=()=>{},onView=()=>{}}={}){
 let seed=0,profile=mathIdentity(seed),enabled=true,beat=0,last=null,wasRunning=false;
 let slots=profile.map(()=>({enabled:true,entered:false,level:0}));
 const preferences=new Map();
 function silence(){for(let i=0;i<2;i++){send(`math-${i}-gate`,0);send(`math-${i}-level`,0);}}
 return {
  setSeed(value){preferences.set(seed,slots.map(s=>s.enabled));if(preferences.size>32)preferences.delete(preferences.keys().next().value);seed=Number(value)>>>0;profile=mathIdentity(seed);slots=profile.map((_,i)=>({enabled:preferences.get(seed)?.[i]??true,entered:false,level:0}));this.reset();},
  reset(){beat=0;last=null;wasRunning=false;for(const slot of slots){slot.level=0;slot.entered=false;slot.activeSince=null;slot.phrase=null;slot.phraseChosen=false;slot.heard=false;}silence();},
  setEnabled(value){enabled=Boolean(value);if(!enabled)silence();},
  setSlot(slot,value){if(!slots[slot])return;slots[slot].enabled=Boolean(value);if(!value){send(`math-${slot}-gate`,0);send(`math-${slot}-level`,0);}},
  frame(m={},options={}){
   const clock=Number(options.clock)||0,transport=Boolean(options.playing),running=transport&&options.ready!==false,elapsed=last===null?0:Math.max(0,clock-last),dt=Math.min(.1,elapsed);last=clock;
   const cap=Number(m.context?.latestCap)||0,rate=Math.max(0,Number(m.tradeRate)||0),fresh=clamp(m.fresh);
   // This is the function phrase clock, not a simulated trade clock. Even at
   // one trade per 30 seconds a full curve takes at most five seconds; the
   // piano still receives only the actual incoming trade events.
   if(running&&rate>0)beat+=Math.min(.25,elapsed)*(1.6+1.4*(1-Math.exp(-rate)));
   if(!running&&wasRunning)silence();wasRunning=running;
   const views=profile.map((pattern,i)=>{
    const state=slots[i];
    if(cap>=pattern.threshold)state.entered=true;
    if(cap<pattern.threshold*.88||!fresh)state.entered=false;
    const emergence=state.entered?clamp((cap/pattern.threshold-.88)/1.12):0;
    const allowed=enabled&&state.enabled&&running&&rate>0&&fresh>0&&state.entered;
    // Two eight-beat windows in a 32-beat cycle, separated by rests. A seeded
    // phrase decision further reduces density; no simultaneous full phrases.
    const local=(beat+i*16)%32,phrase=Math.floor((beat+i*16)/32);
    const chance=hash(seed^Math.imul(phrase+1,7919)^i)/4294967296;
    if(state.phrase!==phrase){state.phrase=phrase;state.phraseChosen=!state.heard||chance<.35+.35*clamp(m.volume);state.activeSince=null;}
    const inWindow=local<8&&state.phraseChosen;
    if(!allowed||!inWindow)state.activeSince=null;
    else state.activeSince??=clock;
    const phraseOn=inWindow&&state.activeSince!==null&&clock-state.activeSince<5;
    const phase=clamp(local/8,0,.99999),[raw,gate]=pattern.sample(phase),value=normalize(raw);
    const target=allowed?(.18+.14*emergence)*fresh:0;
    state.level+=(target-state.level)*(1-Math.exp(-dt/(target>state.level ? .12 : .35)));
    if(!running||!enabled||!state.enabled)state.level=0;
    const audibleGate=allowed&&phraseOn?clamp(gate):0;
    if(audibleGate>0&&state.level>.01)state.heard=true;
    const pitch=clamp(pattern.base+(seed%5)+value*19,24,78);
    send(`math-${i}-pitch`,pitch);send(`math-${i}-cutoff`,350+value*2200);send(`math-${i}-shape`,pattern.shape);
    send(`math-${i}-drive`,pattern.drive);send(`math-${i}-level`,state.level);send(`math-${i}-gate`,audibleGate);
    const status=!enabled||!state.enabled?'Muted':!transport?'Paused':!running?(options.error?'Audio unavailable':'Loading audio'):!cap?'Market cap unavailable':!state.entered?'Waiting for market cap':!rate||!fresh?'Waiting for trades':!phraseOn?'Rest':'Playing';
    return {slot:i,id:pattern.id,name:pattern.name,formula:pattern.formula,threshold:pattern.threshold,enabled:enabled&&state.enabled,level:state.level,active:audibleGate>0&&state.level>.0001,phase,value,curve:pattern.curve,pitch,gate:audibleGate,status};
   });
   const view={playing:transport,seed,cap,globalEnabled:enabled,slots:views};onView(view);return view;
  },
  stop(){last=null;wasRunning=false;silence();},
 };
}
