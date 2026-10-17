// Shared listening preference and popup. Engines listen to the native input event.
const bindings=new WeakMap();
const STORAGE_KEY='av-listening-volume';
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
export function bindListeningVolume(root=document){
 const input=root.querySelector('#master'),button=root.querySelector('#volume-button'),panel=root.querySelector('#volume-panel');
 if(!input||!button||!panel)return null;
 if(bindings.has(input))return bindings.get(input);
 const widget=button.closest('.volume-widget')||button.parentElement;
 const value=root.querySelector('#master-value'),mobile=matchMedia('(max-width:760px)');
 let opened=false;
 function sync(){
  const amount=Math.round(clamp(input.value)*100);
  input.style.setProperty('--range-fill',amount+'%');
  if(value)value.textContent=amount+'%';
  button.setAttribute('aria-label','Volume '+amount+'%');
  button.dataset.muted=String(amount===0);
  button.dataset.volumeLevel=amount>50?'high':'low';
 }
 function open(state,focus=false){
  opened=Boolean(state);panel.hidden=!opened;button.hidden=false;
  button.setAttribute('aria-expanded',String(opened));
  if(opened&&focus)input.focus({preventScroll:true});
 }
 try{const saved=localStorage.getItem(STORAGE_KEY);if(saved!==null&&Number.isFinite(Number(saved)))input.value=String(clamp(saved));}catch{}
 input.addEventListener('input',()=>{sync();try{localStorage.setItem(STORAGE_KEY,input.value);}catch{}});
 button.addEventListener('click',()=>open(mobile.matches?!opened:true,true));
 widget.addEventListener('pointerenter',()=>{if(!mobile.matches)open(true);});
 widget.addEventListener('pointerleave',()=>{if(!mobile.matches&&!widget.contains(document.activeElement))open(false);});
 widget.addEventListener('focusout',event=>{if(opened&&event.relatedTarget&&!widget.contains(event.relatedTarget))open(false);});
 document.addEventListener('pointerdown',event=>{if(opened&&!widget.contains(event.target))open(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened){event.preventDefault();open(false);button.focus({preventScroll:true});}});
 window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;input.value=String(clamp(event.newValue??.5));input.dispatchEvent(new Event('input',{bubbles:true}));});
 mobile.addEventListener('change',()=>open(false));
 const binding={sync,close:()=>open(false)};bindings.set(input,binding);open(false);sync();return binding;
}
