import {createVisualFullscreen} from './visual-fullscreen.js?v=141';
import {createPixelBlastField,pixelBlastParameters} from './pixel-blast-field.js?v=154';
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const finite=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
export function fieldState(m={}){
 const raw=m.raw||m,context=m.context||{},fresh=unit(m.fresh);
 // Valuation shapes space; only current observations or replay create motion.
 const activity=unit(raw.activity),volume=unit(raw.volume);
 // Music intensity already includes freshness. Recover its raw contextual
 // strength here; the renderer applies freshness once to the market response.
 const move=fresh>0?unit(unit(m.music?.intensity)/fresh):0;
 const drive=unit(.5*move+.3*Math.sqrt(activity*volume)+.2*unit(context.pressure));
 const holder=m.replay?null:finite(m.audience?.holders);
 const liquidity=m.availability?.liquidity===false?null:finite(m.observation?.liquidity);
 const values=[finite(m.music?.changePct),m.decoded?finite(m.tradeRate):null,finite(m.replay?.volume??(m.decoded?m.observedVolume:m.observation?.volume)),m.availability?.balance===false?null:finite(m.balance),liquidity,finite(context.latestCap),holder];
 // Missing historical liquidity stays neutral, never borrowed from today's pool.
 const capital=values[5]>0?unit((Math.log10(values[5])-4)/4):.5;
 // A known cap gradually pulls the flow into the artwork: $100K → $5M.
 const imageGrowth=values[5]>0?unit((Math.log10(values[5])-5)/Math.log10(50)):0;
 const identity=imageGrowth*imageGrowth*(3-2*imageGrowth);
 const depth=liquidity===null?.5:liquidity>0?unit((Math.log10(liquidity)-3)/4):0;
 const surge=context.volumeRatio>1?unit(Math.log10(context.volumeRatio)):0;
 const imbalance=m.availability?.balance===false?0:Math.abs(2*unit(m.balance??.5)-1);
 return {drive,fresh,values,activity,volume,motion:unit(raw.motion),capital,identity,depth,surge,imbalance,liquidity,holder,holderWeight:unit(m.audience?.weight),change:finite(m.music?.changePct),tempo:Math.max(10,Math.min(240,Number(m.music?.tempo)||40)),pressure:unit(context.pressure),balance:m.availability?.balance===false?.5:unit(m.balance??.5)};
}

