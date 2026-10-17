const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function knob(parent,spec,get,set,{auto,manual=()=>false,onChange=()=>{},paints=[]}={}){
 const [key,label,min,max,step,,log]=spec;const card=document.createElement('div');card.className='control';
 const caption=document.createElement('label');caption.className='label';caption.textContent=label;
 const dial=document.createElement('div');dial.className='dial';dial.tabIndex=0;dial.setAttribute('role','slider');dial.setAttribute('aria-label',label);dial.setAttribute('aria-valuemin',min);dial.setAttribute('aria-valuemax',max);
 const number=document.createElement('input');number.type='number';number.className='value';number.min=min;number.max=max;number.step=step;number.setAttribute('aria-label',label+' value');
 const norm=v=>log?Math.log(v/min)/Math.log(max/min):(v-min)/(max-min);
 const value=t=>log?min*(max/min)**t:min+t*(max-min);
 function change(v){if(!Number.isFinite(v))return;v=clamp(Math.round(v/step)*step,min,max);set(v);onChange();paint();}
 function paint(){const v=get(),t=clamp(norm(v),0,1);dial.style.setProperty('--arc',t*270+'deg');dial.style.setProperty('--angle',-135+t*270+'deg');dial.setAttribute('aria-valuenow',v);if(document.activeElement!==number)number.value=Number(v.toFixed(4));if(autoButton){autoButton.textContent=manual()?'MANUAL · AUTO ↺':'AUTO';autoButton.classList.toggle('manual',manual());}}
 let drag=null;dial.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={y:e.clientY,x:e.clientX,t:norm(get())};dial.setPointerCapture(e.pointerId);dial.focus();});
 dial.addEventListener('pointermove',e=>{if(drag)change(value(clamp(drag.t+(drag.y-e.clientY+e.clientX-drag.x)/(e.shiftKey?1000:220),0,1)));});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(name,()=>{drag=null;});
 dial.addEventListener('keydown',e=>{const delta=({ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1,PageUp:10,PageDown:-10})[e.key];if(delta){e.preventDefault();change(log?value(clamp(norm(get())+delta*.01,0,1)):get()+delta*step);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();change(e.key==='Home'?min:max);}});
 number.addEventListener('change',()=>{change(number.valueAsNumber);if(!Number.isFinite(number.valueAsNumber))number.value=get();});
 card.append(caption,dial,number);let autoButton=null;
 if(auto){autoButton=document.createElement('button');autoButton.className='auto';autoButton.onclick=()=>{auto();onChange();paint();};card.append(autoButton);dial.ondblclick=()=>autoButton.click();}
 parent.append(card);paints.push(paint);paint();
}
