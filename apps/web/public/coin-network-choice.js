import {HOLDER_NETWORKS,validHolderToken} from './holder-count-providers.js?v=390';
const key=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
const aliases={ethereum:'eth',polygon:'polygon_pos',avalanche:'avax',fantom:'ftm',cronos:'cro','kucoin-community-chain':'kcc'};
const explorers=new Set(['ethereum','eth','base','arbitrum','optimism','polygon','polygon_pos','zksync','celo','robinhood']);
// Stable product defaults when observed liquidity is tied or unavailable.
// This is a preference order, not a measured popularity or throughput score.
const establishedNetworks=['ethereum','solana','bsc','base','arbitrum','polygon','avalanche','optimism','tron','sui','ton'];
const nativeIdentity=(coin,candidate)=>(!candidate.address||candidate.address==='native'||candidate.address.startsWith('native:'))&&(coin.nativeChain===candidate.chain||coin.nativeChains?.includes(candidate.chain)||coin.contractStatus==='native'&&coin.chain===candidate.chain);
export function supportedCoinNetwork(coin,candidate){
 if(nativeIdentity(coin,candidate))return true;
 return Boolean(candidate.chain&&candidate.address&&validHolderToken(candidate.chain,candidate.address)&&(explorers.has(candidate.chain)||candidate.chain==='solana'||HOLDER_NETWORKS[aliases[candidate.chain]||candidate.chain]));
}
export function networkPreference(coin,candidate){
 if(nativeIdentity(coin,candidate))return 2;
 return supportedCoinNetwork(coin,candidate)?1:0;
}
const liquidity=candidate=>Number.isFinite(Number(candidate.liquidity))?Math.max(0,Number(candidate.liquidity)):0;
const liquidityTier=candidate=>{const value=liquidity(candidate);return value>0?1+Math.floor(Math.log2(Math.max(1,value))):0;};
const observed=candidate=>candidate.captureKind==='live-player-frame-v1'&&candidate.capturedAt>0?1:0;
const artwork=candidate=>candidate.imageAvailable===true?2:candidate.imageAvailable===false?0:1;
const established=candidate=>{const index=establishedNetworks.indexOf(candidate.chain);return index<0?establishedNetworks.length:index;};
const primary=(coin,candidate)=>coin.address&&key(coin.chain,coin.address)===key(candidate.chain,candidate.address)?1:0;
export function compareCoinNetworks(coin,a,b){
 // Preserve real native identity. For issued tokens use working capture
 // coverage, then liquidity in 2× bands. Within comparable capacity, prefer
 // a verified image reference and an established network over tiny USD changes.
 // A later timestamp alone must not replace a deeper market.
 return networkPreference(coin,b)-networkPreference(coin,a)
  ||observed(b)-observed(a)
  ||liquidityTier(b)-liquidityTier(a)
  ||artwork(b)-artwork(a)
  ||established(a)-established(b)
  ||liquidity(b)-liquidity(a)
  ||primary(coin,b)-primary(coin,a)
  ||(b.capturedAt||0)-(a.capturedAt||0)
  ||key(a.chain,a.address).localeCompare(key(b.chain,b.address));
}
