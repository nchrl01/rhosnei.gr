import {renderBinaryRows,binaryRowParameters} from './binary-row-field.js?v=89';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const finite=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
const logarithmic=(value,decades)=>value==null?.5:unit(Math.log10(Math.max(1,value))/decades);
export function fieldState(m={}){
 const raw=m.raw||m,context=m.context||{},fresh=unit(m.fresh);
 // Valuation shapes space; only current observations or replay create motion.
 const activity=unit(raw.activity),volume=unit(raw.volume),move=unit(m.music?.intensity);
 const drive=fresh*unit(.5*move+.3*Math.sqrt(activity*volume)+.2*Math.sqrt(unit(m.dataSignals?.density)));
 const path=(context.path||[]).filter(p=>Number(p.close)>0).slice(-180);
 const prices=path.map(p=>Math.log(Number(p.close))),lo=prices.length?Math.min(...prices):0,hi=prices.length?Math.max(...prices):0;
 const range=hi-lo;
 const trace=path.map((p,i)=>({height:range>0?(prices[i]-lo)/range:.5,move:i?Math.tanh((prices[i]-prices[i-1])*12):0,volume:unit(Math.log1p(Math.max(0,Number(p.volume)||0))/Math.log(1e7))}));
 const holder=m.replay?null:finite(m.audience?.holders);
 const liquidity=m.availability?.liquidity===false?null:finite(m.observation?.liquidity);
 const values=[finite(m.music?.changePct),m.decoded?finite(m.tradeRate):null,finite(m.replay?.volume??(m.decoded?m.observedVolume:m.observation?.volume)),m.availability?.balance===false?null:finite(m.balance),liquidity,finite(context.latestCap),holder];
 return {drive,fresh,trace,values,activity,volume,liquidity,holder,holderWeight:unit(m.audience?.weight),change:finite(m.music?.changePct),tempo:Math.max(10,Math.min(240,Number(m.music?.tempo)||40)),pressure:unit(context.pressure),balance:m.availability?.balance===false?.5:unit(m.balance??.5)};
}

