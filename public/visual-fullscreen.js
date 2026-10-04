// Expand the existing renderer, keeping its audio clock and GPU/canvas alive.
export function createVisualFullscreen(host){
 const button=document.createElement('button');button.type='button';button.className='visual-fullscreen';host.append(button);
 function icon(expanded){
  const label=expanded?'Collapse visualization':'Expand visualization';
  button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false"><path d="${expanded?'M8 3v5H3m13-5v5h5M3 16h5v5m13-5h-5v5':'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'}"/></svg>`;
  button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-expanded',String(expanded));
 }
 icon(false);
 const header=document.querySelector('.market-header'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let expanded=false,busy=false,placeholder=null,animation=null,savedInert=[],chartPlaceholder=null;
 const chart=document.querySelector('.chart-panel'),play=document.querySelector('#play');
 const mini=document.createElement('button');mini.type='button';mini.className='visual-mini-play';mini.hidden=true;host.append(mini);
 const sync=()=>{mini.textContent=play?.getAttribute('aria-label')||play?.textContent||'Listen';mini.disabled=!!play?.disabled;};
 mini.addEventListener('click',()=>{play?.click();sync();});
 const playObserver=new MutationObserver(sync);if(play)playObserver.observe(play,{attributes:true,childList:true,subtree:true});sync();
 function mobileChart(){
  const mobile=matchMedia('(max-width:760px)').matches;
  if(expanded&&mobile&&chart&&!chartPlaceholder){chartPlaceholder=document.createElement('div');chart.before(chartPlaceholder);host.append(chart);}
  if((!expanded||!mobile)&&chartPlaceholder){chartPlaceholder.replaceWith(chart);chartPlaceholder=null;}
  mini.hidden=!(expanded&&mobile);
 }
 function top(){mobileChart();host.style.setProperty('--visual-full-top',Math.max(0,header?.getBoundingClientRect().bottom||0)+'px');}
 function motion(from,to){
  if(reduced.matches)return Promise.resolve();
  animation=host.animate([{transform:from},{transform:to}],{duration:440,easing:'cubic-bezier(.22,.8,.25,1)',fill:'none'});
  return animation.finished.catch(()=>{});
 }
 function transform(from,to){return `translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/Math.max(1,to.width)},${from.height/Math.max(1,to.height)})`;}
 async function toggle(){
  if(busy)return;busy=true;
  if(!expanded){
   const from=host.getBoundingClientRect();
   placeholder=document.createElement('div');placeholder.className='visual-placeholder';
   const computed=getComputedStyle(host);
   Object.assign(placeholder.style,{width:from.width+'px',height:from.height+'px',margin:computed.margin,gridColumn:computed.gridColumn,gridRow:computed.gridRow,alignSelf:'start'});
   host.before(placeholder);document.body.append(host);expanded=true;
   document.body.classList.add('visual-expanded');host.classList.add('is-expanded');top();
   savedInert=[...document.querySelector('main').children].filter(node=>node!==header).map(node=>[node,node.inert]);
   for(const [node] of savedInert)node.inert=true;
   icon(true);
   await motion(transform(from,host.getBoundingClientRect()),'none');
  }else{
   const from=host.getBoundingClientRect(),to=placeholder.getBoundingClientRect();
   await motion('none',transform(to,from));
   placeholder.replaceWith(host);placeholder=null;host.classList.remove('is-expanded');document.body.classList.remove('visual-expanded');expanded=false;mobileChart();window.dispatchEvent(new Event('resize'));
   for(const [node,value] of savedInert)node.inert=value;savedInert=[];
   icon(false);
  }
  busy=false;button.focus({preventScroll:true});
 }
 function escape(event){if(event.key==='Escape'&&expanded){event.preventDefault();void toggle();}}
 button.addEventListener('click',toggle);document.addEventListener('keydown',escape);window.addEventListener('resize',top);
 const observer=new ResizeObserver(()=>{if(expanded)top();});if(header)observer.observe(header);
 return {close(){expanded=false;mobileChart();mini.remove();playObserver.disconnect();animation?.cancel();if(placeholder)placeholder.replaceWith(host);host.classList.remove('is-expanded');document.body.classList.remove('visual-expanded');for(const [node,value] of savedInert)node.inert=value;observer.disconnect();document.removeEventListener('keydown',escape);window.removeEventListener('resize',top);button.remove();}};
}
