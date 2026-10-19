// Native currencies are identified separately from issued/wrapped tokens.
export const NATIVE_COINS=Object.freeze({
 BTC:{id:'bitcoin',chain:'bitcoin',symbol:'BTC',provider:'sochain'},
 ETH:{id:'ethereum',chain:'ethereum',symbol:'ETH',provider:'blockscout'},
 LTC:{id:'litecoin',chain:'litecoin',symbol:'LTC',provider:'sochain'},
 DOGE:{id:'dogecoin',chain:'dogecoin',symbol:'DOGE',provider:'sochain'},
 ZEC:{id:'zcash',chain:'zcash',symbol:'ZEC',provider:'sochain'},
});
export function nativeCoin(symbol){return NATIVE_COINS[String(symbol).toUpperCase()]||null;}
export function catalogueNative(coin){const asset=nativeCoin(coin?.symbol);return asset&&asset.id===coin.id&&(coin.nativeChain===asset.chain||coin.nativeChains?.includes(asset.chain)||(!coin.nativeChain&&!coin.nativeChains?.length&&!coin.address&&coin.chain===asset.chain))?{...asset,address:'native'}:null;}
