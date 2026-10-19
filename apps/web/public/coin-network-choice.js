const key=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
// A capture arriving later must not silently change a coin's default network.
// Prefer its listed native/main identity, then the deepest observed market.
export function networkPreference(coin,candidate){
 if(coin.nativeChains?.includes(candidate.chain)||coin.nativeChain===candidate.chain)return 3;
 if(coin.address&&key(coin.chain,coin.address)===key(candidate.chain,candidate.address))return 2;
 return 0;
}
export function compareCoinNetworks(coin,a,b){
 return networkPreference(coin,b)-networkPreference(coin,a)
  ||(Number(b.liquidity)||0)-(Number(a.liquidity)||0)
  ||(b.capturedAt||0)-(a.capturedAt||0)
  ||key(a.chain,a.address).localeCompare(key(b.chain,b.address));
}
