import {isTokenIdentifier} from './coin-identifiers.js?v=448';

// Shared homepage/marketplace search field behavior.
export function bindSearchField(input,label){
 const field=input.closest('.address-field');
 // Keep the hint as normal text so spaces and its accessible name stay intact.
 label.textContent=label.textContent.trim();
 const sync=()=>field.classList.toggle('has-value',!!input.value.trim());
 input.addEventListener('input',sync);input.addEventListener('change',sync);sync();return sync;
}

// Resolve complete pasted/typed addresses, while leaving selection to a click
// or Enter. Input invalidation stays with each page's search controller.
export function bindAddressSearch(input,{lookup,cancel,current}){
 const form=input.form,document=input.ownerDocument;
 let timer;
 const stop=()=>{clearTimeout(timer);timer=null;};
 function schedule(event){
  stop();
  const query=input.value.trim(),revision=current();
  if(event.isComposing||query.length>250||!isTokenIdentifier(query))return;
  timer=setTimeout(()=>{
   timer=null;
   if(input.value.trim()!==query||current()!==revision)return;
   form.dispatchEvent(new Event('upic:address-lookup'));
   lookup(query);
  },300);
 }
 input.addEventListener('input',schedule);
 input.addEventListener('compositionend',schedule);
 form.addEventListener('submit',stop,true);
 form.addEventListener('upic:search-dismiss',()=>{stop();cancel();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')stop();},true);
 // Closing after a selection must not cancel the selection's new request.
 document.addEventListener('close',event=>{if(event.target.id==='mobile-coin-search')stop();},true);
 document.addEventListener('upic:search-coin',stop);
 document.addEventListener('upic:market-selected',stop);
 document.defaultView.addEventListener('pagehide',()=>{stop();cancel();});
}
