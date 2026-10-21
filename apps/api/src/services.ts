import {createPublicClient,createWalletClient,http,keccak256,stringToHex,type Address,type Hex,decodeEventLog,toEventSelector,parseAbi} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {type Evidence,type Collection,type Edition,type Job,type ArtworkInput,type MarketFrame,chainFor,stageFor,decimal,units,ENGINE_VERSION} from '@upic/domain';
import {factoryAbi,nftAbi,marketAbi,tokenAbi,vaultAbi,creationTypes,mintTypes,evolutionTypes,domain,seedFor,assetKey,DOMAINS} from '@upic/sdk';
import {DB} from './db';import {deployment,type Env} from './env';import {verifyPool,type PoolPolicy} from './verification';import {sha256,pinJSON,retrieveJSON} from './archive';
export interface AssetRow {asset_key:Hex;chain:PoolPolicy['chain'];token:Address;pool:Address;policy:PoolPolicy;name:string;symbol:string;approved:boolean;latest:MarketFrame|null;evidence:Evidence|null;confirmed_evidence:Evidence|null;historical_confirmed_evidence:Evidence|null;evidence_hash:Hex|null;evidence_uri:string|null;verified_at:string|null}
export interface Intent {id:string;wallet:Address;asset_key:Hex;collection:Address|null;edition:number;stage:number;payload:Record<string,unknown>;state:string;expires_at:string;artifact?:Record<string,string>}
export const clientFor=(env:Env)=>createPublicClient({transport:http(env.RH_RPC_URL,{batch:true})});
const jsonSafe=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x));
async function finish(db:DB,job:Job,result:unknown,error:string|null=null){return db.rpc<boolean>('upic_job_finish',{p_id:job.id,p_lease:job.lease_token,p_result:result,p_error:error});}
export async function processVerification(env:Env,charge:(count:number)=>Promise<void>){
 const db=new DB(env),job=(await db.rpc<Job[]>('upic_job_take',{p_kind:'verify',p_seconds:300}))[0];if(!job)return;
 try{
  const asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+String(job.payload.assetKey)});if(!asset?.approved||!(asset as AssetRow & {enabled:boolean}).enabled)throw Error('asset-not-approved');
  const historical=job.payload.blockNumber!=null;
  const evidence=await verifyPool(env,asset.policy,asset.asset_key,charge,historical?BigInt(String(job.payload.blockNumber)):undefined),previous=historical?asset.historical_confirmed_evidence:asset.confirmed_evidence;
  if(!previous||evidence.block.timestamp-previous.block.timestamp>=60||evidence.block.timestamp<previous.block.timestamp)await db.call('upic_assets?asset_key=eq.'+asset.asset_key,{[historical?'historical_confirmed_evidence':'confirmed_evidence']:evidence},'PATCH');
  if(!previous||evidence.block.timestamp-previous.block.timestamp<60||evidence.block.timestamp-previous.block.timestamp>300||stageFor(BigInt(previous.capUsd8))<stageFor(BigInt(evidence.capUsd8))){await finish(db,job,{state:'awaiting-persistence'});if(job.payload.blockNumber==null)await db.enqueue('verify','verify:'+asset.asset_key+':'+Math.floor(Date.now()/60000)+':next',{assetKey:asset.asset_key});return;}
  const collection=await db.one<Collection>('upic_collections',{asset_key:'eq.'+asset.asset_key});
  if(collection&&stageFor(BigInt(evidence.capUsd8))<=collection.stage){
   if(!historical)await db.call('upic_assets?asset_key=eq.'+asset.asset_key,{evidence,verified_at:new Date().toISOString()},'PATCH');
   await finish(db,job,{state:'no-new-stage'});return;
  }
  const bundle={evidence,previous,verification:env.MODE==='local'?'LOCAL TEST FIXTURE':'service-reconstructed-chain-data',trust:'authorized-verifier-and-configured-rpc-nodes',policy:asset.policy};
  await db.enqueue('attest','attest:'+asset.asset_key+':'+evidence.block.hash,{assetKey:asset.asset_key,bundle});
  await finish(db,job,{state:'attestation-queued'});
 }catch(error){await finish(db,job,null,safeError(error,'verification-failed'));}
}
// Archival and transaction submission run in their own request budget.
export async function processAttestation(env:Env){
 const db=new DB(env),job=(await db.rpc<Job[]>('upic_job_take',{p_kind:'attest',p_seconds:300}))[0];if(!job)return;
 try{
  const asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+String(job.payload.assetKey)});if(!asset?.approved)throw Error('asset-not-approved');
  const bundle=job.payload.bundle as {evidence:Evidence;previous:Evidence;policy:PoolPolicy},evidence=bundle.evidence;
  const collection=await db.one<Collection>('upic_collections',{asset_key:'eq.'+asset.asset_key}),next=stageFor(BigInt(evidence.capUsd8));
  const d=deployment(env),client=clientFor(env);if(await client.getChainId()!==d.chainId)throw Error('wrong-nft-chain');
  if(collection&&Number(await client.readContract({address:collection.address,abi:nftAbi,functionName:'stage'}))>=next){await finish(db,job,{state:'already-evolved'});return;}
  const hash=await sha256(bundle) as Hex,uri=await pinJSON(env,bundle);
  if(await sha256(await retrieveJSON(env,uri))!==hash)throw Error('evidence-retrieval-mismatch');
  await db.call('upic_assets?asset_key=eq.'+asset.asset_key,{evidence,evidence_hash:hash,evidence_uri:uri,verified_at:new Date().toISOString()},'PATCH');
  if(collection){
   const account=privateKeyToAccount(env.VERIFIER_PRIVATE_KEY);
   const message={next,cap:BigInt(evidence.capUsd8),evidenceHash:hash,evidenceURI:uri,nonce:BigInt('0x'+crypto.randomUUID().replace(/-/g,'')),deadline:BigInt(Math.floor(Date.now()/1000)+600)};
   const signature=await account.signTypedData({domain:domain(DOMAINS.collection,d.chainId,collection.address),types:evolutionTypes,primaryType:'Evolution',message});
   const relayer=privateKeyToAccount(env.RELAYER_PRIVATE_KEY),wallet=createWalletClient({account:relayer,transport:http(env.RH_RPC_URL,{batch:true})});
   const tx=await wallet.writeContract({chain:null,address:collection.address,abi:nftAbi,functionName:'evolve',args:[message.next,message.cap,message.evidenceHash,message.evidenceURI,message.nonce,message.deadline,signature]});
   const receipt=await client.waitForTransactionReceipt({hash:tx});if(receipt.status!=='success')throw Error('evolution-reverted');
   await finish(db,job,{state:'submitted',tx,evidenceURI:uri});
  }else await finish(db,job,{state:'verified',evidenceURI:uri});
 }catch(error){await finish(db,job,null,safeError(error,'attestation-failed'));}
}
export function artworkFor(env:Env,asset:AssetRow,edition:number,stage:number):ArtworkInput {
 const d=deployment(env);if(!asset.evidence)throw Error('missing-evidence');
 const frame=asset.latest&&!asset.latest.stale?asset.latest:{chain:asset.chain,token:asset.token,at:asset.evidence.block.timestamp*1000,priceUsd:decimal(BigInt(asset.evidence.priceUsd18),18),marketCapUsd:decimal(BigInt(asset.evidence.capUsd8)),liquidityUsd:decimal(BigInt(asset.evidence.liquidityUsd8)),volumeUsd:null,source:env.MODE==='local'?'LOCAL TEST FIXTURE':'verified-chain-twap',stale:false,simulated:env.MODE==='local'};
 return {seed:seedFor(d.chainId,d.factory,asset.asset_key,edition),stage,engineVersion:ENGINE_VERSION,frames:[frame],seconds:20};
}
export async function prepare(env:Env,wallet:Address,key:Hex,creation:boolean){
 const d=deployment(env),db=new DB(env),asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+key});
 if(!asset?.approved)throw Error('preview-only-asset');
 const client=clientFor(env);if(await client.getChainId()!==d.chainId)throw Error('wrong-nft-chain');
 if(creation){const [balance,fee]=await Promise.all([client.readContract({address:d.upic,abi:tokenAbi,functionName:'balanceOf',args:[wallet]}),client.readContract({address:d.factory,abi:factoryAbi,functionName:'creationFee'})]);if(balance<fee)throw Error('insufficient-upic');}
 if(!asset.evidence||!asset.verified_at||Date.now()-Date.parse(asset.verified_at)>1800000){await db.enqueue('verify','verify:'+key+':'+Math.floor(Date.now()/60000),{assetKey:key});return {state:'verification-pending'};}
 const c=await db.one<Collection>('upic_collections',{asset_key:'eq.'+key});
 if(creation&&c)throw Error('collection-exists');if(!creation&&!c)throw Error('collection-not-found');
 if(!creation&&c){const price=await client.readContract({address:c.address,abi:nftAbi,functionName:'currentPrice'}).catch(()=>{throw Error('collection-sold-out');});if(await client.getBalance({address:wallet})<price)throw Error('insufficient-mint-balance');}
 const onchain=await clientFor(env).readContract({address:d.factory,abi:factoryAbi,functionName:'collections',args:[key]});
 if(creation&&onchain!=='0x0000000000000000000000000000000000000000')throw Error('collection-exists');
 const current=c?Number(await clientFor(env).readContract({address:c.address,abi:nftAbi,functionName:'stage'})):stageFor(BigInt(asset.evidence.capUsd8));
 const old=await db.one<Intent>('upic_intents',{asset_key:'eq.'+key,wallet:'eq.'+wallet,state:'in.(preparing,ready,submitted)'});
 if(old&&old.stage!==current)await db.call('upic_intents?id=eq.'+old.id,{state:'expired'},'PATCH');
 const intent=(await db.rpc<Intent[]>('upic_reserve',{p_wallet:wallet,p_asset:key,p_collection:c?.address||null,p_stage:current,p_payload:{name:asset.name,symbol:asset.symbol}}))[0]!;
 if(intent.stage!==current)throw Error('stage-changed-reprepare');
 if(intent.state==='preparing'){
  await db.enqueue('render','intent:'+intent.id,{intentId:intent.id,collection:c?.address||null,assetKey:key,edition:intent.edition,stage:current,name:asset.name,symbol:asset.symbol,input:artworkFor(env,asset,intent.edition,current),evidenceURI:asset.evidence_uri,evidenceHash:asset.evidence_hash,verifiedCapUsd8:c?.verified_cap?units(c.verified_cap).toString():asset.evidence.capUsd8,externalURL:env.PUBLIC_APP_URL+'/nft/'+(c?.address||key)+'/'+intent.edition});
 }
 return {state:intent.state,intentId:intent.id,edition:intent.edition,stage:intent.stage};
}
export async function renderFinished(env:Env,job:Job,result:{uri:string;image:string;animation_url:string;manifest:string}){
 const db=new DB(env),payload=job.payload,asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+String(payload.assetKey)});if(!asset?.evidence)throw Error('missing-evidence');
 const metadata=await retrieveJSON(env,result.uri);
 const input=payload.input as ArtworkInput;
 if(metadata.seed!==input.seed||metadata.stage!==input.stage||metadata.engine_version!==ENGINE_VERSION||metadata.edition!==payload.edition||metadata.image!==result.image||metadata.animation_url!==result.animation_url)throw Error('render-identity-mismatch');
 const manifest=await retrieveJSON(env,result.manifest);
 if(await sha256(manifest.input)!==await sha256(input)||metadata.evidence_uri!==payload.evidenceURI)throw Error('render-input-mismatch');
 // Job completion follows durable publication effects so failures remain retryable.
 if(payload.intentId){
  const intent=await db.one<Intent>('upic_intents',{id:'eq.'+String(payload.intentId)});
 if(!intent||Date.parse(intent.expires_at)<Date.now()||['expired','complete'].includes(intent.state)){await finish(db,job,{expired:true});return;}
  if(intent.state==='ready'||intent.state==='submitted'){await finish(db,job,result);return;}
  const d=deployment(env),deadline=BigInt(Math.floor(Date.now()/1000)+600),nonce=BigInt('0x'+intent.id.replace(/-/g,''));
  let message:unknown,signature:Hex;
  if(intent.collection){
   if(Number(await clientFor(env).readContract({address:intent.collection,abi:nftAbi,functionName:'stage'}))!==intent.stage)throw Error('stage-changed-reprepare');
   const mint={recipient:intent.wallet,edition:intent.edition,stage:intent.stage,uri:result.uri,nonce,deadline};message=mint;
   signature=await privateKeyToAccount(env.MINT_PRIVATE_KEY).signTypedData({domain:domain(DOMAINS.collection,d.chainId,intent.collection),types:mintTypes,primaryType:'Mint',message:mint});
  }else{
   if(!asset.evidence_hash||!asset.evidence_uri||stageFor(BigInt(asset.evidence.capUsd8))!==intent.stage)throw Error('verification-changed-reprepare');
   const create={sourceChain:BigInt(chainFor(asset.chain).chainId!),token:asset.token,initiator:intent.wallet,stage:intent.stage,cap:BigInt(String(payload.verifiedCapUsd8)),evidenceHash:payload.evidenceHash as Hex,evidenceURI:String(payload.evidenceURI),genesisURI:result.uri,name:asset.name,symbol:asset.symbol,nonce,deadline};message=create;
   signature=await privateKeyToAccount(env.VERIFIER_PRIVATE_KEY).signTypedData({domain:domain(DOMAINS.factory,d.chainId,d.factory),types:creationTypes,primaryType:'Create',message:create});
  }
  await db.call('upic_intents?id=eq.'+intent.id,{state:'ready',artifact:result,payload:jsonSafe(message),signature,expires_at:new Date(Number(deadline)*1000).toISOString()},'PATCH');
 }else{
  await db.call('upic_archives?on_conflict=collection,edition,stage',{collection:payload.collection,edition:payload.edition,stage:payload.stage,uri:result.uri,input,media:result});
  await db.enqueue('publish','publish:'+payload.collection+':'+payload.edition+':'+payload.stage,{collection:payload.collection,edition:payload.edition,stage:payload.stage,uri:result.uri});
 }
 if(!await finish(db,job,result))throw Error('lease-expired');
}
export async function processPublish(env:Env){
 const db=new DB(env),job=(await db.rpc<Job[]>('upic_job_take',{p_kind:'publish',p_seconds:120}))[0];if(!job)return;
 try{const p=job.payload,collection=p.collection as Address,edition=Number(p.edition),stage=Number(p.stage);
  if(await clientFor(env).getChainId()!==deployment(env).chainId)throw Error('wrong-nft-chain');
  const account=privateKeyToAccount(env.MINT_PRIVATE_KEY),wallet=createWalletClient({account,transport:http(env.RH_RPC_URL,{batch:true})});
  const uri=await clientFor(env).readContract({address:collection,abi:nftAbi,functionName:'archives',args:[BigInt(edition),stage]});
  if(uri&&uri!==p.uri)throw Error('immutable-archive-conflict');
  if(!uri){const tx=await wallet.writeContract({chain:null,address:collection,abi:nftAbi,functionName:'publishMetadata',args:[[BigInt(edition)],stage,[String(p.uri)]]});await clientFor(env).waitForTransactionReceipt({hash:tx});}
  await finish(db,job,{published:true});
 }catch(error){await finish(db,job,null,safeError(error,'publish-failed'));}
}
export async function indexChain(env:Env,storage:DurableObjectStorage,charge:import('./providers').Charge){
 const d=deployment(env),db=new DB(env),client=clientFor(env);await charge('rpc',2);
 if(await client.getChainId()!==d.chainId)throw Error('wrong-nft-chain');
 const head=await client.getBlock({blockTag:env.MODE==='local'?'latest':'finalized'});
 const cursor=await storage.get<number>('index-cursor')??d.startBlock;
 const anchor=await storage.get<{number:number;hash:Hex}>('index-anchor');
 if(anchor){await charge('rpc',1);const canonical=await client.getBlock({blockNumber:BigInt(anchor.number)});if(canonical.hash!==anchor.hash){await storage.put('index-reorganization',{number:anchor.number,expected:anchor.hash,actual:canonical.hash});throw Error('nft-finalized-reorganization');}}
 if(cursor>Number(head.number)+1)throw Error('nft-chain-rewound');
 const to=Math.min(cursor+499,Number(head.number));if(to<cursor)return;
 const collections=await db.list<Collection>('upic_collections'),addresses=[d.factory,d.marketplace,...collections.map(c=>c.address)];
 await charge('rpc',1);const logs=await client.getLogs({address:addresses,fromBlock:BigInt(cursor),toBlock:BigInt(to)});
 const recorded=await db.list<{tx:string;log_index:number}>('upic_chain_events',{chain_id:'eq.'+d.chainId,and:'(block_number.gte.'+cursor+',block_number.lte.'+to+')',select:'tx,log_index'});
 const known=new Set(recorded.map(r=>r.tx+':'+r.log_index));let processed=0;
 const events=parseAbi([...factoryAbi,...nftAbi,...marketAbi].filter((v:any)=>v.type==='event').map((v:any)=>`event ${v.name}(${v.inputs.map((x:any)=>x.type+(x.indexed?' indexed':'')+' '+x.name).join(',')})`));
 for(const log of logs){
  let event:any;try{event=decodeEventLog({abi:events,data:log.data,topics:log.topics});}catch{continue;}
  const eventKey=log.transactionHash+':'+log.logIndex;if(known.has(eventKey))continue;
  if(processed>=4)break;processed++;
  const args=event.args;
  if(event.eventName==='CollectionCreated'){
   const asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+String(args.assetKey)});if(!asset)throw Error('unknown-onchain-asset');
   await db.call('upic_collections?on_conflict=address',{address:String(args.collection).toLowerCase(),asset_key:args.assetKey,chain:asset.chain,token:asset.token,name:asset.name,symbol:asset.symbol,initiator:String(args.initiator).toLowerCase(),stage:stageFor(BigInt(asset.evidence?.capUsd8||'0')),minted:1},'POST');
   // Child mint logs precede the factory event; synchronize Genesis explicitly.
   await syncEdition(env,db,String(args.collection).toLowerCase() as Address,1);
   await db.call('upic_intents?asset_key=eq.'+args.assetKey+'&edition=eq.1',{state:'complete'},'PATCH');
   await charge('rpc',1);logs.push(...await client.getLogs({address:args.collection,fromBlock:BigInt(cursor),toBlock:BigInt(to)}));
  }else if(event.eventName==='Transfer'){
   const collection=await db.one<Collection>('upic_collections',{address:'eq.'+log.address.toLowerCase()});if(collection)await syncEdition(env,db,collection.address,Number(args.tokenId));
  }else if(event.eventName==='Evolution'){
   const address=log.address.toLowerCase();const collection=await db.one<Collection>('upic_collections',{address:'eq.'+address});if(collection){
    if(Number(args.stage)>=collection.stage)await db.call('upic_collections?address=eq.'+address,{stage:Number(args.stage),verified_cap:decimal(args.cap),evidence_uri:args.evidenceURI},'PATCH');
    const asset=await db.one<AssetRow>('upic_assets',{asset_key:'eq.'+collection.asset_key});if(asset?.evidence){
     const bundle=await retrieveJSON(env,args.evidenceURI);
     if(await sha256(bundle)!==args.evidenceHash)throw Error('onchain-evidence-mismatch');
     const stageAsset={...asset,evidence:bundle.evidence as Evidence,latest:null};
     const editions=await db.list<Edition>('upic_editions',{collection:'eq.'+address});
     const jobs=editions.filter(e=>e.media_stage<Number(args.stage)).map(e=>({kind:'render',key:'evolution:'+address+':'+e.edition+':'+args.stage,payload:{collection:address,assetKey:collection.asset_key,edition:e.edition,stage:Number(args.stage),name:asset.name,symbol:asset.symbol,input:artworkFor(env,stageAsset,e.edition,Number(args.stage)),evidenceURI:args.evidenceURI,verifiedCapUsd8:args.cap.toString(),externalURL:env.PUBLIC_APP_URL+'/nft/'+address+'/'+e.edition}}));
     await db.rpc('upic_enqueue_many',{p_jobs:jobs});
    }
   }
  }else if(event.eventName==='MediaPublished')await syncEdition(env,db,log.address,Number(args.tokenId));
  else if(event.eventName==='Sale'||event.eventName==='Cancelled')await db.call('upic_orders?seller=eq.'+String(args.seller).toLowerCase()+'&nonce=eq.'+args.nonce,{active:false},'PATCH');
  await db.call('upic_chain_events',{chain_id:d.chainId,block_number:Number(log.blockNumber),block_hash:log.blockHash,tx:log.transactionHash,log_index:log.logIndex,event:jsonSafe(event)});
  known.add(eventKey);
 }
 if(processed>=4)return; // Resume the same range next invocation; writes are idempotent.
 await charge('rpc',1);const anchorBlock=await client.getBlock({blockNumber:BigInt(to)});
 await storage.put('index-anchor',{number:to,hash:anchorBlock.hash});
 await storage.put('index-cursor',to+1);
}
function safeError(error:unknown,fallback:string){return error instanceof Error&&/^[a-z][a-z0-9-]{0,80}$/.test(error.message)?error.message:fallback;}
async function syncEdition(env:Env,db:DB,collection:Address,edition:number){
 const old=await db.one<Edition>('upic_editions',{collection:'eq.'+collection.toLowerCase(),edition:'eq.'+edition});
 const client=clientFor(env),blockTag=env.MODE==='local'?'latest' as const:'finalized' as const;
 const [owner,seed,uri,stage,nonce,minted,cap]=await Promise.all([
  client.readContract({address:collection,abi:nftAbi,functionName:'ownerOf',args:[BigInt(edition)],blockTag}),client.readContract({address:collection,abi:nftAbi,functionName:'seedOf',args:[BigInt(edition)],blockTag}),
  client.readContract({address:collection,abi:nftAbi,functionName:'tokenURI',args:[BigInt(edition)],blockTag}),client.readContract({address:collection,abi:nftAbi,functionName:'stage',blockTag}),
  client.readContract({address:collection,abi:nftAbi,functionName:'transferNonce',args:[BigInt(edition)],blockTag}),client.readContract({address:collection,abi:nftAbi,functionName:'minted',blockTag}),client.readContract({address:collection,abi:nftAbi,functionName:'highestVerifiedCap',blockTag})]);
 const metadata=await retrieveJSON(env,uri);
 await db.call('upic_editions?on_conflict=collection,edition',{collection:collection.toLowerCase(),edition,owner:owner.toLowerCase(),seed,metadata_uri:uri,stage,media_stage:Number(metadata.stage),image:metadata.image,animation_url:metadata.animation_url,transfer_nonce:nonce.toString()},'POST');
 await db.call('upic_collections?address=eq.'+collection.toLowerCase(),{minted:Number(minted),stage,verified_cap:decimal(cap)},'PATCH');
 if(old&&(old.owner!==owner.toLowerCase()||old.transfer_nonce!==nonce.toString()))await db.call('upic_orders?collection=eq.'+collection.toLowerCase()+'&edition=eq.'+edition,{active:false},'PATCH');
 await db.call('upic_intents?collection=eq.'+collection.toLowerCase()+'&edition=eq.'+edition,{state:'complete'},'PATCH');
 const exists=await db.one('upic_archives',{collection:'eq.'+collection.toLowerCase(),edition:'eq.'+edition,stage:'eq.'+metadata.stage});
 if(!exists&&metadata.manifest){const manifest=await retrieveJSON(env,metadata.manifest);await db.call('upic_archives',{collection:collection.toLowerCase(),edition,stage:metadata.stage,uri,input:manifest.input,media:{uri,image:metadata.image,animation_url:metadata.animation_url,manifest:metadata.manifest}});}
}
