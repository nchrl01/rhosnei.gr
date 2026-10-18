import {loadCoinCatalogue} from './coin-catalogue.js?v=335';
const sourceURL=value=>{try{
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return null;
 if(url.hostname==='www.coingecko.com'&&/^\/en\/coins\/[a-z0-9-]+\/?$/.test(url.pathname))return url.href;
 const parts=url.pathname.split('/');if(url.hostname==='dexscreener.com'&&parts.length===3&&/^[a-z0-9_-]{1,40}$/.test(decodeURIComponent(parts[1]))){const address=decodeURIComponent(parts[2]);if(/^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,255}$/.test(address)&&!address.includes('..'))return url.href;}
 return null;
}catch{return null;}};
export function createCoinSummary(panel){
 if(!panel)return {setMarket(){}};
 const section=document.createElement('aside');section.className='coin-ai-summary';section.setAttribute('aria-label','Coin background');section.hidden=true;
 const title=document.createElement('p');title.className='coin-ai-label';
 const narrative=document.createElement('p');narrative.className='coin-ai-quote';
 const note=document.createElement('small');note.className='coin-ai-note';
 section.append(title,narrative,note);panel.append(section);let epoch=0,controller,timer;
 async function setMarket(pair){
  const current=++epoch;controller?.abort();clearTimeout(timer);const requestController=controller=new AbortController();section.hidden=true;narrative.textContent='';note.replaceChildren();if(!pair)return;
  const catalogue=await loadCoinCatalogue().catch(()=>({coins:[]}));if(current!==epoch)return;
  const address=pair.baseToken?.address,chain=pair.chainId,same=(a,b)=>a&&b&&(/^0x[\da-f]{40}$/i.test(a)?a.toLowerCase()===b.toLowerCase():a===b);
  const coin=catalogue.coins.find(c=>c.chain===chain&&same(c.address,address)||c.platforms?.some(p=>p.chain===chain&&same(p.address,address)));
  const native=pair.source==='ccxt'?catalogue.coins.filter(c=>(c.contractStatus==='native'||c.contractStatus==='native-with-identifier')&&c.symbol===pair.baseToken?.symbol):[];
  const id=coin?.id||(native.length===1?native[0].id:null),params=new URLSearchParams();if(id)params.set('id',id);if(pair.source!=='ccxt'&&address){params.set('network',chain);params.set('address',address);}if(!params.toString())return;
  async function load(attempt=0){try{
   const response=await fetch('https://upic-insightx.nchrl01.workers.dev/coin-summary?'+params,{signal:AbortSignal.any([requestController.signal,AbortSignal.timeout(35000)])});if(!response.ok)return;
   const data=await response.json();if(current!==epoch)return;
   if(data.state==='busy'){const delay=Math.max(1000,Number(data.retryAt)-Date.now()+250);if(attempt<2&&delay<=30000)timer=setTimeout(()=>void load(attempt+1),delay);return;}
   // Only the narrative response can appear here. Legacy metric entries and
   // unavailable research never become a visible substitute for a coin's story.
   const text=typeof data.narrative==='string'?data.narrative.replace(/\s+/g,' ').trim():'';
   const sources=Array.isArray(data.sources)?data.sources.filter(source=>typeof source.name==='string'&&sourceURL(source.url)).slice(0,3):[];
   if(data.state!=='ready'||!text||text.length>440||!sources.length||!Number.isFinite(data.asOf)||data.asOf<=0||data.asOf>Date.now()+60000)return;
   title.textContent='ABOUT THIS COIN';narrative.textContent=text;
   const seen=new Set();for(const source of sources){const url=sourceURL(source.url);if(seen.has(url))continue;if(seen.size)note.append(document.createTextNode(' · '));seen.add(url);const link=document.createElement('a');link.className='coin-ai-source';link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=source.name;note.append(link);}
   const checked=document.createElement('time');checked.dateTime=new Date(data.asOf).toISOString();checked.textContent='Checked '+new Date(data.asOf).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});note.append(document.createTextNode(' · '),checked);section.hidden=false;
  }catch{}}
  await load();
 }
 return {setMarket};
}
