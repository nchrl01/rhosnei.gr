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
 container.replaceChildren();container.hidden=false;
 const title=document.createElement('p');title.textContent='CHOOSE A MARKET';container.append(title);
 for(const pair of pairs){
  const button=document.createElement('button');button.type='button';button.className='coin-search-result';
  const identity=document.createElement('span'),symbol=document.createElement('strong'),name=document.createElement('span');
  symbol.textContent=pair.baseToken.symbol;name.textContent=pair.baseToken.name||pair.baseToken.symbol;identity.append(symbol,name);
  const detail=document.createElement('small'),cap=pair.marketCap==null||pair.marketCap===''?null:Number(pair.marketCap);
  detail.textContent=pair.source==='ccxt'?pair.exchangeName+' · SPOT · '+pair.exchangeSymbol:pair.chainId+' · '+(cap!=null&&Number.isFinite(cap)&&cap>=0?'MCAP $'+Math.round(cap).toLocaleString('en'):'MCAP unavailable');
  const address=document.createElement('small');address.textContent=pair.source==='ccxt'?'Public exchange trades · '+(pair.quoteApproximate?pair.quoteToken.symbol+' quote / USD proxy':'USD quote')+' · MCAP unavailable':pair.baseToken.address;address.className='coin-search-address';
  button.append(identity,detail,address);button.onclick=()=>{container.hidden=true;container.replaceChildren();onChoose(pair);};container.append(button);
 }
}
