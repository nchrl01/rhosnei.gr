// Shared homepage/marketplace search field behavior.
export function bindSearchField(input,label){
 const field=input.closest('.address-field');
 label.replaceChildren(...[...label.textContent].map((letter,index)=>{const span=document.createElement('span');span.textContent=letter;span.style.setProperty('--letter',index);return span;}));
 const sync=()=>field.classList.toggle('has-value',!!input.value.trim());
 let paste=false,revision=0;
 field.addEventListener('pointerdown',event=>{paste=event.button===0&&document.activeElement!==input;});
 field.addEventListener('click',async()=>{
  if(!paste)return;paste=false;if(!navigator.clipboard?.readText)return;
  const previous=input.value,current=++revision;
  try{const text=(await navigator.clipboard.readText()).trim();
   if(current!==revision||document.activeElement!==input||input.value!==previous||!text||text.length>(input.maxLength>0?input.maxLength:250)||/[\r\n]/.test(text))return;
   input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.setSelectionRange(text.length,text.length);
  }catch{/* Ordinary paste remains available when clipboard access is denied. */}
 });
 input.addEventListener('input',()=>{revision++;sync();});input.addEventListener('change',sync);input.addEventListener('blur',()=>{revision++;paste=false;});sync();return sync;
}