// Market data shapes the field. Sound develops its density; silence retains
// a sparse, slowly forming structure. Quiet motion is visual, not a trade signal.
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d',{alpha:true});
 if(!c)return {frame(){},event(){},pulse(){},refresh(){},reset(){},close(){}};
 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const host=canvas.closest('.audio-visualizer'),anchor=document.createComment('binary visual home');
 if(host){host.after(anchor);host.dataset.audible='false';host.dataset.visible='true';}
 const surface=document.createElement('canvas'),paint=surface.getContext('2d');
 const buffers=new WeakMap();
 let latest=fieldState(),smoothed=null,options={},seed=1917,clock=0;
 let sourceClock=null,sourceAt=0,previous=null,seen=new Set(),lastEvent=-Infinity;
 let pulseAt=-Infinity,pulseStrength=0,level=0,previousLevel=0,lastSound=-Infinity;
 let frameID=0,lastPaint=0,dirty=true,closed=false,visible=true,replaying=false;
 let audible=false,hasMarket=false,width=0,height=0,layoutPending=true;
 let formation=0,birth=0;
 const running=()=>{
  const state=getState();
  return Boolean(state.playing&&state.master!==0&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');
 };
 function hide(){
  audible=false;level=0;previousLevel=0;lastSound=-Infinity;
  c.clearRect(0,0,canvas.width,canvas.height);
  if(host){host.dataset.audible='false';host.dataset.visible='false';}
  Object.assign(canvas.dataset,{active:'false',visible:'false',overlay:'false',moving:'false',level:'0',density:'0'});
 }
 function clear(newCoin=false){
  previous=null;smoothed=null;seen.clear();sourceClock=null;sourceAt=0;
  lastEvent=-Infinity;pulseAt=-Infinity;pulseStrength=0;hasMarket=false;lastPaint=0;dirty=true;
  audible=false;previousLevel=level;lastSound=-Infinity;
  if(newCoin){clock=0;level=0;previousLevel=0;formation=0;birth=0;}
 }
 function fitHeight(){
  if(!host||mobile.matches)return;
  // Measure the normal grid row, not the sticky panel's viewport position.
  // Its inset and canvas size must stay constant when the document scrolls.
  const form=document.getElementById('coin-form');if(!form)return;
  const formMargin=parseFloat(getComputedStyle(form).marginTop)||0;
  const visualMargin=parseFloat(getComputedStyle(host).marginTop)||0;
  const top=Math.max(0,Math.round(form.getBoundingClientRect().top+window.scrollY-formMargin+visualMargin));
  const value=top+'px';if(host.style.getPropertyValue('--visual-top')!==value)host.style.setProperty('--visual-top',value);
 }
 function size(){
  fitHeight();
  const box=canvas.getBoundingClientRect(),nextWidth=Math.round(box.width),nextHeight=Math.round(box.height);
  const d=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(nextWidth*d)),h=Math.max(1,Math.round(nextHeight*d));
  if(width===nextWidth&&height===nextHeight&&canvas.width===w&&canvas.height===h)return;
  width=nextWidth;height=nextHeight;
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  dirty=true;
 }
 const resize=new ResizeObserver(size);resize.observe(canvas);
 const header=document.querySelector('.market-header');if(header)resize.observe(header);
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(rows=>{
  visible=rows[0]?.isIntersecting??true;lastPaint=0;
  if(!visible)hide();else dirty=true;
 }):null;visibility?.observe(canvas);
 function arrange(){
  // Mobile has its own panel after the player, before mathematical phrases.
  // It is never attached to body or painted over other interface elements.
  const readings=document.querySelector('.instrument > .readings');
  if(host){if(mobile.matches&&readings)readings.after(host);else anchor.parentNode?.insertBefore(host,anchor);}
  size();
 }
 const layoutChanged=()=>{layoutPending=true;};
 const motionChanged=()=>{dirty=true;};
 mobile.addEventListener('change',arrange);reduced.addEventListener('change',motionChanged);
 window.addEventListener('resize',layoutChanged);
 document.addEventListener('visibilitychange',layoutChanged);arrange();
 function measure(){
  const source=getAudio(),channels=source?.channels||[source];
  let power=0,count=0;
  for(const channel of channels){
   if(typeof channel?.getFloatTimeDomainData!=='function')continue;
   let samples=buffers.get(channel);
   if(!samples||samples.length!==channel.fftSize){samples=new Float32Array(channel.fftSize);buffers.set(channel,samples);}
   channel.getFloatTimeDomainData(samples);
   let sum=0,squares=0;for(const sample of samples){sum+=sample;squares+=sample*sample;}
   const mean=sum/samples.length;
   power+=Math.max(0,squares/samples.length-mean*mean);count++;
  }
  // Separate L/R power measurements cannot cancel opposite stereo phases.
  return count?Math.sqrt(power/count):0;
 }
 function excite(strength=.65){
  if(!running())return;
  const now=performance.now(),remaining=pulseStrength*Math.exp(-(now-pulseAt)/280);
  pulseStrength=Math.max(remaining,unit(strength));pulseAt=now;dirty=true;
 }
 function draw(now){
  if(closed)return;frameID=requestAnimationFrame(draw);
  if(layoutPending){layoutPending=false;size();}
  if(document.hidden||!visible||width<1||height<1){lastPaint=0;return;}
  if(now-lastPaint<(audible?(mobile.matches?1000/24:1000/30):1000/15))return;
  const dt=lastPaint?Math.min(.1,(now-lastPaint)/1000):1/30;lastPaint=now;
  const active=running()&&hasMarket;
  if(!active){pulseStrength=0;pulseAt=-Infinity;}
  const rms=active?measure():0;
  if(rms>(audible?.0002:.0005))lastSound=now;
  audible=active&&(rms>.0005||now-lastSound<100);
  if(host){host.dataset.audible=String(audible);host.dataset.visible='true';}
  const target=audible?unit((20*Math.log10(Math.max(1e-8,rms))+70)/52):0;
  level+=(target-level)*(1-Math.exp(-dt/(target>level?.15:1.4)));
  const shapeTarget=.035+.965*unit(level*1.6);
  formation+=(shapeTarget-formation)*(1-Math.exp(-dt/(shapeTarget>formation?.85:2.8)));
  birth=Math.min(1,birth+dt/2);
  // Keep settling after pause/mute even when no market frames are arriving.
  if(Math.abs(shapeTarget-formation)>.0001||birth<1||Math.abs(target-level)>.0001)dirty=true;
  const envelopeRise=unit((level-previousLevel)*9);previousLevel=level;
  const transient=active?Math.max(pulseStrength*Math.exp(-(now-pulseAt)/280),envelopeRise):0;
  if(!smoothed)smoothed={...latest};
  const approach=1-Math.exp(-dt/.16);
  for(const key of ['drive','activity','volume','pressure','balance'])smoothed[key]+=(latest[key]-smoothed[key])*approach;
  // The source replay cursor changes inside each candle. Candle timestamps are
  // deliberately not a frame trigger. Seeking/replaying the same source point
  // retains the seeded phase rather than accumulating a new local history.
  if(!reduced.matches){
   if(active&&replaying&&sourceClock!==null)clock=sourceClock+Math.min(.25,Math.max(0,(now-sourceAt)/1000))*(Number(options.rate)||1);
   else clock+=dt*(.06+formation*binaryRowParameters({...smoothed,level,transient}).motionRate);
   dirty=true;
  }
  if(!dirty)return;dirty=false;
  const limit=mobile.matches?512:896,scale=Math.min(1,limit/Math.max(width,height));
  const rw=Math.max(64,Math.round(width*scale)),rh=Math.max(64,Math.round(height*scale));
  const result=renderBinaryRows({width:rw,height:rh,seed,time:clock,presence:formation,activity:smoothed.activity,volume:smoothed.volume,drive:smoothed.drive,pressure:smoothed.pressure,balance:smoothed.balance,change:latest.change,marketCap:logarithmic(latest.values[5],10),liquidity:logarithmic(latest.liquidity,8),level,transient:reduced.matches?0:transient,mobile:mobile.matches,reducedMotion:reduced.matches,dither:getState().dither===true});
  if(surface.width!==rw)surface.width=rw;if(surface.height!==rh)surface.height=rh;
  paint.putImageData(new ImageData(result.pixels,rw,rh),0,0);
  c.fillStyle='#000';c.fillRect(0,0,canvas.width,canvas.height);
  c.imageSmoothingEnabled=false;c.globalAlpha=birth*(.35+.65*formation);c.drawImage(surface,0,0,canvas.width,canvas.height);c.globalAlpha=1;
  Object.assign(canvas.dataset,{composition:'binary-horizontal-rows',active:String(audible),visible:'true',overlay:'false',moving:String(!reduced.matches),motion:clock.toFixed(4),phase:clock.toFixed(4),level:level.toFixed(4),density:result.coverage.toFixed(4),rows:String(result.rows),transitioning:String(Math.abs(shapeTarget-formation)>.001),formation:formation.toFixed(4)});
 }
 frameID=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){
   const nextSeed=settings.seed==null?seed:Number(settings.seed)>>>0,nextReplay=!!next.replay;
   if(nextSeed!==seed||nextReplay!==replaying){clear(nextSeed!==seed);seed=nextSeed;replaying=nextReplay;}
   options=settings;latest=fieldState(next);dirty=true;
   const incoming=finite(settings.clock)??(finite(settings.position)==null?null:Number(settings.position)*60);
   if(incoming!==null&&incoming!==sourceClock){sourceClock=incoming;sourceAt=performance.now();}
   const current={at:finite(next.replay?.at),price:finite(next.replay?.price??next.context?.latestPrice??next.context?.path?.at(-1)?.close),volume:finite(next.replay?.volume??next.observation?.volume),trades:next.observation?.trades?Number(next.observation.trades.buys||0)+Number(next.observation.trades.sells||0):null};
   const old=previous;previous=current;hasMarket=current.price>0;
   if(!running())return;
   const changed=current.price>0&&old?.price>0&&Math.abs(current.price/old.price-1)>1e-9;
   if(replaying){
    if(current.at!==old?.at&&(current.volume>0||changed))excite(.35+.65*latest.drive);
   }else if(!next.decoded&&performance.now()-lastEvent>1000&&old){
    if(changed||(current.volume!=null&&old.volume!=null&&current.volume>old.volume)||(current.trades!=null&&old.trades!=null&&current.trades>old.trades))excite(.35+.65*latest.drive);
   }
  },
  event(trade={}){
   if(trade.removed||replaying||!['swap','pool-transaction','market-price'].includes(trade.kind))return;
   const id=trade.id||trade.signature;if(id&&seen.has(id))return;
   if(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
   lastEvent=performance.now();excite(.4+.6*unit(Math.log1p(Math.max(0,Number(trade.usdVolume)||0))/Math.log(100001)));
  },
  pulse(){excite(.7);},
  refresh(){dirty=true;},
  reset(){clear();},
  close(){
   closed=true;cancelAnimationFrame(frameID);hide();resize.disconnect();visibility?.disconnect();
   mobile.removeEventListener('change',arrange);reduced.removeEventListener('change',motionChanged);
   window.removeEventListener('resize',layoutChanged);
   document.removeEventListener('visibilitychange',layoutChanged);
   if(host)anchor.parentNode?.insertBefore(host,anchor);anchor.remove();
  },
 };
}
