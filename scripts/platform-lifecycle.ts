// Operator-run integration exercise against fresh local services and a live renderer.
import assert from 'node:assert/strict';
import {createPublicClient,createWalletClient,http,type Address,type Abi} from 'viem';
import {mnemonicToAccount} from 'viem/accounts';
import {anvil} from 'viem/chains';
import {type Deployment,type Collection,type Hex,MINT_PRICE} from '@upic/domain';
import {factoryAbi,nftAbi,tokenAbi,marketAbi,vaultAbi,orderTypes,domain,assetKey,seedFor} from '@upic/sdk';
const api='http://127.0.0.1:8787';
const d=(await request('/v1/config')).deployment as Deployment;
assert.equal(d.chainId,31337);assert.equal(d.mode,'local');
const client=createPublicClient({chain:anvil,transport:http('http://127.0.0.1:8545')});
assert.equal(await client.getChainId(),31337);
const mnemonic='test test test test test test test test test test test junk';
const alice=mnemonicToAccount(mnemonic,{addressIndex:4}),bob=mnemonicToAccount(mnemonic,{addressIndex:5}),admin=mnemonicToAccount(mnemonic,{addressIndex:0});
async function request(path:string,body?:unknown,cookie?:string):Promise<any>{
 const response=await fetch(api+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const json=await response.json();if(!response.ok)throw Error(json.error||'API '+response.status);return json;
}
async function login(account:typeof alice){
 const {message}=await request('/v1/auth/challenge',{wallet:account.address});
 const response=await fetch(api+'/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,signature:await account.signMessage({message})})});
 assert.equal(response.status,200);const cookie=response.headers.get('set-cookie')?.split(';')[0];assert(cookie);return cookie;
}
async function send(account:typeof alice,address:Address,abi:Abi,functionName:string,args:readonly unknown[],value=0n){
 const wallet=createWalletClient({account,chain:anvil,transport:http('http://127.0.0.1:8545')});
 const tx=await wallet.writeContract({address,abi,functionName,args,value});
 assert.equal((await client.waitForTransactionReceipt({hash:tx})).status,'success');return tx;
}
async function wait<T>(label:string,read:()=>Promise<T|undefined>,minutes=20){
 const until=Date.now()+minutes*60000;while(Date.now()<until){const result=await read();if(result!==undefined)return result;await new Promise(r=>setTimeout(r,5000));}throw Error('Timed out: '+label);
}
const fixture='0x0000000000000000000000000000000000001111' as Address,key=assetKey(1,fixture);
assert.equal((await request('/v1/collections') as Collection[]).some(c=>c.asset_key===key),false,'Use a fresh local deployment/database for this exercise');
await send(alice,d.upic,tokenAbi,'faucet',[alice.address,1000n*10n**18n]);
const aliceCookie=await login(alice),bobCookie=await login(bob);
async function ready(creation:boolean,cookie:string){
 const queued=await wait<any>('verification',async()=>{
  const result=await request('/v1/prepare/'+(creation?'create':'mint'),{assetKey:key},cookie);return result.intentId?result:undefined;
 });
 return wait<any>('render/signature',async()=>{const intent=await request('/v1/intents/'+queued.intentId,undefined,cookie);if(intent.state==='expired')throw Error('Preparation expired');return intent.state==='ready'?intent:undefined;});
}
const initial=await ready(true,aliceCookie),p=initial.payload;
await send(alice,d.factory,factoryAbi,'create',[{...p,sourceChain:BigInt(p.sourceChain),cap:BigInt(p.cap),nonce:BigInt(p.nonce),deadline:BigInt(p.deadline)},initial.signature]);
const nft=await client.readContract({address:d.factory,abi:factoryAbi,functionName:'collections',args:[key]});
assert.equal((await client.readContract({address:nft,abi:nftAbi,functionName:'ownerOf',args:[1n]})).toLowerCase(),alice.address.toLowerCase());
assert.equal(await client.readContract({address:d.upic,abi:tokenAbi,functionName:'balanceOf',args:[alice.address]}),1000n*10n**18n);
await wait('collection index',async()=>(await request('/v1/collections') as Collection[]).find(c=>c.address===nft.toLowerCase()));
const paid=await ready(false,bobCookie),m=paid.payload;
await send(bob,nft,nftAbi,'mint',[{...m,nonce:BigInt(m.nonce),deadline:BigInt(m.deadline)},paid.signature],MINT_PRICE);
assert.equal(paid.edition,2);
const seed=await client.readContract({address:nft,abi:nftAbi,functionName:'seedOf',args:[2n]});
assert.equal(seed,seedFor(31337,d.factory,key,2));
const originalURI=await client.readContract({address:nft,abi:nftAbi,functionName:'tokenURI',args:[2n]});
const originalStage=await client.readContract({address:nft,abi:nftAbi,functionName:'stage'});
await send(alice,nft,nftAbi,'safeTransferFrom',[alice.address,bob.address,1n]);
assert.equal((await client.readContract({address:nft,abi:nftAbi,functionName:'initiator'})).toLowerCase(),alice.address.toLowerCase());
await wait('edition index',async()=>{const v=await request('/v1/collections/'+nft);return v.editions.find((e:any)=>e.edition===2);});
await send(bob,nft,nftAbi,'approve',[d.marketplace,2n]);
const order={seller:bob.address,collection:nft,tokenId:2n,price:10n**17n,expiry:BigInt(Math.floor(Date.now()/1000)+600),nonce:98765n,ownershipNonce:await client.readContract({address:nft,abi:nftAbi,functionName:'transferNonce',args:[2n]})};
const signature=await bob.signTypedData({domain:domain('UPIC Marketplace',31337,d.marketplace),types:orderTypes,primaryType:'Order',message:order});
await request('/v1/orders',{order:JSON.parse(JSON.stringify(order,(_,v)=>typeof v==='bigint'?v.toString():v)),signature},bobCookie);
await send(alice,d.marketplace,marketAbi,'purchase',[order,signature],order.price);
assert.equal(await client.readContract({address:d.vault,abi:vaultAbi,functionName:'claimable',args:[alice.address]}),1375n*10n**13n);
assert.equal(await client.readContract({address:d.vault,abi:vaultAbi,functionName:'buybackReserve'}),27n*10n**15n);
await send(bob,d.vault,vaultAbi,'claim',[bob.address]);
assert.equal(await client.readContract({address:d.vault,abi:vaultAbi,functionName:'claimable',args:[bob.address]}),0n);
const supply=await client.readContract({address:d.upic,abi:tokenAbi,functionName:'totalSupply'});
await send(admin,d.vault,vaultAbi,'executeBuyback',[27n*10n**15n,27n*10n**18n,BigInt(Math.floor(Date.now()/1000)+600)]);
assert.equal(await client.readContract({address:d.upic,abi:tokenAbi,functionName:'totalSupply'}),supply-27n*10n**18n);
await fetch('http://127.0.0.1:3890/fixture/price',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quoteReserveUnits:'2000000000000'})});
await wait('permanent evolution',async()=>{const stage=await client.readContract({address:nft,abi:nftAbi,functionName:'stage'});return stage>=4?stage:undefined;});
await wait('new media publication',async()=>{const uri=await client.readContract({address:nft,abi:nftAbi,functionName:'tokenURI',args:[2n]});return uri!==originalURI?uri:undefined;});
assert.equal(await client.readContract({address:nft,abi:nftAbi,functionName:'seedOf',args:[2n]}),seed);
assert.equal(await client.readContract({address:nft,abi:nftAbi,functionName:'archives',args:[2n,originalStage]}),originalURI);
process.stdout.write('Local lifecycle passed: Genesis, paid edition, ownership, sale, claims, buyback/burn, evolution and preserved identity.\n');
