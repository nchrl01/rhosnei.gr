// Idempotently preserve verified references in both public discovery and the
// publisher's exact-identity allowlist. Does not change rank or native identity.
import {readFile,writeFile} from 'node:fs/promises';
import {NATIVE_CONTRACT_REFERENCES} from '../apps/web/public/native-contracts.js';
const key=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
for(const relative of ['../apps/web/public/marketplace-coin-catalogue.json','../cloudflare/insightx/coin-capture-catalogue.json']){
 const path=new URL(relative,import.meta.url),data=JSON.parse(await readFile(path,'utf8'));let attached=0;
 for(const coin of data.coins){
  const reference=Object.hasOwn(NATIVE_CONTRACT_REFERENCES,coin.id)?NATIVE_CONTRACT_REFERENCES[coin.id]:null;if(!reference)continue;
  const identity=key(reference.chain,reference.address);coin.platforms??=[];
  if(!coin.platforms.some(p=>key(p.chain,p.address)===identity)){coin.platforms.push({chain:reference.chain,address:reference.address,identifierType:reference.kind==='type'?'native-coin-type':reference.kind==='native'?'native-contract-identifier':'token-contract',referenceKind:reference.kind,referenceSymbol:reference.symbol,sourceURLs:[reference.source],verifiedAt:reference.verifiedAt});attached++;}
 }
 await writeFile(path,JSON.stringify(data)+'\n');console.log(relative+': attached '+attached+' exact collectible identities');
}
