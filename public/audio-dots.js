// Original data score inspired by the dimensionality of datamatics and the
// complementary bands of test pattern. Geometry never feeds the audio engine.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const finite=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
const hash=(seed,index)=>{let n=Math.imul((seed>>>0)^index,1597334677);n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};
const compact=n=>n==null?'—':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(n<1?4:0);
export function fieldState(m={}){
 const raw=m.raw||m,context=m.context||{},fresh=unit(m.fresh);
 // Valuation and holder count shape space; neither creates motion on its own.
 const activity=unit(raw.activity),volume=unit(raw.volume),move=unit(m.music?.intensity);
 const drive=fresh*unit(.5*move+.3*Math.sqrt(activity*volume)+.2*Math.sqrt(unit(m.dataSignals?.density)));
 const path=(context.path||[]).filter(p=>Number(p.close)>0).slice(-180);
 const prices=path.map(p=>Math.log(Number(p.close))),lo=prices.length?Math.min(...prices):0,hi=prices.length?Math.max(...prices):0;
 const range=hi-lo;
 const trace=path.map((p,i)=>({height:range>0?(prices[i]-lo)/range:.5,move:i?Math.tanh((prices[i]-prices[i-1])*12):0,volume:unit(Math.log1p(Math.max(0,Number(p.volume)||0))/Math.log(1e7))}));
 const holder=m.replay?null:finite(m.audience?.holders);
 const liquidity=m.availability?.liquidity===false?null:finite(m.observation?.liquidity);
 const values=[finite(m.music?.changePct),m.decoded?finite(m.tradeRate):null,finite(m.replay?.volume??(m.decoded?m.observedVolume:m.observation?.volume)),m.availability?.balance===false?null:finite(m.balance),liquidity,finite(context.latestCap),holder];
 return {drive,fresh,trace,values,liquidity,holder,holderWeight:unit(m.audience?.weight),change:finite(m.music?.changePct),tempo:Math.max(10,Math.min(240,Number(m.music?.tempo)||40)),pressure:unit(context.pressure),balance:m.availability?.balance===false?.5:unit(m.balance??.5)};
}
// Marks exist for a bounded observation, never for a rolling activity level.
// Keep separate flashes below three per second; no full-canvas inversion.
const BURST_MS=180,BURST_GAP_MS=360;
const fingerprint=value=>{let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;};
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d',{alpha:false});if(!c)return {frame(){},event(){},pulse(){},reset(){},close(){}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let w=0,h=0,last=0,tap=null,wave,spectrum,animation=0,closed=false,visible=true,dirty=true;
 let metrics={},options={},seed=1917,phase=0,activeBefore=false,energy=0,events=[],lastPulse=null,model=fieldState(),lastReplay=false;
 let burst=null,lastBurst=-Infinity,observation=null,lastEvent=-Infinity;
 const bands=new Float32Array(64),observer=new ResizeObserver(size);
 observer.observe(canvas);
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  visible=entries[0]?.isIntersecting??true;if(!visible)clearBurst();dirty=true;
 }):null;visibility?.observe(canvas);
 function size(){const b=canvas.getBoundingClientRect();w=b.width;h=b.height;const d=Math.min(globalThis.devicePixelRatio||1,w<600?1.25:1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);dirty=true;}
 function text(label,x,y,color='#555',size=8){c.fillStyle=color;c.font=`${size}px Arial, sans-serif`;c.fillText(label,x,y);}
 function running(){return Boolean(getState().playing&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');}
 function clearBurst(){burst=null;lastPulse=null;energy=0;bands.fill(0);dirty=true;}
 function trigger(key,strength=0){
  if(!running()||document.hidden||!visible)return;
  const now=performance.now();
  // Coalesce rapid observations into this mark, without extending its lifetime
  // or queuing a flash after the market has stopped.
  if(now-lastBurst<BURST_GAP_MS){if(burst&&now<burst.until){burst.strength=Math.max(burst.strength,unit(strength));dirty=true;}return;}
  const word=fingerprint(key)^seed;
  burst={start:now,until:now+BURST_MS,word,strength:unit(strength)};lastBurst=now;
  phase=hash(word,31)*100;dirty=true;
 }
 function sample(dt){
  const audio=getAudio();if(audio!==tap){tap=audio;wave=tap?new Float32Array(tap.fftSize):null;spectrum=tap?new Uint8Array(tap.frequencyBinCount):null;}
  if(!tap)return;
  tap.getFloatTimeDomainData(wave);tap.getByteFrequencyData(spectrum);
  let rms=0;for(const v of wave)rms+=v*v;const smoothing=1-Math.exp(-dt/.04);energy+=(unit(Math.sqrt(rms/wave.length)*5)-energy)*smoothing;
  const min=2,max=Math.min(spectrum.length,Math.floor(12000*tap.fftSize/tap.context.sampleRate));
  for(let b=0;b<bands.length;b++){
   const start=Math.floor(min*(max/min)**(b/bands.length)),end=Math.max(start+1,Math.floor(min*(max/min)**((b+1)/bands.length)));
   let sum=0,count=0;for(let i=start;i<end&&i<spectrum.length;i++){sum+=spectrum[i]/255;count++;}bands[b]+=(sum/(count||1)-bands[b])*smoothing;
  }
 }
 function terrain(x,y,width,height,drive){
  const columns=w<500?52:82,depths=w<500?30:44,trace=model.trace;
  const angle=.24*Math.sin(phase*.065)+(model.balance-.5)*.13,cs=Math.cos(angle),sn=Math.sin(angle);
  const tilt=.35+Math.sin(phase*.021)*.23,ct=Math.cos(tilt),st=Math.sin(tilt);
  const f=Math.min(width*.79,height*1.1),cx=x+width*.5,cy=y+height*.43;
  const pitch=model.change==null?0:Math.tanh(model.change/20);
  for(let z=depths-1;z>=0;z--){
   const progression=z/(depths-1),point=trace.length?trace[Math.round((1-progression)*(trace.length-1))]:null;
   const heightValue=point?(point.height-.5)*1.35:0,warp=(point?.move||0)*drive*.28;
   for(let col=0;col<columns;col++){
    const data=model.values[(z+col)%model.values.length];
    const key=burst.word^(data==null?seed:Math.round(Math.abs(data)*1000)),selected=hash(key,col*173+z*23);
    if(selected>.12+drive*.55+energy*.06)continue;
    const px=(col/(columns-1)-.5)*4.25,stripe=Math.sin(px*4+progression*12+phase*.2)*warp;
    const py=heightValue+stripe+(point?.volume||0)*.22*Math.cos(px*3)+pitch*px*.06,pz=progression*3.8;
    const rx=px*cs-pz*sn,rz=px*sn+pz*cs,ry=py*ct-rz*st,depth=py*st+rz*ct+3.25;
    const sx=Math.round(cx+rx*f/depth),sy=Math.round(cy-ry*f/depth);
    c.fillStyle='#111';
    const dot=selected<.12&&drive>.45?1.65:1;c.fillRect(sx,sy,dot,dot);
    // Plus signs and crosshairs expose the same history samples as the dots.
    if(point&&selected<drive*.025){c.fillRect(sx-3,sy,7,1);c.fillRect(sx,sy-3,1,7);}
   }
  }
 }
 function barcode(x,y,width,height,drive){
  const cols=Math.max(96,Math.min(240,Math.floor(width/2))),cw=width/cols,groups=5,gh=height/groups;
  for(let group=0;group<groups;group++){
   const data=model.values[group%model.values.length];if(data==null)continue;
   const word=Math.round(Math.abs(data)*10000)>>>0;
   for(let col=0;col<cols;col++){
    const pick=hash(burst.word^word,col+group*617),on=((word>>>(col%31))&1)===1;
    if(pick>(.06+drive*.36))continue;
    const half=gh*.5-1;c.fillStyle='#111';
    c.fillRect(Math.floor(x+col*cw),y+group*gh+(on?0:half+2),Math.max(1,cw*(.2+pick*.75)),Math.max(1,half*(.55+bands[(col+group*7)%64]*.45)));
   }
  }
 }
 function draw(now){
  if(closed)return;animation=requestAnimationFrame(draw);
  if(document.hidden||!visible){if(burst)clearBurst();return;}
  if(!w||!h)return;
  const interval=w<500?1000/24:1000/30;if(now-last<interval)return;
  const dt=Math.min(.1,Math.max(.001,(now-last)/1000||.033));last=now;
  const active=running();
  if(!active&&burst)clearBurst();
  if(burst&&now>=burst.until)clearBurst();
  if(!dirty&&!burst&&active===activeBefore)return;
  if(reduced.matches&&!dirty&&active===activeBefore)return;
  if(active&&burst&&!reduced.matches)sample(dt);
  activeBefore=active;dirty=false;
  const drive=burst?unit(.22+model.drive*.45+burst.strength*.33):0,margin=w<450?12:20;
  const fieldY=47,fieldH=Math.max(20,h-105),fieldW=w-margin*2;
  c.fillStyle='#fff';c.fillRect(0,0,w,h);c.textBaseline='alphabetic';c.textAlign='left';
  text('U P I C  /  D A T A   S C O R E',margin,22,'#111',8);
  c.textAlign='right';text(!active?'PAUSED':burst?(metrics.replay?'CANDLE':'EVENT'):'WAITING',w-margin,22,'#555',8);c.textAlign='left';
  c.strokeStyle='#ddd';c.beginPath();c.moveTo(margin,33.5);c.lineTo(w-margin,33.5);c.stroke();
  if(burst){
   c.save();c.beginPath();c.rect(margin,fieldY,fieldW,fieldH);c.clip();
   terrain(margin,fieldY,fieldW,fieldH*.88,drive);
   const bandTop=fieldY+fieldH*.56;barcode(margin,bandTop,fieldW,fieldH*.27,drive);
   const spectrumY=fieldY+fieldH*.94,binWidth=fieldW/bands.length;
   c.fillStyle='#111';for(let b=0;b<bands.length;b++){const length=bands[b]*fieldH*.105;if(length>1)c.fillRect(margin+b*binWidth,spectrumY-length,1,length);}
   // Pd can mark an existing market burst, but cannot start or prolong it.
   if(lastPulse&&tap&&tap.context.currentTime-lastPulse.at<.16){const x=margin+(lastPulse.voice+.5)*fieldW/5;c.fillRect(x,bandTop-7,8,1);c.fillRect(x,bandTop-7,1,5);}
   for(let i=0;i<Math.round(3+drive*9);i++){
    const x=margin+hash(burst.word,i+99)*Math.max(0,fieldW-35),y=fieldY+hash(burst.word,i+171)*fieldH;
    text(['+','[ ]','|','0','1',':'][Math.floor(hash(burst.word,i+801)*6)],x,y,'#111',9);
   }
   c.restore();
  }
  const y=h-44;
  text('Δ '+(model.change==null?'—':(model.change>=0?'+':'')+model.change.toFixed(2)+'%')+'    VOL '+compact(model.values[2]),margin,y);
  c.textAlign='right';text('CAP '+compact(model.values[5]),w-margin,y);c.textAlign='left';
  const age=finite(metrics.audience?.age),ageText=age==null?'AGE UNKNOWN':age<3600000?Math.floor(age/60000)+'M AGO':Math.floor(age/3600000)+'H AGO';
  const holderLabel=model.holder==null?'HOLDERS —':'HOLDERS '+compact(model.holder)+' / '+(model.holderWeight<=0?'STALE':ageText);
  text(metrics.replay?'CANDLE SCORE / NO HISTORICAL HOLDERS':holderLabel,margin,y+15,'#666',7);
  c.textAlign='right';text(metrics.replay?'REPLAY':model.fresh<=0?'STALE':metrics.decoded?'OBSERVED SWAPS':'SNAPSHOTS',w-margin,y+15,'#666',7);c.textAlign='left';
  canvas.dataset.active=String(active);canvas.dataset.burst=String(Boolean(burst));canvas.dataset.energy=energy.toFixed(3);canvas.dataset.density=drive.toFixed(3);canvas.dataset.phase=phase.toFixed(3);
 }
 animation=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){
   metrics=next;options=settings;model=fieldState(next);dirty=true;
   const nextSeed=settings.seed==null?seed:Number(settings.seed)>>>0,replay=Boolean(next.replay);
   if(nextSeed!==seed||replay!==lastReplay){seed=nextSeed;lastReplay=replay;observation=null;events=[];clearBurst();lastBurst=-Infinity;lastEvent=-Infinity;}
   const current={at:finite(next.replay?.at),price:finite(next.replay?.price??next.context?.latestPrice??next.context?.path?.at(-1)?.close),volume:finite(next.replay?.volume??next.observation?.volume),trades:next.observation?.trades?Number(next.observation.trades.buys||0)+Number(next.observation.trades.sells||0):null};
   const previous=observation;observation=current;
   if(!running()){clearBurst();return;}
   if(!previous)return; // Establish the baseline without flashing on load/seek.
   const changed=current.price>0&&previous.price>0&&Math.abs(current.price/previous.price-1)>1e-9;
   if(replay){
    if(current.at!==previous.at&&(current.volume>0||changed))trigger('candle:'+current.at,model.drive);
   }else if(!next.decoded&&performance.now()-lastEvent>1000){
    const moreVolume=current.volume!=null&&previous.volume!=null&&current.volume>previous.volume;
    const moreTrades=current.trades!=null&&previous.trades!=null&&current.trades>previous.trades;
    if(changed||moreVolume||moreTrades)trigger('snapshot:'+current.price+':'+current.volume+':'+current.trades,model.drive);
   }
  },
  pulse(voice,at){if(burst&&performance.now()<burst.until){lastPulse={voice:Number(voice)||0,at:Number(at)||0};dirty=true;}},
  event(trade={}){
   if(trade.removed||metrics.replay||!['swap','pool-transaction','market-price'].includes(trade.kind))return;
   const id=trade.id||trade.signature;
   if(id&&events.includes(id))return;
   if(id){events.push(id);if(events.length>256)events.shift();}
   lastEvent=performance.now();
   trigger(id||[trade.kind,trade.occurredAt||trade.receivedAt,trade.priceUsd].join(':'),Math.max(model.drive,unit(Math.log1p(Math.max(0,Number(trade.usdVolume)||0))/Math.log(1e6))));
  },
  reset(){clearBurst();observation=null;lastBurst=-Infinity;lastEvent=-Infinity;events=[];phase=0;},
  close(){closed=true;cancelAnimationFrame(animation);observer.disconnect();visibility?.disconnect();},
 };
}
