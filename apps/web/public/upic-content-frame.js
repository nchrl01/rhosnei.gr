// Fit the screen to the marks without feeding the crop back into grid sizing.
// Canvas pixels keep their reference scale; only the surrounding frame changes.
const limit=(value,min,max)=>Math.max(min,Math.min(max,value));
function union(a,b){
 if(!a)return b;if(!b)return a;
 return {left:Math.min(a.left,b.left),top:Math.min(a.top,b.top),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)};
}
function square(bounds,reference,padding=12){
 const middle=reference/2;
 const b=bounds||{left:middle,top:middle,right:middle,bottom:middle};
 const side=Math.min(reference,Math.max(24,b.right-b.left+padding*2,b.bottom-b.top+padding*2));
 return {x:limit((b.left+b.right-side)/2,0,reference-side),y:limit((b.top+b.bottom-side)/2,0,reference-side),side};
}
export function createContentFrame(host){
 const element=document.createElement('div');element.className='visual-content-frame';host.append(element);
 host.dataset.contentAware='true';
 let view=null,last=0,reference=0;
 function write(name,value){const pixels=value.toFixed(3)+'px';if(element.style.getPropertyValue(name)!==pixels)element.style.setProperty(name,pixels);}
 return {
  element,
  fit({side,current,target,now,reduced=false,loading=false}){
   if(!(side>0))return;
   const desired=loading?{x:0,y:0,side}:square(union(current,target),side);
   if(view&&reference!==side){const scale=side/reference;view={x:view.x*scale,y:view.y*scale,side:view.side*scale};}
   const elapsed=last?Math.max(0,Math.min(.1,(now-last)/1000)):0;
   if(!view||reduced)view=desired;
   else{
    const amount=1-Math.exp(-elapsed/.1);
    for(const key of ['x','y','side'])view[key]+=(desired[key]-view[key])*amount;
    if(Math.max(...['x','y','side'].map(key=>Math.abs(view[key]-desired[key])))<.05)view=desired;
   }
   // Ease ahead of destination marks, but never clip the marks already drawn.
   // This also protects the first frame of newly arriving holder records.
   if(current){
    const visible={left:view.x,top:view.y,right:view.x+view.side,bottom:view.y+view.side};
    const guarded={left:current.left-2,top:current.top-2,right:current.right+2,bottom:current.bottom+2};
    view=square(union(visible,guarded),side,0);
   }
   reference=side;last=now;
   write('--visual-content-size',view.side);
   write('--visual-content-x',-view.x);write('--visual-content-y',-view.y);
  },
  reset(){view=null;last=0;reference=0;for(const name of ['--visual-content-size','--visual-content-x','--visual-content-y'])element.style.removeProperty(name);},
  snapshot(){return view?{x:view.x,y:view.y,side:view.side,referenceSide:reference}:null;},
  close(){element.remove();delete host.dataset.contentAware;host.style.removeProperty('--visual-reference-side');},
 };
}
