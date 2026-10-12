const links=[...document.querySelectorAll('.header-links a')];
for(const link of links){const target=new URL(link.href);if(target.origin===location.origin&&target.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,''))link.setAttribute('aria-current','page');}
const input=document.getElementById('master'),button=document.getElementById('volume-button'),panel=document.getElementById('volume-panel');
if(input){try{const saved=localStorage.getItem('av-listening-volume');if(saved!==null)input.value=String(Math.max(0,Math.min(1,Number(saved)||0)));}catch{}input.addEventListener('input',()=>{try{localStorage.setItem('av-listening-volume',input.value);}catch{}});}
if(input&&button&&panel&&!document.getElementById('market-chart')){
 const value=document.getElementById('master-value');
 const update=()=>{const amount=Math.round(Number(input.value)*100);value.textContent=amount+'%';button.setAttribute('aria-label','Volume '+amount+'%');button.dataset.muted=String(amount===0);button.dataset.volumeLevel=amount>50?"high":"low";};
 const open=state=>{panel.hidden=!state;button.setAttribute('aria-expanded',String(state));if(state&&matchMedia('(max-width:760px)').matches){const rect=button.getBoundingClientRect();panel.style.left=Math.max(12,Math.min(innerWidth-180,rect.right-168))+'px';panel.style.top=rect.bottom+8+'px';}};
 button.parentElement.addEventListener('pointerenter',()=>{if(matchMedia('(min-width:761px)').matches)open(true);});
 button.parentElement.addEventListener('pointerleave',()=>{if(matchMedia('(min-width:761px)').matches&&!button.parentElement.contains(document.activeElement))open(false);});
 button.addEventListener('click',()=>open(panel.hidden));input.addEventListener('input',update);
 document.addEventListener('pointerdown',event=>{if(!button.parentElement.contains(event.target))open(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape')open(false);});update();
}

// Remove recordings saved by the retired coin-sound upload feature.
try{const cleanup=indexedDB.deleteDatabase('upic-envion-samples-v1');cleanup.onerror=()=>{};}catch{}

// Artwork is for viewing, never a browser drag payload.
document.addEventListener('dragstart',event=>{if(event.target.closest?.('img,canvas,.coin-avatar,.trending-avatar,.collection-card'))event.preventDefault();},true);
