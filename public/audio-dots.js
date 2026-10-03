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
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d',{alpha:false});if(!c)return {frame(){},event(){},pulse(){},close(){}};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let w=0,h=0,last=0,tap=null,wave,spectrum,animation=0,closed=false,visible=true,dirty=true;
 let metrics={},options={},seed=1917,phase=0,activeBefore=false,energy=0,motion=0,events=[],lastPulse=null,model=fieldState(),lastReplay=false;
 const bands=new Float32Array(64),observer=new ResizeObserver(size);
 observer.observe(canvas);
 const visibility=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)dirty=true;}):null;visibility?.observe(canvas);
 function size(){const b=canvas.getBoundingClientRect();w=b.width;h=b.height;const d=Math.min(globalThis.devicePixelRatio||1,w<600?1.25:1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);dirty=true;}
 function text(label,x,y,color='#777',size=8){c.fillStyle=color;c.font=`${size}px Arial, sans-serif`;c.fillText(label,x,y);}
 function sample(dt){
  const audio=getAudio();if(audio&&audio!==tap){tap=audio;wave=new Float32Array(tap.fftSize);spectrum=new Uint8Array(tap.frequencyBinCount);}
  if(!tap)return;
  tap.getFloatTimeDomainData(wave);tap.getByteFrequencyData(spectrum);
  let rms=0;for(const v of wave)rms+=v*v;const smoothing=1-Math.exp(-dt/.14);energy+=(unit(Math.sqrt(rms/wave.length)*5)-energy)*smoothing;
  const min=2,max=Math.min(spectrum.length,Math.floor(12000*tap.fftSize/tap.context.sampleRate));
  for(let b=0;b<bands.length;b++){
   const start=Math.floor(min*(max/min)**(b/bands.length)),end=Math.max(start+1,Math.floor(min*(max/min)**((b+1)/bands.length)));
   let sum=0,count=0;for(let i=start;i<end&&i<spectrum.length;i++){sum+=spectrum[i]/255;count++;}bands[b]+=(sum/(count||1)-bands[b])*smoothing;
  }
 }
 function terrain(x,y,width,height,drive){
  const columns=w<500?52:82,depths=w<500?30:44,trace=model.trace;
  // Each depth slice samples actual price history; no random trades are added.
  // Without history, only measured scalar values form the still reference plane.
  const angle=.24*Math.sin(phase*.065)+(model.balance-.5)*.13,cs=Math.cos(angle),sn=Math.sin(angle);
  const tilt=.35+Math.sin(phase*.021)*.23,ct=Math.cos(tilt),st=Math.sin(tilt);
  const f=Math.min(width*.79,height*1.1),cx=x+width*.5,cy=y+height*.43;
  const pitch=model.change==null?0:Math.tanh(model.change/20);
  for(let z=depths-1;z>=0;z--){
   const progression=z/(depths-1),sample=trace.length?trace[Math.round((1-progression)*(trace.length-1))]:null;
   const heightValue=sample?(sample.height-.5)*1.35:0;
   const warp=(sample?.move||0)*drive*.28;
   for(let col=0;col<columns;col++){
    const data=model.values[(z+col)%model.values.length];
    const key=data==null?seed:seed^Math.round(Math.abs(data)*1000);
    const selected=hash(key,col*173+z*23);
    if(selected>.22+drive*.67+energy*.07)continue;
    let px=(col/(columns-1)-.5)*4.25;
    const stripe=Math.sin(px*4+progression*12+phase*.2)*warp;
    const py=heightValue+stripe+(sample?.volume||0)*.22*Math.cos(px*3)+pitch*px*.06;
    let pz=progression*3.8;
    const rx=px*cs-pz*sn,rz=px*sn+pz*cs;
    const ry=py*ct-rz*st,depth=py*st+rz*ct+3.25;
    const sx=cx+rx*f/depth,sy=cy-ry*f/depth;
    const brightness=Math.round((58+drive*155+bands[col%64]*42)*(1-.45*progression));
    c.fillStyle=`rgb(${brightness},${brightness},${brightness})`;
    const dot=selected<.12&&drive>.45?1.65:1;
    c.fillRect(Math.round(sx),Math.round(sy),dot,dot);
    if(sample&&selected<drive*.065){c.fillStyle='#c0c0c0';c.fillRect(Math.round(sx),Math.round(sy),1,Math.max(2,Math.abs(sample.move)*22));}
   }
  }
 }
 function barcode(x,y,width,height,drive,active){
  const cols=Math.max(96,Math.min(240,Math.floor(width/2))),cw=width/cols;
  const groups=5,gh=height/groups,offset=phase*(.9+drive*3);
  for(let group=0;group<groups;group++){
   const data=model.values[group%model.values.length];if(data==null)continue;
   const word=Math.round(Math.abs(data)*10000)>>>0;
   const shift=group%2?offset:-offset;
   for(let col=0;col<cols;col++){
    const pick=hash(seed^word,col+group*617),on=((word>>>(col%31))&1)===1;
    if(pick>(.12+drive*.62))continue;
    const left=x+((col*cw+shift)%width+width)%width;
    const bar=Math.max(1,cw*(.2+pick*.75));
    const spectral=bands[(col+group*7)%64];
    const ink=active?Math.round(100+155*Math.max(drive,spectral)):65;
    c.fillStyle=`rgb(${ink},${ink},${ink})`;
    const half=gh*.5-1;
    c.fillRect(Math.floor(left),y+group*gh+(on?0:half+2),bar,Math.max(1,half*(.55+spectral*.45)));
   }
  }
 }
 function draw(now){
  if(closed)return;animation=requestAnimationFrame(draw);
  if(document.hidden||!visible||!w||!h)return;
  const interval=reduced.matches?250:w<500?1000/24:1000/30;if(now-last<interval)return;
  const dt=Math.min(.1,Math.max(.001,(now-last)/1000||.033));last=now;
  const active=Boolean(getState().playing&&options.playing!==false&&!options.seeking&&!options.ended&&getAudio()?.context?.state==='running');
  if(!active&&!dirty&&active===activeBefore)return;
  if(active){sample(dt);motion=metrics.replay?model.drive:motion+(model.drive-motion)*(1-Math.exp(-dt/.28));if(!reduced.matches){if(metrics.replay&&Number.isFinite(options.position))phase=options.position*2;else phase+=dt*(model.tempo/60)*(.25+motion*3.75);}}
  else if(activeBefore){energy=0;bands.fill(0);}
  activeBefore=active;dirty=false;
  const drive=active?motion:model.drive*.55,margin=w<450?12:20;
  const fieldY=47,fieldH=h-105,fieldW=w-margin*2;
  c.fillStyle='#080808';c.fillRect(0,0,w,h);c.textBaseline='alphabetic';c.textAlign='left';
  text('U P I C  /  D A T A   S C O R E',margin,22,'#ddd',8);
  c.textAlign='right';text(active?'RUN  '+Math.round(drive*100).toString().padStart(3,'0'):'HOLD',w-margin,22,'#aaa',8);c.textAlign='left';
  c.strokeStyle='#252525';c.beginPath();c.moveTo(margin,33.5);c.lineTo(w-margin,33.5);c.stroke();
  c.save();c.beginPath();c.rect(margin,fieldY,fieldW,fieldH);c.clip();
  // One coherent field: a dimensional history plane through fine data bands.
  terrain(margin,fieldY,fieldW,fieldH*.88,drive);
  const bandTop=fieldY+fieldH*.56;
  barcode(margin,bandTop,fieldW,fieldH*.27,drive,active);
  // Actual spectrum creates thin frequency columns, rather than a fake waveform.
  const spectrumY=fieldY+fieldH*.94,binWidth=fieldW/bands.length;
  c.fillStyle='#cfcfcf';for(let b=0;b<bands.length;b++){const length=bands[b]*fieldH*.105;if(length>1)c.fillRect(margin+b*binWidth,spectrumY-length,1,length);}
  if(active&&!reduced.matches&&drive>.015){
   const scan=margin+((phase*.035)%1)*fieldW;c.fillStyle='#aaa';c.fillRect(Math.round(scan),fieldY+8,1,fieldH*.93);
  }
  // A real Pd onset lights a local bracket; no full-screen flashing.
  if(active&&lastPulse&&tap&&tap.context.currentTime-lastPulse.at<.16){
   const x=margin+(lastPulse.voice+.5)*fieldW/Math.max(6,lastPulse.voice+1);c.fillStyle='#fff';c.fillRect(x,bandTop-7,8,1);c.fillRect(x,bandTop-7,1,5);
  }
  // Received swaps form the final receipt strip; candle replay never invents it.
  if(metrics.decoded&&!metrics.replay){
   const recent=events.slice(-90),ew=fieldW/90;
   for(let i=0;i<recent.length;i++){const e=recent[i];c.fillStyle=e.side==='sell'?'#666':'#ddd';c.fillRect(w-margin-(recent.length-i)*ew,fieldY+fieldH-4,1+unit(Math.log1p(e.volume)/12)*Math.max(1,ew-1),2);}
  }
  c.restore();
  const y=h-44;
  text('Δ '+(model.change==null?'—':(model.change>=0?'+':'')+model.change.toFixed(2)+'%')+'    VOL '+compact(model.values[2]),margin,y,'#aaa',8);
  c.textAlign='right';text('CAP '+compact(model.values[5]),w-margin,y,'#aaa',8);c.textAlign='left';
  const age=finite(metrics.audience?.age),ageText=age==null?'AGE UNKNOWN':age<3600000?Math.floor(age/60000)+'M AGO':Math.floor(age/3600000)+'H AGO';
  const holderLabel=model.holder==null?'HOLDERS —':'HOLDERS '+compact(model.holder)+' / '+(model.holderWeight<=0?'STALE':ageText);
  text(metrics.replay?'CANDLE SCORE / NO HISTORICAL HOLDERS':holderLabel,margin,y+15,'#666',7);
  c.textAlign='right';text(metrics.replay?'REPLAY':model.fresh<=0?'STALE':metrics.decoded?'OBSERVED SWAPS':'SNAPSHOTS',w-margin,y+15,'#777',7);c.textAlign='left';
  canvas.dataset.active=String(active);canvas.dataset.energy=energy.toFixed(3);canvas.dataset.density=drive.toFixed(3);canvas.dataset.phase=phase.toFixed(3);
 }
 animation=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){
   const wasPlaying=options.playing;metrics=next;options=settings;model=fieldState(next);
   dirty=dirty||Boolean(settings.playing)||wasPlaying!==settings.playing||Boolean(settings.seeking);
   const nextSeed=Number(settings.seed)>>>0,replay=Boolean(next.replay);
   if((settings.seed!=null&&nextSeed!==seed)||replay!==lastReplay){seed=nextSeed;phase=0;motion=0;events=[];lastPulse=null;lastReplay=replay;dirty=true;}
   // Historical position, independent of frame rate, anchors replay and seeks.
   if(next.replay&&Number.isFinite(settings.position)&&!reduced.matches)phase=settings.position*2;
  },
  pulse(voice,at){lastPulse={voice:Number(voice)||0,at:Number(at)||0};},
  event(trade={}){if(trade.removed||trade.kind&&trade.kind!=='swap')return;const id=trade.id||trade.signature;if(id&&events.some(e=>e.id===id))return;events.push({id,side:trade.side,volume:Math.max(0,Number(trade.usdVolume)||0)});if(events.length>256)events.shift();},
  close(){closed=true;cancelAnimationFrame(animation);observer.disconnect();visibility?.disconnect();},
 };
}
