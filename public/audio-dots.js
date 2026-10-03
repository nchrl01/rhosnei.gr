import {createMarketBackground} from './market-background.js?v=81';
// Original market score: precise raster, binary registers and price topography.
// Retain the last observation and blend updates. Geometry never feeds audio.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const finite=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
const hash=(seed,index)=>{let n=Math.imul((seed>>>0)^index,1597334677);n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};
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
 return {drive,fresh,trace,values,activity,volume,liquidity,holder,holderWeight:unit(m.audience?.weight),change:finite(m.music?.changePct),tempo:Math.max(10,Math.min(240,Number(m.music?.tempo)||40)),pressure:unit(context.pressure),balance:m.availability?.balance===false?.5:unit(m.balance??.5)};
}
// New observations replace detail through a continuous blend, with no blank gap.
const TRANSITION_MS=420;
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 let c=canvas?.getContext('2d',{alpha:true});if(!c)return {frame(){},event(){},pulse(){},reset(){},close(){}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),mobile=matchMedia('(max-width:760px)');
 const background=createMarketBackground();
 const host=canvas.closest('.audio-visualizer'),anchor=document.createComment('market visual home');
 if(host)host.after(anchor);
 const ink=()=>mobile.matches?'#fff':'#111';
 let w=0,h=0,last=0,tap=null,wave,spectrum,animation=0,closed=false,visible=true,dirty=true;
 let metrics={},options={},seed=1917,phase=0,activeBefore=false,energy=0,events=[],lastPulse=null,model=fieldState(),lastReplay=false;
 let field=null,observation=null,lastEvent=-Infinity,queued=false,lastUpdate=-Infinity;
 let baseScene=null,nextScene=null,blendScene=null,transitionAt=0,displayModel=null,displayDrive=0;
 const bands=new Float32Array(64),observer=new ResizeObserver(size);
 observer.observe(canvas);
 document.fonts?.ready.then(()=>{if(!closed)size();});
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  visible=entries[0]?.isIntersecting??true;dirty=true;
 }):null;visibility?.observe(canvas);
 function size(){const b=canvas.getBoundingClientRect();w=b.width;h=b.height;const d=Math.min(globalThis.devicePixelRatio||1,w<600?1.25:1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);if(w>0&&h>0&&baseScene&&displayModel){baseScene=renderField(displayModel);nextScene=null;blendScene=null;}dirty=true;}
 function text(label,x,y,color='#555',size=8){c.fillStyle=mobile.matches?'#fff':color;c.font=`${size}px NDS12, sans-serif`;c.fillText(label,x,y);}
 function running(){return Boolean(getState().playing&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');}
 function clearField(){field=null;lastPulse=null;energy=0;bands.fill(0);baseScene=null;nextScene=null;blendScene=null;displayModel=null;queued=false;displayDrive=0;dirty=true;}
 function observe(strength=0){
  if(!running()||document.hidden||!visible)return;
  // Keep the composition, registration marks and point positions stable for
  // this coin. Market detail can change without re-randomizing the whole image.
  field={word:seed,strength:unit(strength)};
  phase=hash(seed,31)*100;queued=true;dirty=true;
 }
 function layer(){const node=document.createElement('canvas');node.width=canvas.width;node.height=canvas.height;return node;}
 function renderField(snapshot){
  const node=layer(),paint=node.getContext('2d'),screen=c,latest=model;
  c=paint;model=snapshot;c.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
  const drive=unit(.22+model.drive*.45+(field?.strength||0)*.33),margin=w<450?12:20;
  const fieldY=0,fieldH=h,fieldW=w-margin*2;
  c.textBaseline='alphabetic';c.textAlign='left';
  const screenSettings=getState();
  background.paint(c,w,h,model,{seed,position:options.position??model.change??0,dither:screenSettings.dither!==false,nds:screenSettings.nds!==false,invert:mobile.matches});
  c.save();c.beginPath();c.rect(margin,fieldY,fieldW,fieldH);c.clip();
  score(margin,fieldY+1,fieldW-1,fieldH-2,drive);
  // The latest Pd voice becomes a small retained mark, not a blinking accent.
  if(lastPulse){const x=margin+(lastPulse.voice+.5)*fieldW/5,y=fieldY+fieldH*.56;c.fillStyle=ink();c.fillRect(x,y-7,8,1);c.fillRect(x,y-7,1,5);}
  for(let i=0;i<Math.round(5+drive*13);i++){
   const x=margin+hash(field.word,i+99)*Math.max(0,fieldW-35),y=fieldY+hash(field.word,i+171)*fieldH;
   text(['+','[ ]','|','0','1',':'][Math.floor(hash(field.word,i+801)*6)],x,y,'#111',9);
  }
  c.restore();c=screen;model=latest;displayDrive=drive;return node;
 }
 function blended(now){
  if(!nextScene)return baseScene;
  const t=unit((now-transitionAt)/TRANSITION_MS),mix=t*t*(3-2*t);
  blendScene??=layer();const paint=blendScene.getContext('2d');
  paint.clearRect(0,0,blendScene.width,blendScene.height);
  // Sum alpha on transparency so unchanged marks keep exactly the same
  // opacity through a transition, on white desktop and inverted mobile alike.
  paint.globalCompositeOperation='source-over';paint.globalAlpha=1-mix;paint.drawImage(baseScene,0,0);
  paint.globalCompositeOperation='lighter';paint.globalAlpha=mix;paint.drawImage(nextScene,0,0);
  paint.globalAlpha=1;paint.globalCompositeOperation='source-over';return blendScene;
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
    const selected=hash(field.word,col*173+z*23);
    if(selected>.12+drive*.55+energy*.06)continue;
    const px=(col/(columns-1)-.5)*4.25,stripe=Math.sin(px*4+progression*12+phase*.2)*warp;
    const py=heightValue+stripe+(point?.volume||0)*.22*Math.cos(px*3)+pitch*px*.06,pz=progression*3.8;
    const rx=px*cs-pz*sn,rz=px*sn+pz*cs,ry=py*ct-rz*st,depth=py*st+rz*ct+3.25;
    const sx=Math.round(cx+rx*f/depth),sy=Math.round(cy-ry*f/depth);
    c.fillStyle=ink();
    const dot=selected<.12&&drive>.45?1.65:1;c.fillRect(sx,sy,dot,dot);
    // Plus signs and crosshairs expose the same history samples as the dots.
    if(point&&selected<drive*.025){c.fillRect(sx-3,sy,7,1);c.fillRect(sx,sy-3,1,7);}
   }
  }
 }
 // Raster rows follow historical returns/volume; columns expose bits of the
 // current measurements. Missing measurements leave gaps instead of fake data.
 function raster(x,y,width,height,drive){
  const columns=Math.max(48,Math.min(164,Math.floor(width/3.6))),rows=Math.max(24,Math.min(96,Math.floor(height/4))),cw=width/columns,rh=height/rows;
  const trace=model.trace,word=field.word;
  c.fillStyle=ink();
  for(let row=0;row<rows;row++){
   const point=trace[Math.min(trace.length-1,Math.floor(row/rows*trace.length))];
   const datum=model.values[row%model.values.length];if(!point&&datum==null)continue;
   const payload=datum==null?Math.round((point?.height||0)*0xffffffff):Math.round(Math.abs(datum)*1000)>>>0;
   const density=.14+drive*.35+(point?.volume||0)*.12;
   const crease=point?Math.floor(point.height*(columns-1)):-100;
   for(let col=0;col<columns;col++){
    const bit=(payload>>>(col%32))&1,variation=hash(word,row*193+col);
    if(variation>density&&(Math.abs(col-crease)>1))continue;
    const accent=Math.abs(col-crease)<1;
    // Thin marks keep the white field visible even at maximum activity.
    const length=accent?cw*.9:cw*(bit?.83:.29);
    const thickness=accent?Math.min(2,rh*.6):1;
    c.fillRect(Math.round(x+col*cw),Math.round(y+row*rh),Math.max(1,length),thickness);
   }
  }
 }
 function barcode(x,y,width,height,drive){
  const cols=Math.max(56,Math.min(180,Math.floor(width/2.8))),cw=width/cols,groups=7,gh=height/groups;
  c.fillStyle=ink();
  for(let group=0;group<groups;group++){
   const data=model.values[group];if(data==null)continue;
   const word=Math.round(Math.abs(data)*10000)>>>0;
   for(let col=0;col<cols;col++){
    const pick=hash(field.word,col+group*617),on=((word>>>(col%32))&1)===1;
    if(pick>(.18+drive*.42))continue;
    const half=Math.max(1,gh*.5-2);
    c.fillRect(Math.floor(x+col*cw),Math.round(y+group*gh+(on?0:half+3)),Math.max(1,cw*(.24+pick*.7)),Math.max(1,half*(.6+bands[(col+group*7)%64]*.4)));
   }
  }
 }
 function ribbons(x,y,width,height,drive){
  const trace=model.trace;if(trace.length<2)return;
  const rows=4,step=height/rows,cols=Math.min(trace.length,160),cw=width/cols;
  c.fillStyle=ink();
  for(let row=0;row<rows;row++){
   const base=y+(row+1)*step-2;
   for(let col=0;col<cols;col++){
    const point=trace[Math.round(col/(cols-1)*(trace.length-1))];
    const value=row===0?point.height:row===1?Math.abs(point.move):row===2?point.volume:Math.abs(point.move)*point.volume;
    const top=Math.round(base-value*(step-5));
    c.fillRect(Math.round(x+col*cw),top,Math.max(1,cw*.58),1);
    if(row===2&&hash(field.word,col+1411)<drive*.55)c.fillRect(Math.round(x+col*cw),top,1,Math.max(1,base-top));
   }
  }
 }
 function registers(x,y,width,height,drive){
  const lanes=mobile.matches?8:12,gap=width/lanes;
  c.fillStyle=ink();
  for(let lane=0;lane<lanes;lane++){
   const datum=model.values[lane%model.values.length];if(datum==null)continue;
   const word=Math.round(Math.abs(datum)*1000)>>>0,offset=Math.floor(hash(field.word,lane+2800)*24);
   for(let bit=0;bit<32;bit++){
    if(!((word>>>((bit+offset)%32))&1))continue;
    const yy=y+bit*height/32;
    c.fillRect(Math.round(x+lane*gap),Math.round(yy),Math.max(1,gap*(.12+drive*.2)),Math.max(1,height/64));
   }
  }
 }
 function spectrumField(x,y,width,height){
  const cw=width/bands.length;c.fillStyle=ink();
  for(let b=0;b<bands.length;b++){
   const length=bands[b]*height;if(length<1)continue;
   const xx=Math.round(x+b*cw),yy=Math.round(y+height-length);
   c.fillRect(xx,yy,Math.max(1,cw*.6),1);
   for(let step=0;step<length;step+=4)c.fillRect(xx,Math.round(y+height-step),1,1);
  }
 }
 function score(x,y,width,height,drive){
  const family=Math.floor(hash(field.word,73)*3),gutter=mobile.matches?10:14;
  const headH=height*.12,bodyY=y+headH+gutter,bodyH=height*.66,tailY=bodyY+bodyH+gutter,tailH=Math.max(4,y+height-tailY);
  // A short register across the top gives every event an individual signature.
  registers(x,y,width,headH,drive);
  if(family===0){
   raster(x,bodyY,width*.66,bodyH,drive);
   barcode(x+width*.69,bodyY,width*.31,bodyH,drive);
  }else if(family===1){
   barcode(x,bodyY,width,bodyH*.44,drive);
   raster(x,bodyY+bodyH*.49,width*.7,bodyH*.51,drive);
   ribbons(x+width*.74,bodyY+bodyH*.49,width*.26,bodyH*.51,drive);
  }else{
   raster(x,bodyY,width*.28,bodyH,drive);
   terrain(x+width*.31,bodyY,width*.69,bodyH*.78,drive);
   barcode(x+width*.31,bodyY+bodyH*.8,width*.69,bodyH*.2,drive);
  }
  ribbons(x,tailY,width*.69,tailH,drive);
  spectrumField(x+width*.73,tailY,width*.27,tailH);
  // Registration brackets remain present across market updates.
  c.fillStyle=ink();
  for(const [xx,yy,dx,dy] of [[x,y,1,1],[x+width,y,-1,1],[x,y+height,1,-1],[x+width,y+height,-1,-1]]){
   c.fillRect(xx+(dx<0?-9:0),yy,9,1);c.fillRect(xx,yy+(dy<0?-9:0),1,9);
  }
  canvas.dataset.composition=['raster-registers','split-barcode','price-topography'][family];
 }
 function draw(now){
  if(closed)return;animation=requestAnimationFrame(draw);
  if(document.hidden||!visible||!w||!h)return;
  const interval=w<500?1000/24:1000/30;if(now-last<interval)return;
  const dt=Math.min(.1,Math.max(.001,(now-last)/1000||.033));last=now;
  const active=running();
  if(!active){
   if(nextScene){const frozen=layer();frozen.getContext('2d').drawImage(blended(now),0,0);baseScene=frozen;nextScene=null;dirty=true;}
   queued=false;
  }
  if(nextScene&&now-transitionAt>=TRANSITION_MS){baseScene=nextScene;nextScene=null;dirty=true;}
  if(active&&queued&&!nextScene&&(reduced.matches||now-lastUpdate>=TRANSITION_MS)){
   if(!reduced.matches)sample(dt);
   displayModel=model;const fresh=renderField(displayModel);
   if(!baseScene||reduced.matches)baseScene=fresh;
   else{nextScene=fresh;transitionAt=now;}
   queued=false;lastUpdate=now;dirty=true;
  }
  if(!dirty&&!nextScene&&active===activeBefore)return;
  activeBefore=active;dirty=false;
  c.clearRect(0,0,w,h);if(!mobile.matches){c.fillStyle='#fff';c.fillRect(0,0,w,h);}c.textBaseline='alphabetic';c.textAlign='left';
  const scene=blended(now);if(scene)c.drawImage(scene,0,0,w,h);
  canvas.dataset.overlay=String(mobile.matches);canvas.dataset.active=String(active);canvas.dataset.visible=String(Boolean(scene));canvas.dataset.transitioning=String(Boolean(nextScene));canvas.dataset.energy=energy.toFixed(3);canvas.dataset.density=displayDrive.toFixed(3);canvas.dataset.phase=phase.toFixed(3);
 }
 function layout(){if(host){if(mobile.matches)document.body.append(host);else anchor.parentNode?.insertBefore(host,anchor);}size();}
 mobile.addEventListener('change',layout);layout();
 animation=requestAnimationFrame(draw);
 return {
  refresh(){if(displayModel&&baseScene){baseScene=renderField(displayModel);nextScene=null;blendScene=null;dirty=true;}},
  frame(next={},settings={}){
   metrics=next;options=settings;model=fieldState(next);dirty=true;
   const nextSeed=settings.seed==null?seed:Number(settings.seed)>>>0,replay=Boolean(next.replay);
   if(nextSeed!==seed||replay!==lastReplay){seed=nextSeed;lastReplay=replay;observation=null;events=[];clearField();lastUpdate=-Infinity;lastEvent=-Infinity;}
   const current={at:finite(next.replay?.at),price:finite(next.replay?.price??next.context?.latestPrice??next.context?.path?.at(-1)?.close),volume:finite(next.replay?.volume??next.observation?.volume),trades:next.observation?.trades?Number(next.observation.trades.buys||0)+Number(next.observation.trades.sells||0):null};
   const previous=observation;observation=current;
   if(!running())return;
   if(!baseScene&&current.price>0)observe();
   if(!previous)return;
   const changed=current.price>0&&previous.price>0&&Math.abs(current.price/previous.price-1)>1e-9;
   if(replay){
    if(current.at!==previous.at&&(current.volume>0||changed))observe(model.drive);
   }else if(!next.decoded&&performance.now()-lastEvent>1000){
    const moreVolume=current.volume!=null&&previous.volume!=null&&current.volume>previous.volume;
    const moreTrades=current.trades!=null&&previous.trades!=null&&current.trades>previous.trades;
    if(changed||moreVolume||moreTrades)observe(model.drive);
   }
  },
  pulse(voice,at){if(field&&running())lastPulse={voice:Number(voice)||0,at:Number(at)||0};},
  event(trade={}){
   if(trade.removed||metrics.replay||!['swap','pool-transaction','market-price'].includes(trade.kind))return;
   const id=trade.id||trade.signature;
   if(id&&events.includes(id))return;
   if(id){events.push(id);if(events.length>256)events.shift();}
   lastEvent=performance.now();
   observe(Math.max(model.drive,unit(Math.log1p(Math.max(0,Number(trade.usdVolume)||0))/Math.log(1e6))));
  },
  reset(){clearField();observation=null;lastUpdate=-Infinity;lastEvent=-Infinity;events=[];phase=0;},
  close(){closed=true;cancelAnimationFrame(animation);observer.disconnect();visibility?.disconnect();mobile.removeEventListener('change',layout);if(host)anchor.parentNode?.insertBefore(host,anchor);anchor.remove();},
 };
}
