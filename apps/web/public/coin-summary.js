import {loadCoinCatalogue} from './coin-catalogue.js?v=331';
const sourceURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&['www.coingecko.com','dexscreener.com','api.gopluslabs.io'].includes(url.hostname)?url.href:null;}catch{return null;}};
export function createCoinSummary(panel){
 if(!panel)return {setMarket(){}};
 const section=document.createElement('aside');section.className='coin-ai-summary';section.setAttribute('aria-label','Coin investigation');section.hidden=true;
 const title=document.createElement('p');title.className='coin-ai-label';title.textContent='AI INVESTIGATOR';
 const status=document.createElement('p');status.className='coin-ai-quote';status.setAttribute('role','status');
 const entries=document.createElement('div');entries.className='coin-ai-entries';
 const note=document.createElement('small');note.className='coin-ai-note';
 const retry=document.createElement('button');retry.type='button';retry.className='coin-ai-retry';retry.textContent='Retry';retry.hidden=true;
 section.append(title,status,entries,note,retry);panel.append(section);let epoch=0,controller,timer,lastPair;
 async function setMarket(pair){lastPair=pair;const current=++epoch;controller?.abort();clearTimeout(timer);controller=new AbortController();section.hidden=!pair;entries.replaceChildren();status.hidden=false;note.hidden=true;retry.hidden=true;title.textContent='AI INVESTIGATOR';status.textContent='Reading public evidence…';if(!pair)return;
 const catalogue=await loadCoinCatalogue().catch(()=>({coins:[]}));if(current!==epoch)return;
 const address=pair.baseToken?.address,chain=pair.chainId,same=(a,b)=>a&&b&&(/^0x[\da-f]{40}$/i.test(a)?a.toLowerCase()===b.toLowerCase():a===b);
 const coin=catalogue.coins.find(c=>c.chain===chain&&same(c.address,address)||c.platforms?.some(p=>p.chain===chain&&same(p.address,address)));
 const native=pair.source==='ccxt'?catalogue.coins.filter(c=>(c.contractStatus==='native'||c.contractStatus==='native-with-identifier')&&c.symbol===pair.baseToken?.symbol):[];
 const id=coin?.id||(native.length===1?native[0].id:null),params=new URLSearchParams();if(id)params.set('id',id);if(pair.source!=='ccxt'&&address){params.set('network',chain);params.set('address',address);}
 async function load(attempt=0){try{
  const response=await fetch('https://upic-insightx.nchrl01.workers.dev/coin-summary?'+params,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});const data=await response.json();if(current!==epoch)return;
  if(data.state==='busy'){const delay=Math.max(1000,Number(data.retryAt)-Date.now()+250);status.textContent='Investigation queued…';if(attempt<2&&delay<=30000){timer=setTimeout(()=>void load(attempt+1),delay);return;}status.textContent='Research is busy. Try again later.';retry.hidden=false;return;}
  const rows=Array.isArray(data.entries)?data.entries.filter(e=>typeof e.text==='string'&&e.text.length<=1000&&sourceURL(e.sourceURL)).slice(0,3):[];
  if(!rows.length){status.textContent='No sourced entries available yet.';retry.hidden=false;return;}
  title.textContent=data.ai?'AI INVESTIGATOR':'PUBLIC EVIDENCE';status.hidden=true;entries.replaceChildren();
  for(const row of rows){const item=document.createElement('p');item.className='coin-ai-entry';const label=document.createElement('span');label.className='coin-ai-entry-label';label.textContent=row.title+' · ';const text=document.createElement('span');text.textContent=row.text+' ';const source=document.createElement('a');source.href=sourceURL(row.sourceURL);source.className='coin-ai-source';source.target='_blank';source.rel='noopener noreferrer';source.textContent='↗';source.setAttribute('aria-label',row.source+' source');source.title=row.source+' · '+new Date(row.asOf).toLocaleString();item.append(label,text,source);entries.append(item);}
  note.hidden=false;note.textContent='Checked '+new Date(data.asOf).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · public data';note.title=data.scope||'Verify the linked sources.';
 }catch(error){if(current===epoch&&error.name!=='AbortError'){status.textContent='Investigation unavailable for now.';retry.hidden=false;}}}
 await load();
 }
 retry.addEventListener('click',()=>void setMarket(lastPair));
 return {setMarket};
}