// Market data shapes the field. Quiet activity leaves smaller, weaker dots;
// the individual squares change without fading or hiding the whole layer.
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d',{alpha:true});
 if(!c)return {frame(){},event(){},pulse(){},piano(){},setImage(){},snapshot(){return null;},refresh(){},reset(){},close(){}};
 const mobile=matchMedia('(max-width:760px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const host=canvas.closest('.audio-visualizer'),anchor=document.createComment('binary visual home');
 const blast=host?createPixelBlastField(host):null;
 const fullscreen=host?createVisualFullscreen(host):null;
 if(host){host.after(anchor);host.dataset.audible='false';host.dataset.visible='true';}
 const buffers=new WeakMap(),spectra=new WeakMap(),notationBands=new WeakMap();
 let latest=fieldState(),smoothed=null,options={},seed=1917,clock=0,liquidClock=0,audioEvent=0;
 let sourceClock=null,sourceAt=0,previous=null,seen=new Set(),lastEvent=-Infinity;
 let displayClock=0,displayCursor=null,displayAt=0,displayRunning=false;
 let pulseAt=-Infinity,pulseStrength=0,level=0,previousLevel=0,lastSound=-Infinity,lastEnvelope=-Infinity;
 let frameID=0,lastPaint=0,dirty=true,closed=false,visible=true,replaying=false;
 let audible=false,hasMarket=false,width=0,height=0,layoutPending=true;
 let pianoPulses=[],pianoEnergy=0;
 let formation=0,scoreMorph=0,scoreValues=[0,0,0,0],scoreHistory=new Array(8).fill(-1),layoutKey=null,visualCursor=null,marketPulse=-Infinity;
 const running=()=>{
  const state=getState();
  return Boolean(state.playing&&state.master!==0&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');
 };
 function hide(){
  audible=false;level=0;previousLevel=0;lastSound=-Infinity;
  c.clearRect(0,0,canvas.width,canvas.height);
  blast?.clear();
  if(host){host.dataset.audible='false';host.dataset.visible='false';}
  Object.assign(canvas.dataset,{active:'false',visible:'false',overlay:'false',moving:'false',level:'0',density:'0'});
 }
 function clear(newCoin=false){
  previous=null;smoothed=null;visualCursor=null;marketPulse=-Infinity;pianoPulses=[];pianoEnergy=0;seen.clear();sourceClock=null;sourceAt=0;
  displayClock=0;displayCursor=null;displayAt=0;displayRunning=false;
  audioEvent=0;
  lastEvent=-Infinity;pulseAt=-Infinity;pulseStrength=0;lastEnvelope=-Infinity;hasMarket=false;lastPaint=0;dirty=true;
  audible=false;previousLevel=level;lastSound=-Infinity;
  if(newCoin){clock=0;liquidClock=0;level=0;previousLevel=0;formation=0;scoreMorph=0;}
  blast?.reset(seed);
 }
 function fitHeight(){
  if(!host)return;
  // Freeze height across browser toolbar changes. Width/orientation changes
  // rebuild the layout; desktop window resizing also updates its height.
  const touch=mobile.matches||matchMedia('(pointer:coarse)').matches;
  const key=[innerWidth,mobile.matches,screen.orientation?.angle??0,touch?0:innerHeight].join(':');
  if(key===layoutKey)return;layoutKey=key;
  const form=document.getElementById('coin-form');
  const top=mobile.matches?0:Math.max(0,Math.round((form?.getBoundingClientRect().top??0)+scrollY-(parseFloat(getComputedStyle(form||host).marginTop)||0)+(parseFloat(getComputedStyle(host).marginTop)||0)));
  host.style.setProperty('--visual-top',top+'px');
  host.style.setProperty('--visual-height',Math.max(180,Math.round(mobile.matches?innerHeight*.56:innerHeight-top))+'px');
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
  if(host&&!host.classList.contains('is-expanded')){if(mobile.matches&&readings)readings.after(host);else anchor.parentNode?.insertBefore(host,anchor);}
  size();
 }
 const layoutChanged=()=>{layoutPending=true;dirty=true;};
 const motionChanged=()=>{dirty=true;};
 mobile.addEventListener('change',arrange);reduced.addEventListener('change',motionChanged);
 window.addEventListener('resize',layoutChanged);
 document.addEventListener('visibilitychange',layoutChanged);window.addEventListener('pageshow',layoutChanged);arrange();
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
 function drawNotation(params,dt){
  const scopes=getAudio()?.scopes||[],d=canvas.width/Math.max(1,width);
  const layer=[...host.querySelectorAll('.pixel-blast-layer')].find(n=>getComputedStyle(n).display!=='none');
  const w=layer?.width||canvas.width,h=layer?.height||canvas.height;
  const raster=Math.max(2,Math.round(params.cellSize*w/Math.max(1,width)));
  const cellX=raster*canvas.width/w,cellY=raster*canvas.height/h;
  const originX=Math.floor(w/2)*canvas.width/w;
  const originY=(layer?.classList.contains('pixel-blast-software')?Math.floor(h/2):h-Math.floor(h/2))*canvas.height/h;
  let drawn=0;
  const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
  // Independent sound spectra form disconnected square constellations.
  // No paths, baselines, fixed lanes or repeated copies of the master signal.
  for(const [index,scope] of scopes.entries()){
   let meter=null,power=0;
   for(const channel of scope.channels){
    let samples=buffers.get(channel);if(!samples){samples=new Float32Array(channel.fftSize);buffers.set(channel,samples);}
    channel.getFloatTimeDomainData(samples);let squares=0;
    for(const sample of samples)squares+=sample*sample;
    const rms=Math.sqrt(squares/samples.length);if(rms>power){power=rms;meter=channel;}
   }
   if(!meter||power<.0005)continue;
   let spectrum=spectra.get(meter);if(!spectrum){spectrum=new Float32Array(meter.frequencyBinCount);spectra.set(meter,spectrum);}
   meter.getFloatFrequencyData(spectrum);
   const hz=meter.context.sampleRate/meter.fftSize;
   for(let band=0;band<16;band++){
    const low=70*Math.pow(130,band/16),high=70*Math.pow(130,(band+1)/16);
    let db=-Infinity;for(let bin=Math.max(1,Math.floor(low/hz));bin<Math.min(spectrum.length,Math.ceil(high/hz));bin++)db=Math.max(db,spectrum[bin]);
    let bands=notationBands.get(scope);if(!bands){bands=new Float32Array(16);notationBands.set(scope,bands);}
    const target=unit((db+65)/45)*unit(power*40);
    bands[band]+=(target-bands[band])*(1-Math.exp(-dt/(target>bands[band]?.12:.25)));
    const energy=bands[band];if(energy<.035)continue;
    const key=(seed^Math.imul(index+1,73856093)^Math.imul(band+1,19349663))>>>0;
    const x=canvas.width*(.07+.86*hash(key)),y=canvas.height*(.08+.84*hash(key+71));
    const count=8,size=Math.max(1,Math.min(cellX-1,params.dotSize*d*(.4+.6*energy)));
    c.fillStyle=`rgba(255,255,255,${.25+.75*energy})`;
    for(let mark=0;mark<count;mark++){
     if(energy<(mark+1)/12)continue;
     const dx=(hash(key+mark*131+17)-.5)*cellX*24,dy=(hash(key+mark*173+53)-.5)*cellY*24;
     const cx=originX+(Math.floor((x+dx-originX)/cellX)+.5)*cellX;
     const cy=originY+(Math.floor((y+dy-originY)/cellY)+.5)*cellY;
     c.fillRect(Math.round(cx-size/2),Math.round(cy-size/2),Math.round(size),Math.round(size));
    }
   }
   drawn++;
  }
  canvas.dataset.scopeInputs=String(drawn);
  canvas.dataset.notation='discrete-spectral-marks';
 }
 function presentationTime(now,active=running()&&hasMarket){
  if(!replaying||sourceClock===null)return now/1000;
  const rate=Math.max(0,Number(options.rate)||1);
  const cursor=sourceClock+(active?Math.min(.25,Math.max(0,(now-sourceAt)/1000))*rate:0);
  if(active&&displayRunning&&displayCursor!==null){
   const elapsed=Math.min(.25,Math.max(0,(now-displayAt)/1000));
   displayClock+=Math.min(Math.max(0,cursor-displayCursor),elapsed*rate);
  }
  // A stopped or slightly late source cannot rewind the displayed pattern.
  // Keep event ages relative so long history ranges retain shader precision.
  displayCursor=displayCursor===null?cursor:Math.max(displayCursor,cursor);
  displayAt=now;displayRunning=active;
  return cursor;
 }
 function excite(strength=.65,key=null,frameTime=null){
  if(!running())return;
  const now=performance.now(),remaining=pulseStrength*Math.exp(-(now-pulseAt)/280);
  pulseStrength=Math.max(remaining,unit(strength));pulseAt=now;dirty=true;
  const settings=pixelBlastParameters({...latest,active:true});
  blast?.pulse({key:key??'audio:'+audioEvent++,time:frameTime??presentationTime(now),strength,balance:settings.balance,direction:settings.direction});
 }
 function draw(now){
  if(closed)return;frameID=requestAnimationFrame(draw);
  if(layoutPending){layoutPending=false;size();}
  if(document.hidden||!visible||width<1||height<1){lastPaint=0;return;}
  if(now-lastPaint<(audible?(mobile.matches?1000/24:1000/30):1000/15))return;
  const resumedPaint=lastPaint===0;
  const dt=lastPaint?Math.min(.1,(now-lastPaint)/1000):1/30;lastPaint=now;
  const active=running()&&hasMarket;
  const eventTime=presentationTime(now,active);
  if(!active){pulseStrength=0;pulseAt=-Infinity;}
  const rms=active?measure():0;
  if(rms>(audible?.0002:.0005))lastSound=now;
  audible=active&&(rms>.0005||now-lastSound<100);
  if(host){host.dataset.audible=String(audible);host.dataset.visible='true';}
  const target=audible?unit((20*Math.log10(Math.max(1e-8,rms))+70)/52):0;
  level+=(target-level)*(1-Math.exp(-dt/(target>level?.15:1.4)));
  const audioTime=getAudio()?.context?.currentTime??0;
  if(!active)pianoPulses=[];
  pianoPulses=pianoPulses.filter(p=>audioTime-p.at<3);
  // Future lookahead notes create a local disturbance only when they sound.
  for(const p of pianoPulses){if(!p.fired&&audioTime>=p.at){p.fired=true;if(audioTime-p.at<.15)excite(p.strength*.65,p.key,eventTime);}}
  const pianoTarget=active?pianoPulses.reduce((peak,p)=>{const age=audioTime-p.at;return age<0?peak:Math.max(peak,p.strength*Math.min(1,age/.08)*Math.exp(-age/.65));},0):0;
  pianoEnergy+=(pianoTarget-pianoEnergy)*(1-Math.exp(-dt/.12));
  const eventHeat=active?Math.exp(-Math.max(0,now-marketPulse)/3500):0;
  const presence=Math.max(eventHeat,active?pianoEnergy:0);
  const shapeTarget=presence<.002?0:presence*unit(.6+.4*level);
  formation+=(shapeTarget-formation)*(1-Math.exp(-dt/(shapeTarget>formation?.35:1.2)));
  if(shapeTarget===0&&formation<.002)formation=0;
  // Keep settling after pause/mute even when no market frames are arriving.
  if(Math.abs(shapeTarget-formation)>.0001||Math.abs(target-level)>.0001)dirty=true;
  const envelopeRise=unit((level-previousLevel)*9);previousLevel=level;
  if(active&&audible&&!reduced.matches&&envelopeRise>.045&&now-lastEnvelope>220){
   lastEnvelope=now;excite(envelopeRise,'envelope:'+audioEvent++,eventTime);
  }
  const transient=active&&!reduced.matches?Math.max(pulseStrength*Math.exp(-(now-pulseAt)/280),envelopeRise):0;
  if(!smoothed||replaying)smoothed={...latest};
  const approach=1-Math.exp(-dt/.16);
  for(const key of ['drive','activity','volume','pressure','balance','motion','fresh','capital','identity','depth','surge','imbalance','tempo','change'])smoothed[key]+=(Number(latest[key]??0)-Number(smoothed[key]??0))*approach;
  const visualInputs={...smoothed,level,formation,piano:pianoEnergy,transient,active,reducedMotion:reduced.matches,mobile:mobile.matches};
  const visualParams=pixelBlastParameters(visualInputs);
  const morphTarget=active?unit((.5*smoothed.drive+.3*smoothed.activity+.2*pianoEnergy-.12)/.5):0;
  scoreMorph+=(morphTarget-scoreMorph)*(1-Math.exp(-dt/.9));
  const score={morph:scoreMorph,energy:unit(.5*level+.2*smoothed.volume+.2*smoothed.pressure+.1*smoothed.surge),motion:smoothed.motion,values:scoreValues,history:scoreHistory};
  // Integrate speed rather than multiplying a large clock by changing speed:
  // a new observation then changes motion smoothly, without jumping patterns.
  if(!reduced.matches){
   let advance=0;
   if(replaying&&sourceClock!==null){
    if(active&&!resumedPaint&&visualCursor!==null)advance=Math.max(0,eventTime-visualCursor)*visualParams.speed;
   }else advance=dt*visualParams.speed;
   if(replaying){clock=eventTime*1.35;liquidClock=eventTime*.6;}else{clock+=advance;liquidClock+=advance*visualParams.liquidWobbleSpeed;}
   dirty=true;
  }
  visualCursor=replaying?eventTime:null;
  if(!audible){blast?.clear();c.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.scopeInputs='0';dirty=true;return;}
  if(!dirty)return;dirty=false;
  c.clearRect(0,0,canvas.width,canvas.height);
  blast?.render({width,height,time:clock,liquidTime:liquidClock,eventTime,...visualInputs,parameters:visualParams,score,dither:getState().dither===true});
  drawNotation(visualParams,dt);
  Object.assign(canvas.dataset,{composition:['ready','canvas'].includes(host?.dataset.pixelBlast)?'pixel-blast':'unavailable',active:String(audible),visible:'true',overlay:'false',moving:String(!reduced.matches),motion:clock.toFixed(4),phase:clock.toFixed(4),level:level.toFixed(4),density:formation.toFixed(4),rows:'0',transitioning:String(Math.abs(shapeTarget-formation)>.001),formation:formation.toFixed(4)});
 }
 frameID=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){
   scoreValues=[next.replay?.price??next.context?.latestPrice,next.context?.latestCap,next.availability?.liquidity===false?null:next.observation?.liquidity,next.decoded?next.tradeRate:null].map(n=>Number.isFinite(Number(n))?Number(n):0);
   const path=(next.context?.path||[]).slice(-8).map(p=>Number(p.close));
   const known=path.filter(n=>Number.isFinite(n)&&n>0),low=Math.min(...known),high=Math.max(...known);
   scoreHistory=new Array(8-path.length).fill(-1).concat(path.map(n=>Number.isFinite(n)&&n>0?(high>low?(n-low)/(high-low):.5):-1));
   const nextSeed=settings.seed==null?seed:Number(settings.seed)>>>0,nextReplay=!!next.replay;
   if(nextSeed!==seed||nextReplay!==replaying){clear(true);seed=nextSeed;replaying=nextReplay;blast?.reset(seed);}
   const incoming=finite(settings.clock)??(finite(settings.position)==null?null:Number(settings.position)*60);
   const seeking=Boolean(settings.seeking)&&(!options.seeking||incoming!==sourceClock);
   const backwards=incoming!==null&&sourceClock!==null&&incoming<sourceClock;
   if(replaying&&(seeking||backwards)){
    clock=0;liquidClock=0;displayClock=0;displayCursor=null;displayAt=0;displayRunning=false;visualCursor=null;
    blast?.reset(seed);
   }
   options=settings;latest=fieldState(next);dirty=true;
   if(incoming!==null&&incoming!==sourceClock){sourceClock=incoming;sourceAt=performance.now();}
   const current={at:finite(next.replay?.at),price:finite(next.replay?.price??next.context?.latestPrice??next.context?.path?.at(-1)?.close),cap:finite(next.context?.latestCap),volume:finite(next.replay?.volume??next.observation?.volume),trades:next.observation?.trades?Number(next.observation.trades.buys||0)+Number(next.observation.trades.sells||0):null};
   const old=previous;previous=current;hasMarket=current.price>0;
   if(!running())return;
   if(!old&&(latest.activity>0||latest.volume>0)&&latest.fresh>0)marketPulse=performance.now();
   const changed=current.price>0&&old?.price>0&&Math.abs(current.price/old.price-1)>1e-9;
   if(replaying){
    if(current.at!==old?.at&&(current.volume>0||changed))marketPulse=performance.now();
    if(current.at!==old?.at&&(current.volume>0||changed))excite(.35+.65*latest.drive,changed||current.volume!==old?.volume?'replay:'+current.price+':'+current.volume:null);
   }else if(!next.decoded&&performance.now()-lastEvent>1000&&old){
    if(changed||(current.volume!=null&&old.volume!=null&&current.volume>old.volume)||(current.trades!=null&&old.trades!=null&&current.trades>old.trades)){marketPulse=performance.now();excite(.35+.65*latest.drive,'market:'+current.price+':'+current.volume+':'+current.trades);}
   }
  },
  event(trade={}){
   if(trade.removed||replaying||!['swap','pool-transaction','market-price'].includes(trade.kind))return;
   const id=trade.id||trade.signature;if(id&&seen.has(id))return;
   if(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
   lastEvent=performance.now();marketPulse=lastEvent;excite(.4+.6*unit(Math.log1p(Math.max(0,Number(trade.usdVolume)||0))/Math.log(100001)),id??('trade:'+trade.occurredAt+':'+trade.priceUsd));
  },
  piano(at,strength=1){if(running()&&Number.isFinite(at)){pianoPulses.push({at,strength:unit(strength),key:'note:'+audioEvent++,fired:false});pianoPulses=pianoPulses.slice(-24);dirty=true;}},
  pulse(strength=.7){excite(unit(strength)||.7);},
  snapshot(){return blast?.snapshot()??null;},
  setImage(image){blast?.setImage(image);dirty=true;},
  refresh(){dirty=true;},
  reset(){clear(true);scoreMorph=0;scoreHistory=new Array(8).fill(-1);scoreValues=[0,0,0,0];},
  close(){
   closed=true;cancelAnimationFrame(frameID);hide();fullscreen?.close();blast?.close();resize.disconnect();visibility?.disconnect();
   mobile.removeEventListener('change',arrange);reduced.removeEventListener('change',motionChanged);
   window.removeEventListener('resize',layoutChanged);
   document.removeEventListener('visibilitychange',layoutChanged);window.removeEventListener('pageshow',layoutChanged);
   if(host)anchor.parentNode?.insertBefore(host,anchor);anchor.remove();
  },
 };
}
