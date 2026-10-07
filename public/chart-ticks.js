// A price-history navigator with the expanding tick gesture from the reference.
// All heights and readouts come from the chart's actual loaded candles.
export function createChartTicks(chart){
 const row=document.getElementById('chart-tick-row');
 const position=document.getElementById('tick-position'),reading=document.getElementById('tick-reading');
 if(!row||!position||!reading)return {update(){}};
 let samples=[],elements=[],hover=null,selectedTime=null,dragging=false,pointerId=null,windowSize=100;
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 const money=n=>'$'+Number(n).toLocaleString('en',{maximumSignificantDigits:7});
 function selected(){
  if(selectedTime==null)return samples.length-1;
  let best=0;for(let i=1;i<samples.length;i++)if(Math.abs(samples[i].time-selectedTime)<Math.abs(samples[best].time-selectedTime))best=i;
  return best;
 }
 function paint(){
  if(!samples.length){position.textContent='LATEST FRAME';reading.textContent='Waiting for market history';row.setAttribute('aria-disabled','true');row.setAttribute('aria-valuenow','100');row.setAttribute('aria-valuetext','No market history');return;}
  const playback=selected(),index=hover??playback,bar=samples[index],percent=samples.length===1?100:Math.round(playback/(samples.length-1)*100);
  const latest=samples.at(-1).close,delta=(bar.close/latest-1)*100,date=new Date(bar.time).toLocaleString();
  position.textContent=percent+'% OF LOADED HISTORY';
  reading.textContent=date+' · '+money(bar.close)+(hover!=null?' · '+(delta>=0?'+':'')+delta.toFixed(2)+'% vs latest':'');
  row.setAttribute('aria-disabled','false');row.setAttribute('aria-valuenow',String(percent));row.setAttribute('aria-valuetext',new Date(samples[playback].time).toLocaleString()+', '+money(samples[playback].close));
  elements.forEach((el,i)=>{el.dataset.on=String(i<=playback);el.dataset.cursor=String(hover===i);});
 }
 function preview(index){hover=index;paint();}
 function pan(index){
  const bar=samples[index];if(!bar)return;selectedTime=bar.time;chart.manual=true;chart.needsFit=false;
  const logical=bar.index+(chart.origin&&chart.origin<samples[0].time?1:0);
  chart.chart.timeScale().setVisibleLogicalRange({from:logical-windowSize/2,to:logical+windowSize/2});
  chart.onHistorySeek?.(bar,dragging);paint();
 }
 function at(event){const bounds=row.getBoundingClientRect();return clamp(Math.floor((event.clientX-bounds.left)/Math.max(1,bounds.width)*samples.length),0,samples.length-1);}
 row.addEventListener('pointerdown',event=>{
  if(!samples.length||event.button!==0||dragging)return;event.preventDefault();dragging=true;pointerId=event.pointerId;row.setPointerCapture(pointerId);row.focus({preventScroll:true});
  const range=chart.chart.timeScale().getVisibleLogicalRange();windowSize=range?Math.max(10,range.to-range.from):100;
  const index=at(event);preview(index);pan(index);
 });
 row.addEventListener('pointermove',event=>{if(!samples.length||dragging&&event.pointerId!==pointerId||event.pointerType!=='mouse'&&!dragging)return;const index=at(event);preview(index);if(dragging)pan(index);});
 const finish=event=>{
  if(dragging&&event?.pointerId!=null&&event.pointerId!==pointerId)return;
  const wasDragging=dragging,id=pointerId;dragging=false;pointerId=null;
  if(id!=null&&row.hasPointerCapture(id))row.releasePointerCapture(id);
  const bounds=row.getBoundingClientRect(),inside=event?.type==='pointerup'&&event.pointerType==='mouse'&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
  if(!inside)hover=null;paint();if(wasDragging)chart.onHistorySeekEnd?.();
 };
 row.addEventListener('pointerup',finish);row.addEventListener('pointercancel',finish);
 row.addEventListener('lostpointercapture',event=>{if(dragging)finish(event);});
 row.addEventListener('pointerleave',()=>{if(!dragging)finish();});
 row.addEventListener('keydown',event=>{
  if(!samples.length||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
  const index=event.key==='Home'?0:event.key==='End'?samples.length-1:clamp(selected()+(event.key==='ArrowRight'?1:-1),0,samples.length-1);
  const range=chart.chart.timeScale().getVisibleLogicalRange();windowSize=range?Math.max(10,range.to-range.from):100;
  preview(index);pan(index);
 });
 row.addEventListener('blur',finish);
 return {setReplayTime(time){selectedTime=time;paint();},live(){selectedTime=null;hover=null;paint();},update(bars){
  const count=Math.min(34,bars.length),next=[];
  for(let i=0;i<count;i++){const index=count===1?bars.length-1:Math.round(i/(count-1)*(bars.length-1));next.push({...bars[index],index});}
  samples=next;if(hover!=null)hover=clamp(hover,0,Math.max(0,count-1));
  if(elements.length!==count){elements=Array.from({length:count},()=>{const el=document.createElement('span');el.className='chart-tick';el.setAttribute('aria-hidden','true');return el;});row.replaceChildren(...elements);}
  const prices=samples.map(bar=>chart.scale==='log'?Math.log(bar.close):bar.close),low=Math.min(...prices),high=Math.max(...prices);
  elements.forEach((el,i)=>el.style.setProperty('--tick-height',(high===low?52:38+28*(prices[i]-low)/(high-low))+'%'));
  if(!bars.length)selectedTime=null;paint();
 }};
}
