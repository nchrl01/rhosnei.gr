import {isTokenIdentifier} from './coin-identifiers.js?v=444';
import {NATIVE_CONTRACT_REFERENCES} from './native-contracts.js?v=444';
import {compareCoinNetworks,supportedCoinNetwork} from './coin-network-choice.js?v=444';
const key=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
export const collectibleKey=key;
const contractIdentifier=address=>isTokenIdentifier(address)&&!/^0x(?:0{40}|e{40})$/i.test(address)&&address!=='EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
export function contractPlayerURL(selection){
 if(!selection?.chain||['unknown','off-chain','exchange'].includes(selection.chain)||!contractIdentifier(selection.address))return null;
 return './?'+new URLSearchParams({coin:selection.address,network:selection.chain});
}
export function collectiblePreview(coin,network='all'){
 const reference=Object.hasOwn(NATIVE_CONTRACT_REFERENCES,coin.id)?NATIVE_CONTRACT_REFERENCES[coin.id]:null;
 if(coin.contractStatus==='off-chain')return {selection:null,capture:null};
 const candidates=[],seen=new Set();
 const add=(identity,ref=null)=>{
  if(!identity?.chain||!contractIdentifier(identity.address)||network!=='all'&&identity.chain!==network)return;
  const identityKey=key(identity.chain,identity.address);if(seen.has(identityKey))return;seen.add(identityKey);
  const frame=coin.captures?.[identityKey],capture=frame?.chain===identity.chain&&key(frame.chain,frame.address)===identityKey?frame:null;
  const selection={...coin,chain:identity.chain,address:identity.address,key:identityKey,query:null,contractStatus:'source-listed',nativeChain:null,nativeChains:[],contractReference:ref};
  if(ref){selection.symbol=ref.symbol;selection.name=ref.kind==='wrapped'?'Wrapped '+coin.name:ref.kind==='bridged'?ref.provider+' '+coin.name:coin.name;selection.marketCap=null;selection.liquidity=null;selection.holders=null;}
  candidates.push({selection,capture});
 };
 // A verified counterpart takes precedence over a native route or historical
 // platform token. Explicit filters still require the requested chain.
 if(reference)add(reference,reference);
 if(coin.address)add({chain:coin.chain,address:coin.address});
 for(const platform of coin.platforms||[])add(platform);
 candidates.sort((a,b)=>Number(Boolean(b.selection.contractReference))-Number(Boolean(a.selection.contractReference))||compareCoinNetworks(coin,{...a.selection,...a.capture},{...b.selection,...b.capture}));
 return candidates[0]||{selection:null,capture:null};
}

// Keep ranking data intact while filling Genesis slots with contract-linked coins.
export function genesisCollectibles(coins,limit=100){
 return coins.filter(coin=>{const selection=collectiblePreview(coin).selection;return coin.top1000&&selection&&supportedCoinNetwork(selection,selection);})
  .sort((a,b)=>(b.marketCap||0)-(a.marketCap||0)||(a.catalogueRank||Infinity)-(b.catalogueRank||Infinity))
  .slice(0,limit);
}
