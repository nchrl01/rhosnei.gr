// Included by prepare-web.mjs only in the private staging build.
(() => {
 const params=new URLSearchParams(location.hash.slice(1));
 if(['/','/index.html'].includes(location.pathname)&&(location.hash==='#search'||params.has('take')||params.has('score'))){
  location.replace('/instrument'+location.search+location.hash);return;
 }
 if(new URLSearchParams(location.search).get('capture')==='live'||document.getElementById('root'))return;
 const nav=document.querySelector('.header-links');if(!nav)return;
 const menu=document.createElement('details');menu.className='staging-tools';
 const summary=document.createElement('summary');summary.textContent='Staging';summary.title='Staging tools and page guide';
 const panel=document.createElement('div');panel.className='staging-tools-panel';
 const title=document.createElement('h2');title.textContent='Staging tools';
 const description=document.createElement('p');description.textContent='Private preview. Testnet actions use test assets.';
 const links=document.createElement('nav');links.setAttribute('aria-label','Staging destinations');
 const destinations=[
  ['Testnet desk','/?tab=collections','Create, mint and manage test editions.'],
  ['Test marketplace','/?tab=marketplace','List and buy editions on the test network.'],
  ['Test wallet','/?tab=wallet','Test tokens, gas, owned editions and revenue.'],
  ['Live instrument','/instrument','Hear and see real market activity.'],
  ['Coin previews','/upic/marketplace/','Browse the current 100-coin preview collection.'],
  ['Saved profile','/profile','Bookmarks and your profile wallet.'],
  ['Combined lab','/av-lab','Adjust audio and visuals together with simulated data.'],
  ['Audio lab','/audio-lab','Try chip voices, phrases and manual controls.'],
  ['Visual lab','/visual-lab','Explore the visual layers with simulated inputs.'],
  ['Mapping lab','/mapping-lab','Trace how a market input changes the artwork.'],
 ];
 for(const [label,href,hint] of destinations){
  const link=document.createElement('a');link.href=href;
  const name=document.createElement('span');name.textContent=label;
  const note=document.createElement('small');note.textContent=hint;
  link.append(name,note);
  if(location.pathname.replace(/\.html$/,'').replace(/\/$/,'')===href.replace(/\/$/,''))link.setAttribute('aria-current','page');
  links.append(link);
 }
 const help=document.createElement('details');help.className='staging-tools-help';
 const helpTitle=document.createElement('summary');helpTitle.textContent='What am I looking at?';
 const hint=document.createElement('p');
 const path=location.pathname;
 hint.textContent=path.includes('profile')?'This profile stores saved coins. Test editions and test-network funds live in Test wallet. You may need to sign in separately for each.':
  path.includes('marketplace')?'These cards preview the live coin instrument. Collecting test editions happens in Test marketplace or the Testnet desk.':
  /(?:audio|visual|av|mapping)-lab/.test(path)?'Labs use simulated inputs to make a change easy to repeat. AUTO follows the current input; a manual control overrides it. A lab preset stays in this browser and does not change the deployed instrument.':
  path.includes('instrument')?'Choose a coin, then press Play. Live follows current market data; Replay follows recorded observations. Quiet or missing activity leaves more space. The testnet desk is a separate place to create and collect editions.':
  'The live instrument, preview gallery and labs share the current engine. Use the Testnet desk for the contract flow: prepare artwork, confirm in your wallet, then wait for the edition to appear.';
 help.append(helpTitle,hint);panel.append(title,description,links,help);menu.append(summary,panel);nav.prepend(menu);
 menu.addEventListener('toggle',()=>{if(menu.open)help.open=true;});
 document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 menu.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.open=false;summary.focus();event.preventDefault();}});
})();
