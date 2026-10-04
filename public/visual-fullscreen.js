// Expand the existing renderer, keeping its audio clock and GPU/canvas alive.
export function createVisualFullscreen(host){
 const button=document.createElement('button');button.type='button';button.className='visual-fullscreen';host.append(button);
 function icon(expanded){
  const label=expanded?'Collapse visualization':'Expand visualization';
  button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false"><path d="${expanded?'M5 5l14 14M11 19h8v-8':'M19 19 5 5M5 13V5h8'}"/></svg>`;
  button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-expanded',String(expanded));
 }
 icon(false);
 const header=document.querySelector('.market-header'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let expanded=false,busy=false,placeholder=null,animation=null,savedInert=[],chartPlaceholder=null,volumePlaceholder=null;
 const chart=document.querySelector('.chart-panel'),play=document.querySelector('#play');
 const volumeWidget=document.querySelector('.volume-widget'),volumeButton=document.querySelector('#volume-button');
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
 function fullscreenVolume(){
  if(!volumeWidget||volumeWidget.closest('.header-links'))return;
  if(expanded&&!volumePlaceholder){
   if(volumeButton?.getAttribute('aria-expanded')==='true')volumeButton.click();
   volumePlaceholder=document.createElement('span');volumeWidget.before(volumePlaceholder);
   document.body.append(volumeWidget);volumeWidget.classList.add('visual-volume-control');
  }
  if(!expanded&&volumePlaceholder){
   if(volumeButton?.getAttribute('aria-expanded')==='true')volumeButton.click();
   volumePlaceholder.replaceWith(volumeWidget);volumePlaceholder=null;volumeWidget.classList.remove('visual-volume-control');
   volumeWidget.style.removeProperty('--visual-full-top');
  }
 }
 function top(){
  mobileChart();fullscreenVolume();
  const offset=Math.max(0,header?.getBoundingClientRect().bottom||0)+'px';
  host.style.setProperty('--visual-full-top',offset);
  if(expanded)volumeWidget?.style.setProperty('--visual-full-top',offset);
 }
 function motion(from,to){
  if(reduced.matches)return Promise.resolve();
  // Animate layout dimensions so the renderer redraws its square lattice at
  // each size. Scaling a finished canvas would stretch the pixels.
  return new Promise(resolve=>{
   const started=performance.now();let cancelled=false;
   animation={cancel(){cancelled=true;}};
   function frame(now){
    const progress=Math.min(1,(now-started)/440),eased=1-Math.pow(1-progress,3);
    for(const key of ['left','top','width','height'])host.style.setProperty(key,(from[key]+(to[key]-from[key])*eased)+'px','important');
    window.dispatchEvent(new Event('resize'));
    if(progress<1&&!cancelled)requestAnimationFrame(frame);
    else {for(const key of ['left','top','width','height'])host.style.removeProperty(key);animation=null;resolve();}
   }
   frame(started);
  });
 }
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
   await motion(from,host.getBoundingClientRect());
  }else{
   const from=host.getBoundingClientRect(),to=placeholder.getBoundingClientRect();
   await motion(from,to);
   placeholder.replaceWith(host);placeholder=null;host.classList.remove('is-expanded');document.body.classList.remove('visual-expanded');expanded=false;mobileChart();fullscreenVolume();window.dispatchEvent(new Event('resize'));
   for(const [node,value] of savedInert)node.inert=value;savedInert=[];
   icon(false);
  }
  busy=false;button.focus({preventScroll:true});
 }
 function escape(event){if(event.key==='Escape'&&expanded&&!event.defaultPrevented){event.preventDefault();void toggle();}}
 button.addEventListener('click',toggle);document.addEventListener('keydown',escape);window.addEventListener('resize',top);
 const observer=new ResizeObserver(()=>{if(expanded)top();});if(header)observer.observe(header);
 return {close(){expanded=false;mobileChart();fullscreenVolume();mini.remove();playObserver.disconnect();animation?.cancel();if(placeholder)placeholder.replaceWith(host);host.classList.remove('is-expanded');document.body.classList.remove('visual-expanded');for(const [node,value] of savedInert)node.inert=value;observer.disconnect();document.removeEventListener('keydown',escape);window.removeEventListener('resize',top);button.remove();}};
}
