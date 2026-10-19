// Native currencies are identified separately from issued/wrapped tokens.
export const NATIVE_COINS=Object.freeze({
 BTC:{id:'bitcoin',chain:'bitcoin',symbol:'BTC',provider:'sochain'},
 ETH:{id:'ethereum',chain:'ethereum',symbol:'ETH',provider:'blockscout',chainId:1},
 LTC:{id:'litecoin',chain:'litecoin',symbol:'LTC',provider:'sochain'},
 DOGE:{id:'dogecoin',chain:'dogecoin',symbol:'DOGE',provider:'sochain'},
 DASH:{id:'dash',chain:'dash',symbol:'DASH',provider:'chainz'},
 DGB:{id:'digibyte',chain:'digibyte',symbol:'DGB',provider:'chainz'},
 FIRO:{id:'zcoin',chain:'firo',symbol:'FIRO',provider:'chainz'},
 AVAX:{id:'avalanche-2',chain:'avalanche',symbol:'AVAX',provider:'routescan'},
 NXPC:{id:'nexpace',chain:'henesys',symbol:'NXPC',provider:'routescan'},
 BNB:{id:'binancecoin',chain:'bsc',symbol:'BNB',provider:'bnb-rpc'},
 XTZ:{id:'tezos',chain:'tezos',symbol:'XTZ',provider:'tzkt'},
 HBAR:{id:'hedera-hashgraph',chain:'hedera',symbol:'HBAR',provider:'hedera'},
 ALGO:{id:'algorand',chain:'algorand',symbol:'ALGO',provider:'algonode'},
 SOL:{id:'solana',chain:'solana',symbol:'SOL',provider:'publicnode-sol'},
 XRP:{id:'ripple',chain:'xrp',symbol:'XRP',provider:'ankr-xrp'},
 BCH:{id:'bitcoin-cash',chain:'bitcoin-cash',symbol:'BCH',provider:'bitcore'},
 TRX:{id:'tron',chain:'tron',symbol:'TRX',provider:'tronscan'},
 ETC:{id:'ethereum-classic',chain:'ethereum-classic',symbol:'ETC',provider:'blockscout',chainId:61},
 RON:{id:'ronin',chain:'ronin',symbol:'RON',provider:'blockscout',chainId:2020},
 FLOW:{id:'flow',chain:'flow',symbol:'FLOW',provider:'blockscout',chainId:747,scope:'flow-evm-addresses-only'},
 FIL:{id:'filecoin',chain:'filecoin',symbol:'FIL',provider:'blockscout',chainId:314,scope:'filecoin-evm-addresses-only'},
 ZEC:{id:'zcash',chain:'zcash',symbol:'ZEC',provider:'sochain'},
});
export function nativeCoin(symbol){return NATIVE_COINS[String(symbol).toUpperCase()]||null;}
export function catalogueNative(coin){const asset=nativeCoin(coin?.symbol);return asset&&asset.id===coin.id&&(coin.nativeChain===asset.chain||coin.nativeChains?.includes(asset.chain)||(!coin.nativeChain&&!coin.nativeChains?.length&&!coin.address&&coin.chain===asset.chain))?{...asset,address:'native'}:null;}
