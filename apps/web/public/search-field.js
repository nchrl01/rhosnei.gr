// Shared homepage/marketplace search field behavior.
export function bindSearchField(input,label){
 const field=input.closest('.address-field');
 label.replaceChildren(...[...label.textContent].map((letter,index)=>{const span=document.createElement('span');span.textContent=letter;span.style.setProperty('--letter',index);return span;}));
 const sync=()=>field.classList.toggle('has-value',!!input.value.trim());
 input.addEventListener('input',sync);input.addEventListener('change',sync);sync();return sync;
}
