import {Metadata,TypeRegistry} from '@polkadot/types';
import {encodeAddress,blake2AsHex,xxhashAsHex} from '@polkadot/util-crypto';
// Decode each pinned runtime's actual metadata. AccountInfo layouts vary across
// chains; no hard-coded byte offset or delegated voting weight is a balance.
// https://developers.polymesh.network/developer-resources/links/
// https://github.com/galacticcouncil/HydraDX-node
// Mainnet genesis identities are also published by @polkadot/networks.
const CONFIGS={
 GEODE:{id:'geode-chain',chain:'geode-chain',url:'wss://geodeapps.com/citrine2',genesis:'0xfa294dfb0e74160a9800d56231927655ba43d52add29c1982ab59574cc51cc90',decimals:12,prefix:42},
 POLYX:{id:'polymesh',chain:'polymesh',url:'https://mainnet-rpc.polymesh.network/http',genesis:'0x6fbd74e5e1d0a61d52ccfe9d4adaed16dd3a7caa37c6bc4d0c2fa12e8b2f4063',decimals:6,prefix:12},
 HDX:{id:'hydradx',chain:'hydration',url:'https://rpc.hydradx.cloud',genesis:'0xafdc188f45c71dacbaa0b62e16a91f726c7b8699a9748cdf715459de6b7f366d',decimals:12,prefix:63},
};
const bytes=hex=>Uint8Array.from(hex.slice(2).match(/../g)||[],b=>parseInt(b,16));
const key=(pallet,item)=>xxhashAsHex(pallet,128)+xxhashAsHex(item,128).slice(2);
const hex=value=>typeof value==='string'&&/^0x(?:[0-9a-f]{2})+$/i.test(value);
export async function loadSubstrateNative(asset,read,now=Date.now()){
 const cfg=CONFIGS[asset.symbol];if(!cfg||cfg.id!==asset.id||cfg.chain!==asset.chain||asset.provider!=='substrate-'+asset.symbol.toLowerCase())throw Error('unsupported-native-provider');
 const rpc=async(method,params=[])=>{const body=await read(cfg.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(body?.error||body?.id!==1||body?.result===undefined)throw Error('invalid-substrate-rpc');return body.result;};
 if(await rpc('chain_getBlockHash',[0])!==cfg.genesis)throw Error('native-chain-mismatch');
 const hash=await rpc('chain_getFinalizedHead');if(!/^0x[0-9a-f]{64}$/i.test(hash||''))throw Error('invalid-native-tip');
 const raw=await rpc('state_getMetadata',[hash]);if(!hex(raw)||raw.length>4*1024*1024)throw Error('invalid-runtime-metadata');
 const registry=new TypeRegistry(),metadata=new Metadata(registry,raw);registry.setMetadata(metadata);
 const pallets=metadata.asLatest.pallets;
 const storage=(pallet,item)=>{const p=pallets.find(p=>p.name.toString()===pallet);if(!p?.storage.isSome)throw Error('invalid-runtime-storage');const value=p.storage.unwrap().items.find(s=>s.name.toString()===item);if(!value)throw Error('invalid-runtime-storage');return value.type;};
 const account=storage('System','Account'),timestamp=storage('Timestamp','Now');
 if(!account.isMap||account.asMap.hashers.length!==1||account.asMap.hashers[0].toString()!=='Blake2_128Concat'||!timestamp.isPlain)throw Error('unsupported-native-layout');
 const timestampRaw=await rpc('state_getStorage',[key('Timestamp','Now'),hash]);if(!hex(timestampRaw))throw Error('invalid-native-timestamp');
 const indexTipAt=Number(registry.createTypeUnsafe(registry.lookup.getTypeDef(timestamp.asPlain).type,[bytes(timestampRaw)]).toString());
 if(!Number.isSafeInteger(indexTipAt)||indexTipAt>now+300000||now-indexTipAt>=6*3600000)throw Error('native-index-delayed');
 const prefix=key('System','Account'),keys=await rpc('state_getKeysPaged',[prefix,100,null,hash]);
 if(!Array.isArray(keys)||keys.length>100||keys.some(k=>!hex(k)||k.length!==prefix.length+96||!k.startsWith(prefix)))throw Error('invalid-native-account-keys');
 const allowed=new Set(keys);if(allowed.size!==keys.length)throw Error('invalid-native-account-keys');
 const sets=await rpc('state_queryStorageAt',[keys,hash]);if(!Array.isArray(sets)||sets.length!==1||sets[0]?.block!==hash||!Array.isArray(sets[0]?.changes))throw Error('invalid-native-storage-proof');
 const records=[],seen=new Set(),type=registry.lookup.getTypeDef(account.asMap.value).type;
 for(const [storageKey,value] of sets[0].changes){if(!allowed.has(storageKey)||seen.has(storageKey))throw Error('invalid-native-storage-proof');seen.add(storageKey);if(value===null)continue;if(!hex(value))throw Error('invalid-native-account-value');
  const publicKey='0x'+storageKey.slice(-64);if(blake2AsHex(publicKey,128,undefined,true).slice(2)!==storageKey.slice(prefix.length,prefix.length+32))throw Error('invalid-native-account-hash');
  const decoded=registry.createTypeUnsafe(type,[bytes(value)]);if(decoded.encodedLength!==(value.length-2)/2)throw Error('invalid-native-account-layout');
  const data=decoded.get('data'),free=data?.get('free'),reserved=data?.get('reserved');if(!free||!reserved)throw Error('unsupported-native-account-layout');
  const balance=BigInt(free.toString())+BigInt(reserved.toString()),tokenBalance=Number(balance)/10**cfg.decimals;
  if(!Number.isFinite(tokenBalance)||tokenBalance<0)throw Error('invalid-native-balance');if(tokenBalance>0)records.push({id:encodeAddress(publicKey,cfg.prefix),tokenBalance});
 }
 if(!records.length)throw Error('empty-native-account-sample');
 return {records,source:asset.symbol+' public finalized runtime balances',scope:'native-system-account-free-plus-reserved-excludes-other-assets',coverage:'ledger-account-sample',sourceAt:indexTipAt,sourceBlockHash:hash,totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null,indexCadence:'finalized-block'};
}
