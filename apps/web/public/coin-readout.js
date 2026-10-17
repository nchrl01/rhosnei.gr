export function rollingText(node){
 let previous='',numeric=null,cells=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 return (value,number)=>{
  const next=String(value),direction=numeric==null||number>=numeric?-1:1;
  if(previous===next)return;
  node.setAttribute('aria-label',next);
  if(cells.length!==next.length){cells=[...next].map(()=>{const cell=document.createElement('span');cell.className='rolling-cell';cell.setAttribute('aria-hidden','true');const digit=document.createElement('span');cell.append(digit);return cell;});node.replaceChildren(...cells);}
  [...next].forEach((char,i)=>{const digit=cells[i].firstChild;if(digit.textContent===char)return;digit.getAnimations().forEach(a=>a.cancel());digit.textContent=char;if(previous&&!reduced.matches&&/\d/.test(char))digit.animate([{transform:`translateY(${direction*100}%)`,opacity:.25},{transform:'translateY(0)',opacity:1}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});});
  previous=next;numeric=number;
 };
}
