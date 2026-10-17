const normalized=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/^\$/,'');
export const isTokenIdentifier=query=>/^0x[0-9a-f]{40,64}$/i.test(query)||/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(query);
export function rankCoinMatches(pairs,query,{orientPair,network}={}){
 const address=isTokenIdentifier(query),q=normalized(query);
 const rank=token=>normalized(token.symbol)===q?4:normalized(token.name)===q?3:normalized(token.symbol).startsWith(q)||normalized(token.name).startsWith(q)?2:normalized(token.symbol).includes(q)||normalized(token.name).includes(q)?1:0;
 const matches=[];
 for(const pair of pairs){
  if(network&&pair.chainId!==network)continue;
  const direct=orientPair(pair,query);if(direct){matches.push({pair:direct,rank:5});continue;}if(address)continue;
  const base=rank(pair.baseToken||{}),quote=rank(pair.quoteToken||{});
  if(!base&&!quote)continue;
  const token=quote>base?pair.quoteToken:pair.baseToken,match=orientPair(pair,token.address);
  if(match)matches.push({pair:match,rank:Math.max(base,quote)});
 }
 matches.sort((a,b)=>b.rank-a.rank||(Number(b.pair.liquidity?.usd)||0)-(Number(a.pair.liquidity?.usd)||0));
 const unique=new Set();return matches.filter(({pair})=>{const token=pair.baseToken.address,key=pair.chainId+':'+(/^0x/i.test(token)?token.toLowerCase():token);if(unique.has(key))return false;unique.add(key);return true;}).map(({pair})=>pair).slice(0,12);
}
export function showCoinMatches(container,pairs,onChoose){
 const active=container.ownerDocument.activeElement,focusedKey=container.contains(active)?active.closest('.coin-search-result')?.dataset.marketKey:null;
 const title=container.querySelector('.coin-search-summary')||document.createElement('p');
 for(const child of [...container.childNodes])if(child!==title)child.remove();
 container.hidden=false;
 container.removeAttribute('aria-live');
 const input=container.ownerDocument.getElementById('address'),buttons=[];
 input?.setAttribute('aria-expanded','true');
 title.className='coin-search-summary';title.setAttribute('role','status');title.setAttribute('aria-live','polite');title.setAttribute('aria-atomic','true');
 if(title.parentNode!==container)container.append(title);
 const summary='Choose a market · '+pairs.length+' '+(pairs.length===1?'match':'matches');if(title.textContent!==summary)title.textContent=summary;
 for(const pair of pairs){
  const button=document.createElement('button');button.type='button';button.className='coin-search-result';
  button.dataset.marketKey=[pair.source||'dex',pair.exchangeId||pair.chainId,pair.pairAddress||pair.exchangeSymbol||pair.baseToken.address].join('|');
  const identity=document.createElement('span'),symbol=document.createElement('strong'),name=document.createElement('span');
  symbol.textContent=pair.baseToken.symbol;name.textContent=pair.baseToken.name||pair.baseToken.symbol;identity.append(symbol,name);
  const detail=document.createElement('small'),cap=pair.marketCap==null||pair.marketCap===''?null:Number(pair.marketCap);
  const exchange=pair.source==='ccxt',venue=exchange?pair.exchangeName:[pair.chainId,pair.dexId].filter(Boolean).join(' · ');
  detail.textContent=exchange?venue+' · SPOT · '+pair.exchangeSymbol:venue+' · '+(cap!=null&&Number.isFinite(cap)&&cap>=0?'MCAP $'+Math.round(cap).toLocaleString('en'):'MCAP unavailable');
  const address=document.createElement('small');address.textContent=pair.source==='ccxt'?'Public exchange trades · '+(pair.quoteApproximate?pair.quoteToken.symbol+' quote / USD proxy':'USD quote')+' · MCAP unavailable':pair.baseToken.address;address.className='coin-search-address';
  button.setAttribute('aria-label',[symbol.textContent,name.textContent===symbol.textContent?'':name.textContent,detail.textContent,exchange?address.textContent:'Contract address '+address.textContent].filter(Boolean).join('. '));
  button.append(identity,detail,address);
  button.onclick=()=>{container.hidden=true;container.replaceChildren();input?.setAttribute('aria-expanded','false');onChoose(pair);};
  button.onkeydown=event=>{
   if(event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key==='Escape'){
    event.preventDefault();event.stopPropagation();container.hidden=true;input?.setAttribute('aria-expanded','false');input?.focus();return;
   }
   const index=buttons.indexOf(button),target=event.key==='ArrowDown'?Math.min(buttons.length-1,index+1):event.key==='ArrowUp'?Math.max(0,index-1):event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
   if(target===null)return;
   event.preventDefault();buttons[target]?.focus();
  };
  buttons.push(button);container.append(button);
 }
 if(focusedKey)(buttons.find(button=>button.dataset.marketKey===focusedKey)||input)?.focus({preventScroll:true});
}
