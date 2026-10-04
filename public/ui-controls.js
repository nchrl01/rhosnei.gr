// Small bridge between the existing player and independently mounted React UI.
// Loading the presentation bundle never delays market or audio initialization.
export function createUIControls(){
 const $=id=>document.getElementById(id),states=new Map(),loaders=new Map(),timers=new Map();
 const input=$('master'),panel=$('volume-panel'),time=$('coin-time');
 let components,volume,clock,lastClock=null,sequence=0;
 const dial=document.createElement('div');dial.id='volume-dial';dial.hidden=true;input.before(dial);
 const volumeButton=$('volume-button'),mobile=matchMedia('(max-width:760px)');
 let volumeOpen=false;
 function positionVolumePanel(){
  if(!volumeOpen)return;
  const edge=12,gap=8,button=volumeButton.getBoundingClientRect();
  const viewport=window.visualViewport,width=viewport?.width||window.innerWidth,height=viewport?.height||window.innerHeight;
  panel.style.maxWidth=Math.max(0,width-edge*2)+'px';panel.style.maxHeight=Math.max(0,height-edge*2)+'px';
  const popup=panel.getBoundingClientRect();
  const leftEdge=(viewport?.offsetLeft||0)+edge,topEdge=(viewport?.offsetTop||0)+edge;
  const rightEdge=leftEdge+width-edge*2,bottomEdge=topEdge+height-edge*2;
  const left=Math.max(leftEdge,Math.min(button.right-popup.width,rightEdge-popup.width));
  const below=button.bottom+gap,above=button.top-popup.height-gap;
  const top=Math.max(topEdge,Math.min(below+popup.height<=bottomEdge?below:above,bottomEdge-popup.height));
  panel.style.left=left+'px';panel.style.top=top+'px';
 }
 function setVolumeOpen(open,focus=false){
  volumeOpen=Boolean(open);panel.hidden=mobile.matches&&!volumeOpen;
  volumeButton.hidden=!mobile.matches;volumeButton.setAttribute('aria-expanded',String(volumeOpen));
  volume?.setOpen(mobile.matches?volumeOpen:true);
  if(mobile.matches&&volumeOpen)positionVolumePanel();
  if(mobile.matches&&volumeOpen)requestAnimationFrame(()=>{if(!volumeOpen)return;positionVolumePanel();if(focus&&!volume?.focus())input.focus({preventScroll:true});});
 }
 function volumeLabel(){
  const amount=Math.round(Number(input.value)*100);
  volumeButton.setAttribute('aria-label','Volume '+amount+'%');volumeButton.dataset.muted=String(amount===0);
 }
 volumeButton.addEventListener('click',()=>setVolumeOpen(!volumeOpen,true));
 document.addEventListener('pointerdown',event=>{if(volumeOpen&&!volumeButton.parentElement.contains(event.target))setVolumeOpen(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&volumeOpen){event.preventDefault();setVolumeOpen(false);volumeButton.focus({preventScroll:true});}});
 volumeButton.parentElement.addEventListener('focusout',event=>{if(volumeOpen&&event.relatedTarget&&!volumeButton.parentElement.contains(event.relatedTarget))setVolumeOpen(false);});
 mobile.addEventListener('change',()=>setVolumeOpen(false));
 window.addEventListener('resize',()=>requestAnimationFrame(positionVolumePanel));
 document.addEventListener('scroll',positionVolumePanel,true);
 window.visualViewport?.addEventListener('resize',positionVolumePanel);
 window.visualViewport?.addEventListener('scroll',positionVolumePanel);
 input.addEventListener('input',volumeLabel);setVolumeOpen(false);volumeLabel();
 const clockFallback=document.createElement('span'),clockHost=document.createElement('span');
 clockFallback.className='clock-fallback';clockHost.className='clock-island';time.replaceChildren(clockFallback,clockHost);
 function hostFor(name){return $(name+'-loader');}
 function installLoader(name,host){
  if(!components||!host||host.dataset.failed==='true'||loaders.has(name))return;
  try{
   const widget=components.mountLoader(host);loaders.set(name,widget);host.dataset.uiReady='true';
   host.addEventListener('ui-component-error',()=>{host.dataset.uiReady='false';host.hidden=true;loaders.delete(name);});
   widget.update(states.get(name)||null);
  }catch{host.dataset.uiReady='false';host.hidden=true;}
 }
 function loading(name,status,label='',{restart=false,host=null,operation=null,startedAt=null,endedAt=null}={}){
  const now=performance.now(),old=states.get(name);
  clearTimeout(timers.get(name));
  if(!['working','done','error'].includes(status)){
   states.set(name,null);const element=host||hostFor(name);if(element)element.dataset.loadState='';loaders.get(name)?.update(null);return;
  }
  const fresh=!old||operation!==null&&old.externalOperation!==operation||status==='working'&&(restart||old.status!=='working');
  const start=Number.isFinite(startedAt)?startedAt:fresh?now:old?.startedAt??now;
  const end=status==='working'?null:Number.isFinite(endedAt)?endedAt:fresh?now:old?.endedAt??now;
  const state={status,label,startedAt:start,endedAt:end,operation:fresh?String(++sequence):old.operation,externalOperation:operation};
  states.set(name,state);const element=host||hostFor(name);if(element)element.dataset.loadState=status;installLoader(name,element);loaders.get(name)?.update(state);
  // Completion is acknowledged briefly; errors remain beside the retry action.
  if(status==='done')timers.set(name,setTimeout(()=>{if(states.get(name)===state){states.set(name,null);loaders.get(name)?.update(null);}},1800));
 }
 import('./vendor/ui/upic-ui.js?v=97').then(module=>{
  components=module;
  try{
   volume=components.mountVolume(dial,input);panel.dataset.volumeUi='true';
   dial.addEventListener('ui-component-error',()=>{panel.dataset.volumeUi='false';dial.hidden=true;volume=null;});
   volume.setOpen(mobile.matches?volumeOpen:true);
   if(mobile.matches&&volumeOpen)requestAnimationFrame(positionVolumePanel);
  }catch{panel.dataset.volumeUi='false';dial.hidden=true;volume=null;}
  try{
   clock=components.mountClock(clockHost);time.dataset.clockUi='true';
   clockHost.addEventListener('ui-component-error',()=>{time.dataset.clockUi='false';clockHost.hidden=true;clock=null;});
   if(lastClock)clock.update(lastClock);
  }catch{time.dataset.clockUi='false';clockHost.hidden=true;clock=null;}
  for(const name of ['search','history','audio','trending'])installLoader(name,hostFor(name));
 }).catch(()=>{ /* Native controls and status text remain the working fallback. */ });
 return {
  loading,
  clock(props){
   clockFallback.textContent=new Date(props.timestamp).toLocaleTimeString(undefined,{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
   // The app updates several times a second; the clock needs only changed seconds.
   const key=[Math.floor(props.timestamp/1000),props.rate,props.replay,props.seeking].join(':');
   if(lastClock?._key===key)return;
   lastClock={...props,_key:key};clock?.update(lastClock);
  },
 };
}
