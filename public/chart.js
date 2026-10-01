// Historical provider candles and separately labelled live observations.
export class MarketChart{
 constructor(canvas){this.canvas=canvas;this.points=[];this.history=[];this.mode='ticks';this.range='history';this.interval=86400000;this.origin=null;this.frame=null;this.observer=new ResizeObserver(()=>this.schedule());this.observer.observe(canvas);}
 setMode(mode){this.mode=mode;this.schedule();}
 setRange(range){this.range=range;this.schedule();}
 setHistory(candles,interval,origin){this.history=candles;this.interval=interval;this.origin=origin;this.schedule();}
 schedule(){if(this.frame!==null)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
 reset(){this.points=[];this.history=[];this.origin=null;this.schedule();}
 add(point){if(!(point.price>0)||!Number.isFinite(point.price))return;this.points.push(point);if(this.points.length>3600)this.points.shift();this.schedule();}
 remove(id){this.points=this.points.filter(p=>p.id!==id);this.schedule();}
 draw(){
  const canvas=this.canvas,rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(rect.width===0)return;
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const c=canvas.getContext('2d');c.scale(dpr,dpr);const w=rect.width,h=rect.height,L=8,R=100,T=20,B=32;
  c.clearRect(0,0,w,h);c.font='10px monospace';c.fillStyle='#929987';
  const historical=this.range==='history',points=historical?this.points:this.points.slice(-1200),candles=new Map();
  if(historical)for(const bar of this.history)candles.set(bar.time,{...bar,historical:true});
  const interval=historical&&this.history.length?this.interval:10000;
  for(const p of points){const time=Math.floor(p.at/interval)*interval;let bar=candles.get(time);if(!bar){bar={time,open:p.price,high:p.price,low:p.price,close:p.price};candles.set(time,bar);}bar.high=Math.max(bar.high,p.price);bar.low=Math.min(bar.low,p.price);bar.close=p.price;}
  const all=[...candles.values()].sort((a,b)=>a.time-b.time),bars=historical?all:all.slice(-100);
  if(!bars.length){c.fillText('Loading price context…',L,40);return;}
  const values=bars.flatMap(b=>[b.low,b.high]);let lo=Math.min(...values),hi=Math.max(...values);const margin=(hi-lo)*.15||hi*.002||.01;lo-=margin;hi+=margin;
  const minTime=historical&&this.origin?Math.min(this.origin,bars[0].time):bars[0].time;
  const latestTime=Math.max(bars.at(-1).time,points.at(-1)?.at||0),maxTime=Math.max(minTime+100000,latestTime+interval*.2);
  const y=v=>T+(hi-v)/(hi-lo)*(h-T-B),x=t=>L+(t-minTime)/(maxTime-minTime)*(w-L-R);
  c.strokeStyle='#343a30';c.lineWidth=1;for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3,py=y(v);c.beginPath();c.moveTo(L,py);c.lineTo(w-R,py);c.stroke();c.fillStyle='#929987';c.fillText('$'+v.toPrecision(5),w-R+10,py+4);}
  const width=Math.max(1,Math.min(9,(w-L-R)*interval/(maxTime-minTime)*.65));
  if(this.mode==='candles'){
   for(const bar of bars){const px=x(bar.time);c.strokeStyle=c.fillStyle=bar.close>=bar.open?'#d4ed98':'#c79b94';c.beginPath();c.moveTo(px,y(bar.high));c.lineTo(px,y(bar.low));c.stroke();c.fillRect(px-width/2,Math.min(y(bar.open),y(bar.close)),width,Math.max(1,Math.abs(y(bar.open)-y(bar.close))));}
  }else{
   c.strokeStyle='#839868';c.lineWidth=1.3;c.beginPath();let previous=null;
   if(historical)for(const bar of this.history){const px=x(bar.time),py=y(bar.close);if(!previous||bar.time-previous>interval*1.5)c.moveTo(px,py);else c.lineTo(px,py);previous=bar.time;}c.stroke();
   c.strokeStyle='#d4ed98';c.lineWidth=1.5;c.beginPath();points.filter(p=>p.at>=minTime).forEach((p,i)=>{if(i===0)c.moveTo(x(p.at),y(p.price));else c.lineTo(x(p.at),y(p.price));});c.stroke();
  }
  const last=points.at(-1)||{price:bars.at(-1).close,at:bars.at(-1).time};c.fillStyle='#d4ed98';c.beginPath();c.arc(x(last.at),y(last.price),3,0,Math.PI*2);c.fill();
  c.fillStyle='#929987';const label=t=>historical?new Date(t).toLocaleDateString():new Date(t).toLocaleTimeString();c.fillText(label(minTime),L,h-8);c.fillText(label(latestTime),Math.max(L,w-R-85),h-8);
 }
}
