import {getWalletAccount,subscribeWalletAccount} from './wallet-session.js?v=448';

const ADDRESS=/^0x[0-9a-f]{40}$/i,ZERO=/^0x0{40}$/i;
const canonical=value=>typeof value==='string'?(ADDRESS.test(value)?value.toLowerCase():value):'';
const node=(tag,text,className)=>{const element=document.createElement(tag);if(text)element.textContent=text;if(className)element.className=className;return element;};
const checks=new Map();
function publicURL(value){
 if(typeof value!=='string'||!value.trim())return null;
 try{const url=new URL(value,document.baseURI);return !url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&url.origin===location.origin)?url:null;}catch{return null;}
}
export function collectionIdentity(pair){
 if(!pair)return null;
 const native=pair.nativeAsset,chain=native?.chain||pair.chainId,token=native?.address||pair.baseToken?.address;
 if(typeof chain!=='string'||!chain||typeof token!=='string'||!token||pair.source==='ccxt'&&!native||chain==='exchange')return null;
 return {chain:chain.toLowerCase(),token:canonical(token)};
}
export function matchingCollection(rows,identity){
 if(!identity||!Array.isArray(rows))return null;
 const matches=rows.filter(row=>row?.chain===identity.chain&&canonical(row.token)===identity.token);
 return matches.length===1&&ADDRESS.test(matches[0].address)&&!ZERO.test(matches[0].address)?matches[0]:null;
}
async function readJSON(url,signal){
 const response=await fetch(url,{signal,credentials:'omit',headers:{Accept:'application/json'}});
 if(!response.ok){const error=Error('Collection status unavailable');error.status=response.status;throw error;}
 if(!response.headers.get('content-type')?.includes('application/json')){const error=Error('Collection service is not configured');error.unconfigured=true;throw error;}
 return response.json();
}
// The static GitHub deployment has no /api binding. An explicitly configured
// API, or the existing same-origin Pages proxy, is required for registry reads.
function apiFor(panel){
 const configured=panel.dataset.collectionApi||document.querySelector('meta[name="upic-api-base"]')?.content;
 if(!configured&&location.hostname.endsWith('.github.io'))return null;
 const api=publicURL(configured||new URL('/api/',location.origin).href);
 if(!api||api.origin!==location.origin||api.search||api.hash)return null;
 api.pathname=api.pathname.replace(/\/?$/,'/');return api;
}
function registry(api,force=false){
 const key=api.href,previous=checks.get(key);
 if(!force&&previous&&Date.now()-previous.at<60000)return previous.promise;
 const promise=(async()=>{
  const signal=AbortSignal.timeout(10000),config=await readJSON(new URL('v1/config',api),signal),deployment=config?.deployment;
  if(!deployment||!ADDRESS.test(deployment.factory)||ZERO.test(deployment.factory)||!Number.isSafeInteger(deployment.chainId)||deployment.chainId<=0)throw Error('Collection status unavailable');
  // Existing local/testnet deployments must never become live owner claims.
  if(deployment.mode!=='mainnet')return {unavailable:true,notLive:true};
  const app=publicURL(config.appURL);if(!app)throw Error('Collection app unavailable');
  const collections=await readJSON(new URL('v1/collections',api),signal);
  if(!Array.isArray(collections)||collections.length>100)throw Error('Collection status unavailable');
  return {collections,app};
 })().catch(error=>({unavailable:true,notLive:error.status===404||error.unconfigured===true}));
 checks.set(key,{at:Date.now(),promise});return promise;
}
export function createNftOwnerPreview(panel){
 if(!panel)return {setMarket(){},close(){}};
 const player=document.querySelector('.instrument'),summary=panel.querySelector('.coin-ai-summary');
 if(summary&&player){summary.classList.add('coin-background');player.append(summary);}
 panel.replaceChildren();panel.className='coin-collection-status';panel.setAttribute('aria-label','Coin collection');panel.hidden=true;
 const advanced=document.getElementById('advanced-panel')||document.getElementById('advanced-diagnostics');
 if(advanced&&player?.contains(advanced))advanced.after(panel);else player?.append(panel);
 const heading=node('h3','Coin collection'),state=node('p','','coin-collection-state'),note=node('p','','coin-collection-note'),owner=node('p','','coin-collection-owner');
 state.setAttribute('role','status');state.setAttribute('aria-live','polite');
 const actions=node('div',null,'coin-collection-actions'),browse=node('a','Browse collection'),retry=node('button','Retry');
 retry.type='button';browse.href=new URL('upic/marketplace/',document.baseURI).href;actions.append(browse,retry);panel.append(heading,state,note,owner,actions);
 let market=null,identity=null,epoch=0,controller,closed=false,genesisOwner='';
 function renderOwner(){
  const account=getWalletAccount();owner.hidden=!genesisOwner;
  owner.textContent=genesisOwner?'Genesis edition owner · '+genesisOwner+(account?.address?.toLowerCase()===genesisOwner.toLowerCase()?' · Your wallet':''):'';
 }
 function unavailable(notLive=false){
  state.textContent=notLive?'Tokenization is not available yet':'Collection status unavailable';
  note.textContent=notLive?'':'The collection and owner could not be checked. Please try again.';note.hidden=notLive;retry.hidden=notLive;
 }
 function reset(){
  genesisOwner='';owner.hidden=true;owner.textContent='';
  browse.textContent='Browse collection';browse.href=new URL('upic/marketplace/',document.baseURI).href;retry.hidden=true;retry.disabled=false;note.hidden=false;
 }
 async function load(force=false){
  const current=++epoch;controller?.abort();controller=new AbortController();reset();
  if(!market){panel.hidden=true;return;}panel.hidden=false;
  if(!identity){state.textContent='Collection unavailable for this market';note.textContent='An on-chain coin identity is needed to check its collection.';return;}
  const api=apiFor(panel);if(!api){unavailable(true);return;}
  state.textContent='Checking collection…';note.textContent='';retry.disabled=true;
  try{
   const result=await registry(api,force);if(closed||current!==epoch)return;
   if(result.unavailable){unavailable(result.notLive);return;}
   const collection=matchingCollection(result.collections,identity);
   // This endpoint returns only100 rows; a missing match is not proof that a
   // collection does not exist. The signed intent flow must establish eligibility.
   if(!collection){unavailable();return;}
   const details=await readJSON(new URL('v1/collections/'+collection.address,api),AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]));
   if(closed||current!==epoch)return;
   if(details.collection?.chain!==identity.chain||canonical(details.collection?.token)!==identity.token||canonical(details.collection?.address)!==canonical(collection.address))throw Error('Collection identity mismatch');
   const genesis=Array.isArray(details.editions)?details.editions.find(item=>item.edition===1&&canonical(item.collection)===canonical(collection.address)):null;
   const app=new URL(result.app);app.search='';app.hash='';app.pathname=app.pathname.replace(/\/$/,'')+'/nft/'+collection.address+'/1';
   state.textContent='Already in the collection';note.textContent='Ownership shown from the collection index.';retry.hidden=false;
   browse.textContent='View collection';browse.href=app.href;
   genesisOwner=ADDRESS.test(genesis?.owner)&&!ZERO.test(genesis.owner)?genesis.owner:'';renderOwner();
   if(!genesisOwner)note.textContent='The collection is indexed; its current owner is unavailable.';
  }catch{if(!closed&&current===epoch)unavailable();}
  finally{if(current===epoch)retry.disabled=false;}
 }
 retry.addEventListener('click',()=>void load(true));
 const unsubscribe=subscribeWalletAccount(renderOwner);
 return {
  setMarket(pair){if(closed)return;market=pair;identity=collectionIdentity(pair);if(new URLSearchParams(location.search).get('capture')==='live'){panel.hidden=true;return;}return load();},
  close(){closed=true;epoch++;controller?.abort();unsubscribe();panel.remove();},
 };
}
