// A finite visual interruption driven by received observations, never a timer
// pretending to be a market event. Two slow pulses; reduced motion is static.
export function createMarketAnnouncement(host){
 const panel=document.createElement('div');panel.className='market-announcement';panel.hidden=true;panel.setAttribute('aria-hidden','true');
 const canvas=document.createElement('canvas'),title=document.createElement('strong'),detail=document.createElement('span');
 panel.append(canvas,title,detail);host.append(panel);
 const context=canvas.getContext('2d');let started=-Infinity,lastStart=-Infinity;
 const matrix=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 function clear(){panel.hidden=true;started=-Infinity;host.dataset.announcement='false';}
 return {
  show(headline,value=''){
   const now=performance.now();
   if(panel.hidden&&now-lastStart<1800)return;
   if(panel.hidden){started=now;lastStart=now;}
   title.textContent=String(headline);detail.textContent=String(value);panel.hidden=false;host.dataset.announcement='true';
  },
  render(now,{width,height,reducedMotion=false}){
   if(panel.hidden)return;const age=now-started;if(age>=900){clear();return;}
   const w=Math.max(1,Math.min(240,Math.round(width/3))),h=Math.max(1,Math.round(height*w/Math.max(1,width)));
   if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
   if(!context)return;
   const pulse=reducedMotion?.2:age<140||age>=450&&age<590?.7:.12;
   const pixels=context.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const radius=Math.hypot((x/w-.5)*1.4,(y/h-.5)*1.4);
    const glow=pulse*Math.max(0,1-radius),white=glow>(matrix[(y%4)*4+x%4]+.5)/16;
    const i=(y*w+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=white?105:0;pixels.data[i+3]=255;
   }
   context.putImageData(pixels,0,0);
  },clear,close(){clear();panel.remove();}
 };
}
