import {renderBinaryRows} from './binary-row-field.js?v=84';
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

// Reconstructed horizontal TOP-style field. Market transport owns its clock.
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d',{alpha:true});
 if(!c)return {frame(){},event(){},pulse(){},refresh(){},reset(){},close(){}};
 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const host=canvas.closest('.audio-visualizer'),anchor=document.createComment('binary visual home');if(host)host.after(anchor);
 const surface=document.createElement('canvas'),paint=surface.getContext('2d');
 let latest=fieldState(),shown=null,options={},metrics={},seed=1917,clock=0,lastTime=0,sourceClock=null,sourceAt=0;
 let previous=null,seen=new Set(),lastEvent=-Infinity,motionUntil=0,frameID=0,lastPaint=0,dirty=true,closed=false,visible=true,replaying=false,wasMoving=false;
 let width=0,height=0;
 const running=()=>Boolean(getState().playing&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');
 function clear(){shown=null;previous=null;seen.clear();clock=0;lastTime=0;sourceClock=null;sourceAt=0;motionUntil=0;lastEvent=-Infinity;wasMoving=false;dirty=true;}
 function size(){const box=canvas.getBoundingClientRect();width=Math.round(box.width);height=Math.round(box.height);const d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,Math.round(width*d));canvas.height=Math.max(1,Math.round(height*d));dirty=true;}
 const resize=new ResizeObserver(size);resize.observe(canvas);
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(rows=>{visible=rows[0]?.isIntersecting??true;lastPaint=0;if(!visible)motionUntil=0;else dirty=true;}):null;visibility?.observe(canvas);
 function arrange(){if(host){if(mobile.matches)document.body.append(host);else anchor.parentNode?.insertBefore(host,anchor);}size();}
 mobile.addEventListener('change',arrange);arrange();
 function activity(){if(!running()||document.hidden||!visible)return;shown=latest;motionUntil=performance.now()+1400;dirty=true;}
 function draw(now){
  if(closed)return;frameID=requestAnimationFrame(draw);
  if(document.hidden||!visible||width<1||height<1){lastPaint=0;return;}
  if(now-lastPaint<(mobile.matches?1000/24:1000/30))return;
  const dt=lastPaint?Math.min(.1,(now-lastPaint)/1000):0;lastPaint=now;
  const active=running();if(!active)motionUntil=0;
  const replayActivity=replaying&&(Number(metrics.replay?.volume)>0||unit((metrics.raw||metrics).motion)>0);
  const moving=active&&!reduced.matches&&!!shown&&(replaying?replayActivity:now<motionUntil);
  if(moving){
   shown=latest;
   if(replaying&&sourceClock!==null)clock=sourceClock+Math.min(.25,Math.max(0,(now-sourceAt)/1000))*(Number(options.rate)||1);
   else clock+=dt*(.35+latest.drive*1.65);
   dirty=true;
  }
  if(moving!==wasMoving){dirty=true;wasMoving=moving;}
  if(!dirty)return;dirty=false;
  c.clearRect(0,0,canvas.width,canvas.height);
  if(!mobile.matches){c.fillStyle='#000';c.fillRect(0,0,canvas.width,canvas.height);}
  let coverage=0,rows=0;
  if(shown){
   const settings=getState(),limit=settings.nds===false?768:640;
   const scale=Math.min(1,limit/Math.max(width,height));
   const rw=Math.max(128,Math.round(width*scale)),rh=Math.max(128,Math.round(height*scale));
   const result=renderBinaryRows({width:rw,height:rh,seed,time:clock,activity:shown.activity,volume:shown.volume,drive:shown.drive,pressure:shown.pressure,balance:shown.balance,change:shown.change,marketCap:logarithmic(shown.values[5],10),liquidity:logarithmic(shown.liquidity,8),mobile:mobile.matches,reducedMotion:reduced.matches,dither:settings.dither===true});
   surface.width=rw;surface.height=rh;paint.putImageData(new ImageData(result.pixels,rw,rh),0,0);
   c.imageSmoothingEnabled=false;c.drawImage(surface,0,0,canvas.width,canvas.height);coverage=result.coverage;rows=result.rows;lastTime=clock;
  }
  Object.assign(canvas.dataset,{composition:'binary-horizontal-rows',active:String(active),visible:String(!!shown),overlay:String(mobile.matches),moving:String(moving),motion:clock.toFixed(4),phase:clock.toFixed(4),density:coverage.toFixed(4),rows:String(rows),transitioning:'false'});
 }
 frameID=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){
   const nextSeed=settings.seed==null?seed:Number(settings.seed)>>>0,nextReplay=!!next.replay;
   if(nextSeed!==seed||nextReplay!==replaying){clear();seed=nextSeed;replaying=nextReplay;}
   options=settings;metrics=next;latest=fieldState(next);
   const incoming=finite(settings.clock)??(finite(settings.position)==null?null:Number(settings.position)*60);
   if(incoming!==null&&incoming!==sourceClock){sourceClock=incoming;sourceAt=performance.now();}
   const current={at:finite(next.replay?.at),price:finite(next.replay?.price??next.context?.latestPrice??next.context?.path?.at(-1)?.close),volume:finite(next.replay?.volume??next.observation?.volume),trades:next.observation?.trades?Number(next.observation.trades.buys||0)+Number(next.observation.trades.sells||0):null};
   const old=previous;previous=current;
   if(!shown&&current.price>0){shown=latest;if(replaying&&incoming!==null)clock=incoming;dirty=true;}
   if(!running())return;
   const changed=current.price>0&&old?.price>0&&Math.abs(current.price/old.price-1)>1e-9;
   if(replaying){
    if(current.at!==old?.at&&(current.volume>0||changed)){shown=latest;if(incoming!==null)clock=incoming;dirty=true;}
   }else if(!next.decoded&&performance.now()-lastEvent>1000&&old){
    if(changed||(current.volume!=null&&old.volume!=null&&current.volume>old.volume)||(current.trades!=null&&old.trades!=null&&current.trades>old.trades))activity(latest.drive);
   }
  },
  event(trade={}){
   if(trade.removed||replaying||!['swap','pool-transaction','market-price'].includes(trade.kind))return;
   const id=trade.id||trade.signature;if(id&&seen.has(id))return;if(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
   lastEvent=performance.now();activity(latest.drive);
  },
  pulse(){},
  refresh(){clock=lastTime;dirty=true;},
  reset(){clear();},
  close(){closed=true;cancelAnimationFrame(frameID);resize.disconnect();visibility?.disconnect();mobile.removeEventListener('change',arrange);if(host)anchor.parentNode?.insertBefore(host,anchor);anchor.remove();},
 };
}
