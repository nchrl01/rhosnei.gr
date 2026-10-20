// Shared homepage/marketplace search field behavior.
export function bindSearchField(input,label){
 const field=input.closest('.address-field');
 // Keep the hint as normal text so spaces and its accessible name stay intact.
 label.textContent=label.textContent.trim();
 const sync=()=>field.classList.toggle('has-value',!!input.value.trim());
 input.addEventListener('input',sync);input.addEventListener('change',sync);sync();return sync;
}
