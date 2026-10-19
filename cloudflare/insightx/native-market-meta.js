// Exact IDs verified against https://api.coinlore.net/api/assets/.
// Free public API for applications/businesses: https://www.coinlore.com/cryptocurrency-data-api.
const IDS={vechain:['2741','vechain'],bitcoin:['90','bitcoin'],ethereum:['80','ethereum'],binancecoin:['2710','binance-coin'],ripple:['58','ripple'],solana:['48543','solana'],tron:['2713','tron'],zcash:['134','zcash'],dogecoin:['2','dogecoin'],'bitcoin-cash':['2321','bitcoin-cash'],litecoin:['1','litecoin'],'avalanche-2':['44883','avalanche'],'hedera-hashgraph':['48555','hedera-hashgraph'],'ethereum-classic':['118','ethereum-classic'],algorand:['34406','algorand'],filecoin:['32607','filecoin'],dash:['8','dash'],tezos:['3682','tezos'],digibyte:['43','digibyte'],flow:['48589','flow'],ronin:['64703','ronin'],nexpace:['158407','maplestory-universe'],zcoin:['46573','firo'],'flare-networks':['84965','flare'],'kucoin-shares':['2750','kucoin-shares'],electroneum:['2623','electroneum'],stratis:['147607','stratis-new'],cardano:['257','cardano'],cosmos:['33830','cosmos'],kaspa:['70485','kaspa'],near:['48563','near-protocol'],stellar:['89','stellar'],sui:['93845','sui'],aptos:['111341','aptos'],blockstack:['48569','stacks'],'terra-luna':['48537','terra-luna'],thorchain:['36447','thorchain'],'sonic-3':['148191','sonic-prev-ftm'],somnia:['165047','somnia'],mantra:['182973','mantra-new'],'wemix-token':['46642','wemix-token'],'sei-network':['100427','sei'],'berachain-bera':['150197','berachain'],'conflux-token':['121599','conflux-network']};
const positive=x=>x!==null&&x!==''&&Number.isFinite(Number(x))&&Number(x)>0?Number(x):null;
export async function loadCoinLoreNative(read,assets,now=Date.now()){
 const mapped=assets.filter(a=>IDS[a.id]),rows=await read('https://api.coinlore.net/api/ticker/?id='+mapped.map(a=>IDS[a.id][0]).join(','));
 if(!Array.isArray(rows))throw Error('invalid-native-market-metadata');
 const result={};
 for(const asset of mapped){const [id,slug]=IDS[asset.id],matches=rows.filter(row=>String(row.id)===id&&row.nameid===slug&&row.symbol===asset.symbol);if(matches.length!==1)continue;
  const row=matches[0],referencePrice=positive(row.price_usd),referenceMarketCap=positive(row.market_cap_usd),supply=positive(row.csupply);
  if(!referencePrice||!referenceMarketCap||!supply)continue;
  result[asset.id]={referencePrice,referenceMarketCap,supply,supplyBasis:'circulating',marketSource:'CoinLore',marketAt:null,marketFetchedAt:now};
 }
 return result;
}
