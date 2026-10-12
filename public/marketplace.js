const search=document.getElementById('marketplace-search'),buttons=[...document.querySelectorAll('[data-chain]')],title=document.getElementById('marketplace-empty-title'),note=document.getElementById('marketplace-empty-note');
let chain='all';
function update(){const query=search.value.trim(),network=buttons.find(button=>button.dataset.chain===chain)?.getAttribute('aria-label')||'All networks';title.textContent=query?'No matching artworks yet.':chain==='all'?'The first artworks are still to come.':'No '+network+' listings yet.';note.textContent=query?'Try another search, or return when verified UPIC collections are available.':'Verified UPIC collections and secondary listings will appear here when trading launches.';}
for(const button of buttons)button.addEventListener('click',()=>{chain=button.dataset.chain;for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));update();});
search.addEventListener('input',update);

