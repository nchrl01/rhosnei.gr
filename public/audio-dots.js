// An authored spatial data score: market measurements set the structure,
// the measured mix sets spectral detail. No viewport geometry drives sound.
const unit=n=>Math.max(0,Math.min(1,Number(n)||0));
const finite=n=>n==null||n===''?null:Number.isFinite(Number(n))?Number(n):null;
const hash=(seed,index)=>{let n=Math.imul((seed>>>0)^index,1597334677);n=Math.imul(n^(n>>>16),2246822507);return ((n^(n>>>13))>>>0)/4294967296;};
const number=(n,digits=2)=>n==null?'UNAVAILABLE':Math.abs(n)>=1000000?(n/1000000).toFixed(2)+'M':Math.abs(n)>=1000?(n/1000).toFixed(2)+'K':n.toFixed(digits);
const ageLabel=age=>age==null||!Number.isFinite(age)?'AGE UNKNOWN':age<60000?Math.floor(Math.max(0,age)/1000)+'S AGO':age<3600000?Math.floor(age/60000)+'M AGO':Math.floor(age/3600000)+'H AGO';
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas?.getContext('2d');if(!c)return {frame(){},event(){},pulse(){},close(){}};
 const desktop=matchMedia('(min-width:1050px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let w=0,h=0,last=0,energy=0,tap=null,wave,spectrum,animation=0,closed=false;
 let metrics={},options={},seed=1917,phase=0,events=[],eventSerial=0,lastPulse=null;
 const bands=new Float32Array(72),smoothBands=new Float32Array(72);
 function size(){const b=canvas.getBoundingClientRect();w=b.width;h=b.height;const d=Math.min(globalThis.devicePixelRatio||1,1.5);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);}
 const observer=new ResizeObserver(size);observer.observe(canvas);
 function text(label,x,y,color='#111',size=8){c.fillStyle=color;c.font=`${size}px Arial, sans-serif`;c.fillText(label,x,y);}
 function rule(x,y,width,color='#111'){c.fillStyle=color;c.fillRect(x,Math.round(y),width,1);}
 function sampleAudio(active,dt){
  const audio=getAudio();
  if(audio&&audio!==tap){tap=audio;wave=new Float32Array(tap.fftSize);spectrum=new Uint8Array(tap.frequencyBinCount);}
  let rms=0;bands.fill(0);
  if(active&&tap){
   tap.getFloatTimeDomainData(wave);tap.getByteFrequencyData(spectrum);
   for(let i=0;i<wave.length;i++)rms+=wave[i]*wave[i];rms=Math.sqrt(rms/wave.length);
   const min=2,max=Math.max(min+1,Math.min(spectrum.length,Math.floor(12000*tap.fftSize/tap.context.sampleRate)));
   for(let b=0;b<bands.length;b++){
    const start=Math.floor(min*(max/min)**(b/bands.length)),end=Math.max(start+1,Math.floor(min*(max/min)**((b+1)/bands.length)));
    let sum=0,count=0;for(let i=start;i<end&&i<spectrum.length;i++){sum+=spectrum[i]/255;count++;}bands[b]=sum/(count||1);
   }
  }
  const smoothing=1-Math.exp(-dt/.18);energy+=(unit(rms*5)-energy)*smoothing;
  for(let b=0;b<bands.length;b++)smoothBands[b]+=(bands[b]-smoothBands[b])*smoothing;
 }
 function measurements(){
  const m=metrics,context=m.context||{},music=m.music||{},availability=m.availability||{};
  const rate=finite(m.tradeRate),change=finite(music.changePct),liquidity=availability.liquidity===false?null:finite(m.observation?.liquidity);
  const cap=finite(context.latestCap),volume=finite(m.replay?m.replay.volume:m.decoded?m.observedVolume:m.observation?.volume),balance=availability.balance===false?null:finite(m.balance);
  const audience=m.audience||{},holders=finite(audience.holders),providerAt=finite(audience.countAt);
  const holderAge=finite(audience.age)??(providerAt==null?null:Math.max(0,Date.now()-providerAt));
  const holderState=['delayed','expired','age-unknown'].includes(audience.state)?audience.state.toUpperCase():'';
  const holderWeight=audience.state==='expired'?unit(audience.weight):audience.weight==null?1:unit(audience.weight);
  const holderDisplay=holders==null?'UNAVAILABLE':number(holders,0)+' · '+ageLabel(holderAge)+(holderState&&holderState!=='AGE-UNKNOWN'?' · '+holderState:'');
  return [
   {name:'PRICE / Δ 5M',value:change,display:change==null?'UNAVAILABLE':(change>=0?'+':'')+change.toFixed(3)+'%',level:unit(Math.abs(change||0)/20)},
   {name:'OBSERVED TRADES / S',value:m.decoded?rate:null,display:m.decoded?number(rate,3):m.replay?'OHLC · NO TRADE COUNTS':'SNAPSHOT · NO LIVE COUNT',level:m.decoded?unit(Math.log1p(rate||0)/Math.log(21)):unit(m.activity)},
   {name:m.replay?'CANDLE VOLUME / USD':m.decoded?'OBSERVED VOLUME / USD':'5 MIN SNAPSHOT VOLUME / USD',value:volume,display:number(volume),level:unit(m.volume)},
   {name:'BUY / SELL BALANCE',value:balance,display:balance==null?'UNAVAILABLE':Math.round(balance*100)+' / '+Math.round((1-balance)*100),level:balance==null?0:unit(Math.abs(balance-.5)*2)},
   {name:'LIQUIDITY / USD',value:liquidity,display:number(liquidity),level:liquidity>0?unit(Math.log10(liquidity)/8):0},
   {name:'MARKET CAP / USD',value:cap,display:number(cap),level:cap>0?unit((Math.log10(cap)-3)/6):0},
   {name:'HOLDERS / LAST OBSERVED',value:holders,display:holderDisplay,level:holders>0?unit(Math.log10(holders)/6)*holderWeight:0},
  ];
 }
 function draw(now){
  if(closed)return;animation=requestAnimationFrame(draw);
  if(document.hidden||!desktop.matches||!w||!h)return;
  const interval=reduced.matches?250:1000/24;if(now-last<interval)return;
  const dt=Math.min(.1,Math.max(.001,(now-last)/1000||.042));last=now;
  const external=getState(),audio=getAudio(),active=Boolean(external.playing&&options.playing!==false&&!options.seeking&&!options.ended&&audio?.context?.state==='running');
  sampleAudio(active,dt);
  const freshness=unit(metrics.fresh),movement=unit(metrics.music?.intensity),activity=unit(metrics.raw?.activity??metrics.activity);
  // High valuation alone cannot create a busy field. A stopped score is static.
  const motion=active?unit(metrics.dataSignals?.density??((movement*.65+activity*.2+energy*.15)*freshness)):0;
  const tempo=Math.max(10,Math.min(240,Number(metrics.music?.tempo)||40));
  if(active&&!reduced.matches){phase+=dt*(tempo/60)*(.15+motion*7.85);}
  const margin=Math.max(12,Math.min(28,w*.035)),left=margin,right=w-margin,width=right-left;
  const top=28,bottom=Math.max(top+210,h-60),height=bottom-top;
  const rows=measurements(),matrixTop=top+37,matrixHeight=height*.53,matrixBottom=matrixTop+matrixHeight;
  c.clearRect(0,0,w,h);c.textBaseline='alphabetic';
  text('MARKET / SIGNAL FIELD',left,top,'#111',9);text(metrics.replay?'HISTORICAL CANDLE SCORE':metrics.decoded?'OBSERVED CHAIN EVENTS':'MARKET SNAPSHOT',left,top+14,'#777',7);
  c.textAlign='right';text(active?'RUN '+String(Math.round(motion*100)).padStart(3,'0'):'HOLD',right,top,'#111',9);text('ID '+(seed>>>0).toString(16).toUpperCase().padStart(8,'0'),right,top+14,'#777',7);c.textAlign='left';
  const cols=Math.max(36,Math.min(96,Math.floor(width/5))),lines=Math.max(24,Math.min(48,Math.floor(matrixHeight/6))),cw=width/cols,ch=matrixHeight/lines;
  // Stable, seeded barcode columns translate in opposite directions at a
  // data-tempo rate. No fresh random field or whole-screen inversion per frame.
  c.fillStyle=active?'#111':'#e8e8e8';c.fillRect(left,matrixTop,width,matrixHeight);
  const rowGroup=lines/rows.length,idleThreshold=.88;
  c.save();c.beginPath();c.rect(left,matrixTop,width,matrixHeight);c.clip();
  for(let r=0;r<lines;r++){
   const group=Math.min(rows.length-1,Math.floor(r/rowGroup)),field=rows[group],scaled=field.value==null?0:Math.round(Math.abs(field.value)*1000)>>>0;
   const offset=active&&!reduced.matches&&field.value!=null?(phase*(group%2?1:-1))%cols:0;
   const threshold=active ? .9-motion*.62 : idleThreshold;
   for(let col=0;col<cols;col++){
    const byte=((scaled>>>((col%4)*8))&255),bit=(byte>>>(r%8))&1;
    const pick=hash(seed^(scaled>>>3),group*cols+col),spectral=smoothBands[col%72];
    const visible=field.value==null?hash(seed,r*cols+col)>.95:pick>threshold+(.5-field.level)*.1-bit*.14-spectral*.1;
    if(visible){
     const x=((col+offset)*cw%width+width)%width;
     c.fillStyle=active?'#fff':'#aaa';c.fillRect(left+x,matrixTop+r*ch,Math.max(1,cw-1),Math.max(1,ch-1));
     if(x+cw>width)c.fillRect(left+x-width,matrixTop+r*ch,Math.max(1,cw-1),Math.max(1,ch-1));
    }
   }
  }
  c.restore();
  // The white measurement lanes divide dense information without hiding values.
  for(let i=0;i<rows.length;i++){
   const y=matrixTop+i*matrixHeight/rows.length;
   c.fillStyle='#fff';c.fillRect(left,y,width,12);
   // Complementary horizontal bars encode the same measured row value.
   // They add coherent structure to the micro raster without a strobe.
   if(rows[i].value!=null){
    const bandY=y+13,half=width/2,bandWidth=Math.max(1,half*rows[i].level);
    c.fillStyle=active?'#fff':'#aaa';c.fillRect(left,bandY,bandWidth,2);
    c.fillStyle=active?'#111':'#e8e8e8';c.fillRect(left+half,bandY,half-bandWidth,2);
   }
   text(rows[i].name,left+4,y+8,'#444',6);c.textAlign='right';text(rows[i].display,right-4,y+8,'#111',7);c.textAlign='left';
  }
  if(active&&!reduced.matches){
   // A thin scan moves continuously; never invert the entire field.
   const scan=left+(phase*.07%1)*width;c.fillStyle='#fff';c.fillRect(Math.floor(scan),matrixTop,1,matrixHeight);
  }
  const spectralTop=matrixBottom+22,spectralHeight=Math.max(36,height*.17);
  text('AUDIBLE MIX / LOG SPECTRUM',left,spectralTop-6,'#555',7);
  const sw=width/smoothBands.length;
  for(let i=0;i<smoothBands.length;i++){
   const amplitude=active?smoothBands[i]:0,bar=Math.max(1,Math.round(amplitude*spectralHeight));
   c.fillStyle='#111';c.fillRect(left+i*sw,spectralTop+spectralHeight-bar,Math.max(1,sw-1),bar);
   // Silent frequency bins stay on one baseline rather than inventing a signal.
  }
  rule(left,spectralTop+spectralHeight,width,'#111');
  if(active&&lastPulse&&tap&&tap.context.currentTime-lastPulse.at<.18){
   // A small onset mark comes from the Pd patch itself, not chart events.
   const factors=[1,.5,2],midi=finite(metrics.dataSignals?.pitch)??69;
   const hz=440*2**((midi-69)/12)*(factors[lastPulse.voice]??1);
   const x=left+unit(Math.log(Math.max(40,hz)/40)/Math.log(12000/40))*width;
   c.fillStyle='#111';c.fillRect(Math.round(x),spectralTop-2,2,spectralHeight+2);
  }
  text('~40 HZ',left,spectralTop+spectralHeight+11,'#888',6);c.textAlign='right';text('12 KHZ',right,spectralTop+spectralHeight+11,'#888',6);c.textAlign='left';
  const tapeTop=spectralTop+spectralHeight+33,tapeHeight=Math.max(24,bottom-tapeTop-19);
  text('PRICE HISTORY / EVENT TAPE',left,tapeTop-6,'#555',7);
  const path=(metrics.context?.path||[]).filter(point=>Number(point.close)>0).slice(-120),prices=path.map(p=>Math.log(Number(p.close)));
  if(prices.length>1){
   const min=Math.min(...prices),max=Math.max(...prices),range=max-min;
   const step=width/prices.length;
   for(let i=0;i<prices.length;i++){
    const position=range>0?(prices[i]-min)/range:.5,size=range>0?Math.max(1,Math.abs(prices[i]-(prices[i-1]??prices[i]))/range*tapeHeight):1;
    c.fillStyle='#111';c.fillRect(left+i*step,tapeTop+(1-position)*(tapeHeight-2),Math.max(1,step-1),Math.min(tapeHeight,size+1));
   }
  }else{rule(left,tapeTop+tapeHeight/2,width,'#bbb');text('HISTORY PENDING',left+4,tapeTop+tapeHeight/2-5,'#888',7);}
  // Only received, deduplicated events leave marks. Historic candle data does
  // not pretend to contain trade-level chronology.
  const eventWidth=Math.max(2,width/96),recent=events.slice(-96);
  if(metrics.decoded&&!metrics.replay){
   for(let i=0;i<recent.length;i++){const e=recent[i],x=right-(recent.length-i)*eventWidth;const bar=3+unit(Math.log1p(e.volume)/Math.log(10001))*8;c.fillStyle=e.side==='sell'?'#777':'#111';c.fillRect(x,tapeTop+tapeHeight+4,Math.max(1,eventWidth-1),bar);}
  }
  const footY=Math.min(h-21,tapeTop+tapeHeight+25);
  text(active?'DENSITY '+Math.round(motion*100)+' / 100':'TRANSPORT HELD',left,footY,'#777',7);c.textAlign='right';text(metrics.replay?'TRADES / LIQUIDITY UNAVAILABLE':freshness>0?'FRESHNESS '+Math.round(freshness*100)+'%':'AWAITING FRESH DATA',right,footY,'#777',7);c.textAlign='left';
  canvas.dataset.active=String(active);canvas.dataset.energy=energy.toFixed(3);canvas.dataset.density=motion.toFixed(3);
 }
 animation=requestAnimationFrame(draw);
 return {
  frame(next={},settings={}){metrics=next;options=settings;const nextSeed=Number(settings.seed)>>>0;if(settings.seed!=null&&nextSeed!==seed){seed=nextSeed;phase=0;events=[];eventSerial=0;lastPulse=null;}},
  pulse(voice,at){lastPulse={voice:Number(voice)||0,at:Number(at)||0};},
  event(trade={}){if(trade.removed||trade.kind&&trade.kind!=='swap')return;const id=trade.id||trade.signature;if(id&&events.some(event=>event.id===id))return;events.push({id:id||++eventSerial,side:trade.side,volume:Math.max(0,Number(trade.usdVolume)||0)});if(events.length>256)events.shift();},
  close(){closed=true;cancelAnimationFrame(animation);observer.disconnect();},
 };
}
