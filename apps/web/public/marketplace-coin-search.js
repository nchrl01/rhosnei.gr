import {bindSearchField} from './search-field.js?v=394';
import {isTokenIdentifier,showCoinMatches} from './coin-search.js?v=395';
import {findOnchainMarkets} from './market-search.js?v=395';
import {isExchangeQuery,searchExchangeMarkets} from './ccxt-market.js?v=359';
import {rememberRecentCoin} from './coin-catalogue.js?v=359';
import {savedCoins} from './saved-coins.js?v=424';

// Search live markets using the same discovery, ranking and result UI as home.
export function bindMarketplaceCoinSearch(){
 const form=document.getElementById('marketplace-coin-form'),input=document.getElementById('coin-gallery-search');
 const results=document.getElementById('coin-search-results'),feedback=document.getElementById('lookup'),submit=form.querySelector('button[type=submit]');
 const sync=bindSearchField(input,document.getElementById('coin-gallery-label'));
 let revision=0,controller,requestedNetwork=null;
 function busy(value){form.setAttribute('aria-busy',String(value));submit.disabled=value;submit.setAttribute('aria-busy',String(value));submit.textContent=value?'Searching…':'Search';}
 function message(text,state='ready'){feedback.textContent=text;feedback.hidden=!text;feedback.dataset.state=state;}
 function cancel(){revision++;controller?.abort();busy(false);results.hidden=true;input.setAttribute('aria-expanded','false');message('');}
 function choose(pair){
  cancel();
  const exchange=pair.source==='ccxt',query=exchange?(pair.exchangeId||pair.dexId)+':'+pair.exchangeSymbol:pair.baseToken.address;
  const url=new URL('./',document.baseURI);url.searchParams.set('coin',query);
  if(!exchange)url.searchParams.set('network',pair.chainId);
  rememberRecentCoin({key:pair.chainId+':'+query,chain:pair.chainId,address:exchange?null:query,query,symbol:pair.baseToken.symbol,name:pair.baseToken.name,image:pair.info?.imageUrl||pair.baseToken.imageUrl});
  location.href=url.href;
 }
 input.addEventListener('input',cancel);
 input.addEventListener('keydown',event=>{
  if(event.key==='Escape')cancel();
  if(event.key==='ArrowDown'&&!results.hidden){event.preventDefault();results.querySelector('button')?.focus();}
 });
 results.addEventListener('keydown',event=>{if(event.key==='Escape')cancel();},true);
 document.addEventListener('close',event=>{if(event.target.id==='mobile-coin-search')cancel();},true);
 document.addEventListener('upic:search-coin',event=>{
  const coin=event.detail;if(!coin||typeof(coin.address||coin.query)!=='string')return;
  const saved=coin.key&&savedCoins().find(item=>item.key===coin.key);
  if(saved){cancel();rememberRecentCoin(saved);location.href=new URL(saved.url,document.baseURI).href;return;}
  cancel();requestedNetwork=coin.address?coin.chain:null;input.value=coin.address||coin.query;sync();form.requestSubmit();
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();cancel();
  const query=input.value.trim();if(!query||query.length>250){message('Enter a coin name, contract address or exchange pair.','error');return;}
  const selectedNetwork=form.dataset.searchNetwork||document.getElementById('coin-gallery-network')?.value;
  const network=requestedNetwork||(selectedNetwork&&selectedNetwork!=='all'?selectedNetwork:null);requestedNetwork=null;
  const current=++revision,abort=new AbortController();controller=abort;
  const token=isTokenIdentifier(query),exchangeOnly=isExchangeQuery(query),active=()=>current===revision;
  let dex=[],exchanges=[],errors=[],remaining=2;
  busy(true);message(token?'Finding this coin…':exchangeOnly?'Finding exchange markets…':'Finding markets…','loading');
  function publish(){
   if(!active()||token||exchangeOnly)return;
   const pairs=[...exchanges,...dex];if(!pairs.length)return;
   showCoinMatches(results,pairs,choose);message(remaining?'Choose a result now · checking more markets…':'Choose a market'+(errors.length?' · some sources are unavailable':''),remaining?'loading':'ready');
  }
  try{
   await Promise.allSettled([
    (async()=>{try{if(!exchangeOnly)dex=await findOnchainMarkets(query,{network,signal:abort.signal});}catch(error){errors.push(error.message);}finally{remaining--;publish();}})(),
    (async()=>{try{if(!token&&!network){const data=await searchExchangeMarkets(query);exchanges=data.pairs;errors.push(...data.errors);}}catch(error){errors.push(error.message);}finally{remaining--;publish();}})(),
   ]);
   if(!active())return;
   const pairs=[...exchanges,...dex];
   if(!pairs.length)throw Error(errors.length?'Market search is unavailable. Please try again.':'No matching market. Try its contract address or a pair such as BTC/USD.');
   if(token){choose(dex[0]);return;}
   if(exchangeOnly&&pairs.length===1){choose(pairs[0]);return;}
   if(exchangeOnly){showCoinMatches(results,pairs,choose);message('Choose an exchange market');}
  }catch(error){if(active())message(error.message,'error');}
  finally{if(active())busy(false);}
 });
}
