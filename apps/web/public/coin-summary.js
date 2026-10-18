import {loadCoinCatalogue} from './coin-catalogue.js?v=331';
export function createCoinSummary(panel){
 if(!panel)return {setMarket(){}};
 const section=document.createElement('aside');section.className='coin-ai-summary';section.setAttribute('aria-label','AI coin summary');section.hidden=true;
 const title=document.createElement('p');title.className='coin-ai-label';title.textContent='DYOR · AI';
 const quote=document.createElement('p');quote.className='coin-ai-quote';quote.setAttribute('role','status');
 const source=document.createElement('a');source.className='coin-ai-source';source.target='_blank';source.rel='noopener noreferrer';source.textContent='Source ↗';source.hidden=true;
 const note=document.createElement('small');note.className='coin-ai-note';note.textContent='AI summary · verify independently';
 section.append(title,quote,source,note);panel.append(section);let epoch=0,controller;
 async function setMarket(pair){const current=++epoch;controller?.abort();controller=new AbortController();section.hidden=!pair;source.hidden=true;note.hidden=true;quote.textContent='Reading coin context…';if(!pair)return;
 try{const catalogue=await loadCoinCatalogue().catch(()=>({coins:[]}));if(current!==epoch)return;const address=pair.baseToken?.address,chain=pair.chainId;const same=(a,b)=>a&&b&&(/^0x[\da-f]{40}$/i.test(a)?a.toLowerCase()===b.toLowerCase():a===b);
 const coin=catalogue.coins.find(c=>c.chain===chain&&same(c.address,address)||c.platforms?.some(p=>p.chain===chain&&same(p.address,address)));
 // Native exchange markets are matched only when a unique native catalogue symbol exists.
 const native=pair.source==='ccxt'?catalogue.coins.filter(c=>!c.address&&c.symbol===pair.baseToken?.symbol):[];
 const id=coin?.id||(native.length===1?native[0].id:null);const params=id?new URLSearchParams({id}):new URLSearchParams({network:chain,address:address||''});
 const response=await fetch('https://upic-insightx.nchrl01.workers.dev/coin-summary?'+params,{signal:controller.signal});const data=await response.json();if(current!==epoch)return;
 quote.textContent=data.summary|| (data.state==='busy'?'Research is busy. Check again shortly.':'No project description available yet.');
 if(data.summary&&/^https:\/\/www\.coingecko\.com\/en\/coins\/[a-zA-Z0-9%-]+$/.test(data.sourceURL)){source.href=data.sourceURL;source.hidden=false;source.title=data.source+' · '+new Date(data.asOf).toLocaleDateString();}note.hidden=!data.summary;
 }catch(error){if(current===epoch&&error.name!=='AbortError'){quote.textContent='Coin summary unavailable for now.';note.hidden=true;}}
 }
 return {setMarket};
}
