// Independently implemented chart/path visualization, inspired by SonicSketch.
// Market geometry, clock progress and measured audio remain separate inputs.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function marketPath(bars,range,scale='linear'){
 const sorted=bars.filter(b=>b.close>0&&Number.isFinite(b.close)).sort((a,b)=>a.time-b.time);
 const visible=range&&Number.isFinite(range.from)&&Number.isFinite(range.to)?sorted.filter(b=>b.time>=range.from*1000&&b.time<=range.to*1000):sorted.slice(-100);
 const sample=visible.length>400?visible.filter((_,i)=>i===visible.length-1||i%Math.ceil(visible.length/400)===0):visible;
 if(!sample.length)return [];
 const logs=sample.map(b=>scale==='log'?Math.log(b.close):b.close),low=Math.min(...logs),high=Math.max(...logs),spread=high-low;
 const first=sample[0].time,last=sample.at(-1).time;
 return sample.map((b,i)=>({x:last===first?.5:(b.time-first)/(last-first),y:spread===0?.5:1-(logs[i]-low)/spread,time:b.time,price:b.close,volume:Math.max(0,Number(b.volume)||0)}));
}
export function pathAt(path,x){
 if(!path.length)return {x:clamp(x),y:.5};
 const next=path.findIndex(p=>p.x>=x);
 if(next<=0)return {...path[next<0?path.length-1:0]};
 const a=path[next-1],b=path[next],t=clamp((x-a.x)/Math.max(1e-9,b.x-a.x));
 return {x,y:a.y+(b.y-a.y)*t};
}
export function createMarketSketch(container,chart){
 container.innerHTML=`<div class="sketch-heading"><span>LATEST MARKET / SONIC SKETCH</span><span data-sketch-state>MARKET ONLY · SOUND PAUSED</span></div><canvas aria-label="Dynamic market path with real sound activity and measured audio spectrum" role="img"></canvas><div class="sketch-readings"><span data-sketch-path>No price path yet</span><span data-sketch-audio>Audio awaiting playback</span></div><p>Latest market state → gesture · actual sound → traces and spectrum. This drawing does not sequence notes or replay historical candles.</p>`;
 const canvas=container.querySelector('canvas'),ctx=canvas.getContext('2d');
 const stateText=container.querySelector('[data-sketch-state]'),pathText=container.querySelector('[data-sketch-path]'),audioText=container.querySelector('[data-sketch-audio]');
 let width=640,height=320,analyser=null,spectrum=null,wave=null,playing=false,native=false,clock=0,metrics={},voices=[],lastTrade=0,tradeAt=-Infinity,lastDraw=0,path=[],pathVersion='',audioDb=-100,disposed=false;
 const groups={'av-envion-voice':['gestures',8],'av-tone-voice':['tones',32],'av-poly-voice':['poly',12],'av-perc-voice':['percussion',32]};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const resize=new ResizeObserver(entries=>{width=Math.max(240,entries[0].contentRect.width);height=width<500?270:340;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);});resize.observe(canvas);
 function update(input){playing=input.playing;native=input.native;metrics=input.m;stateText.textContent=playing?(native?'PD CLOCK + NATIVE METERS':'PD CLOCK + MEASURED AUDIO'):'MARKET ONLY · SOUND PAUSED';}
 function receive(name,value){
  if(!playing||!Number.isFinite(value))return;
  if(name==='generation')clock=value;
  if(name==='av-output-left'||name==='av-output-right')audioDb=value;
  if(groups[name]&&!native){const [kind,count]=groups[name];voices.push({kind,index:value,count,clock,born:performance.now()});if(voices.length>160)voices.shift();}
 }
 function reset(){voices=[];clock=0;lastTrade=chart.received;tradeAt=-Infinity;pathVersion='';audioDb=-100;}
 function attachAudio(node){analyser=node;if(node){spectrum=new Uint8Array(node.frequencyBinCount);wave=new Float32Array(node.fftSize);}else{spectrum=null;wave=null;}}
 function paint(now){
  if(disposed)return;requestAnimationFrame(paint);
  if(document.hidden||now-lastDraw<(reduced.matches?100:33))return;lastDraw=now;
  const livePath=metrics.context?.path||[],version=`${livePath.length}/${livePath.at(-1)?.time}/${livePath.at(-1)?.close}/${metrics.context?.baseline}/${chart.scale}`;
  if(version!==pathVersion){pathVersion=version;path=marketPath(livePath,null,chart.scale);pathText.textContent=path.length?`${path.length} context marks · latest received frame · ${new Date(path.at(-1).time).toLocaleTimeString()}`:'Waiting for latest market state';}
  if(chart.received!==lastTrade){lastTrade=chart.received;tradeAt=now;}
  const margin=22,top=28,bottom=height*.62,plotHeight=bottom-top,plotWidth=width-2*margin;
  const xy=p=>[margin+p.x*plotWidth,top+p.y*plotHeight];
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#e9e9e9';ctx.lineWidth=1;
  for(let i=0;i<4;i++){const y=top+i*plotHeight/3;ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke();}
  ctx.font='9px monospace';ctx.fillStyle='#777';ctx.fillText((chart.scale==='log'?'LOG':'LINEAR')+' PRICE / FIXED MARKET CONTEXT',margin,14);
  if(path.length){
   const maxVolume=Math.max(1,...path.map(p=>p.volume));ctx.strokeStyle='#bbb';
   for(const p of path){if(!p.volume)continue;const [x,y]=xy(p);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+Math.log1p(p.volume)/Math.log1p(maxVolume)*18);ctx.stroke();}
   ctx.strokeStyle='#111';ctx.lineWidth=1.5;ctx.beginPath();path.forEach((p,i)=>{const [x,y]=xy(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
   if(path.length===1){const [x,y]=xy(path[0]);ctx.beginPath();ctx.arc(x,y,2,0,2*Math.PI);ctx.fill();}
   const [tx,ty]=xy(path.at(-1)),age=(now-tradeAt)/1000;
   if(age<1.5&&!reduced.matches){ctx.strokeStyle=`rgba(0,0,0,${(1-age/1.5)*.5})`;ctx.beginPath();ctx.arc(tx,ty,3+age*14*(.3+(metrics.volume||0)),0,2*Math.PI);ctx.stroke();}

  }
  voices=voices.filter(v=>now-v.born<2200);
  if(playing&&path.length)for(const v of voices){
   const age=(now-v.born)/2200,p=path.at(-1),[x,y]=xy(p),offset=(v.index/Math.max(1,v.count-1)-.5)*50;
   ctx.strokeStyle=`rgba(0,0,0,${(1-age)*.65})`;ctx.lineWidth=1;
   ctx.beginPath();
   if(v.kind==='percussion'){const size=2+(1-age)*6;ctx.moveTo(x-size,y+offset);ctx.lineTo(x,y+offset-size);ctx.lineTo(x+size,y+offset);ctx.lineTo(x,y+offset+size);ctx.closePath();}
   else{ctx.moveTo(x,y);ctx.quadraticCurveTo(x+8+age*16,y+offset,x+18+age*28,y+offset*(1-age*.4));}
   ctx.stroke();
  }
  const base=height-24,spectrumHeight=height-bottom-42;ctx.fillStyle='#777';ctx.fillText('MEASURED AUDIO / FREQUENCY →',margin,bottom+20);
  if(playing&&analyser){
   analyser.getByteFrequencyData(spectrum);analyser.getFloatTimeDomainData(wave);
   let square=0;for(const v of wave)square+=v*v;
   const rms=Math.sqrt(square/wave.length),db=20*Math.log10(Math.max(1e-5,rms));
   audioText.textContent=`${db.toFixed(1)} dBFS RMS · browser output`;
   ctx.fillStyle='#222';const count=96,maxHz=Math.min(16000,analyser.context.sampleRate/2);
   for(let i=0;i<count;i++){const lo=40*Math.pow(maxHz/40,i/count),hi=40*Math.pow(maxHz/40,(i+1)/count),binHz=analyser.context.sampleRate/analyser.fftSize;let peak=0;for(let b=Math.max(0,Math.floor(lo/binHz));b<=Math.min(spectrum.length-1,Math.ceil(hi/binHz));b++)peak=Math.max(peak,spectrum[b]);const h=peak/255*spectrumHeight;ctx.fillRect(margin+i/count*plotWidth,base-h,Math.max(1,plotWidth/count-1),h);}
   // Actual waveform, centered underneath the price path.
   ctx.strokeStyle='#999';ctx.lineWidth=.8;ctx.beginPath();for(let i=0;i<160;i++){const x=margin+i/159*plotWidth,y=bottom+32+wave[Math.floor(i/160*wave.length)]*20;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  }else{audioText.textContent=playing&&native?`${audioDb.toFixed(1)} dBFS · native Pd meter (no browser spectrum)`:'Sound paused · price path remains live';ctx.strokeStyle='#ddd';ctx.beginPath();ctx.moveTo(margin,base);ctx.lineTo(width-margin,base);ctx.stroke();}
 }
 requestAnimationFrame(paint);
 return {update,receive,reset,attachAudio,destroy(){disposed=true;resize.disconnect();attachAudio(null);}};
}
