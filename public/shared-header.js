const links=[...document.querySelectorAll('.header-links a')];
for(const link of links){const target=new URL(link.href);if(target.origin===location.origin&&target.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,''))link.setAttribute('aria-current','page');}
const input=document.getElementById('master'),button=document.getElementById('volume-button'),panel=document.getElementById('volume-panel');
if(input){try{const saved=localStorage.getItem('av-listening-volume');if(saved!==null)input.value=String(Math.max(0,Math.min(1,Number(saved)||0)));}catch{}input.addEventListener('input',()=>{try{localStorage.setItem('av-listening-volume',input.value);}catch{}});}
if(input&&button&&panel&&!document.getElementById('market-chart')){
 const value=document.getElementById('master-value');
 const update=()=>{const amount=Math.round(Number(input.value)*100);value.textContent=amount+'%';button.setAttribute('aria-label','Volume '+amount+'%');button.dataset.muted=String(amount===0);};
 const open=state=>{panel.hidden=!state;button.setAttribute('aria-expanded',String(state));};
 button.addEventListener('click',()=>open(panel.hidden));input.addEventListener('input',update);
 document.addEventListener('pointerdown',event=>{if(!button.parentElement.contains(event.target))open(false);});document.addEventListener('keydown',event=>{if(event.key==='Escape')open(false);});update();
}
