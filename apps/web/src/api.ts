import type {Deployment} from '@upic/domain';
export const API=(import.meta.env.VITE_API_URL||(import.meta.env.DEV?'http://localhost:8787':'/api')).replace(/\/$/,'');
const explanations:Record<string,string>={
 'platform-api-not-deployed':'The testnet service is not connected yet. You can still use the instrument and labs. See Setup in the staging guide.',
 'deployment-unconfigured':'Testnet contracts are not configured for this environment yet. Setup shows what is available.',
 'service-unavailable':'The testnet service is temporarily unavailable. Try Refresh; your wallet has not been charged by this request.',
 'authentication-required':'Sign in with your test wallet to continue.',
 'session-expired':'Your sign-in expired. Connect your wallet and sign in again.',
 'invalid-session':'Please sign in again to reconnect this wallet session.',
 'invalid-sign-in':'The sign-in request expired or does not match this staging site. Connect again to get a fresh request.',
 'insufficient-upic':'Your wallet needs more test tokens for the creation fee. Open Wallet → Get test tokens.',
 'insufficient-mint-balance':'Your wallet needs more test ETH for this mint. Open Wallet → Request test gas.',
 'preview-only-asset':'This coin is available for preview only. Collection creation requires approved blockchain verification.',
 'collection-exists':'A collection already exists for this coin. Open Collections to mint an available edition.',
 'collection-not-found':'This collection is not indexed yet. Refresh after the transaction settles.',
 'collection-sold-out':'All editions in this collection have been minted. Check the marketplace for listed editions.',
 'stage-changed-reprepare':'The artwork evolved while being prepared. Prepare it again for the current stage.',
 'verification-changed-reprepare':'New blockchain evidence arrived. Prepare the artwork again before minting.',
 'request-rate-limited':'Too many requests arrived together. Wait a moment, then try again.',
 'wrong-nft-chain':'The service and testnet configuration disagree. Transactions are paused until setup is corrected.',
 'faucet-unconfigured':'The test gas faucet is not configured. Use the faucet link in the staging guide.',
 'faucet-rate-limited':'The faucet has a cooldown. Try again later or use the network faucet.',
 'faucet-empty':'The test gas faucet needs a refill. Use the network faucet in the staging guide.',
 'intent-not-found':'This preparation is no longer available for your wallet. Prepare the artwork again.',
};
export class ApiError extends Error {
 constructor(public code:string,public status=0){super(explanations[code]||(/budget|limit/.test(code)?'This service has reached its request allowance. Try again later.':code.startsWith('database-')?'The collection database is unavailable. Try Refresh in a moment.':'The request could not be completed. Try again or check Setup in the staging guide.'));}
}
export async function api<T>(path:string,body?:unknown):Promise<T>{
 let response:Response;
 try{response=await fetch(API+path,{credentials:'include',method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});}
 catch(e){throw Error(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError')?'The testnet service took too long to respond. Please try again.':'Cannot reach the testnet service. Check your connection and staging access.');}
 const json=await response.json().catch(()=>null);
 if(!response.ok)throw new ApiError(typeof json?.error==='string'?json.error:response.status===401?'authentication-required':response.status===403?'access-required':'service-unavailable',response.status);
 if(json===null)throw Error('The service returned an unexpected page. Reopen staging and sign in to its access screen if needed.');
 return json as T;
}
export type Config={deployment:Deployment;gateway:string;appURL:string};
export type StagingStatus={mode:'local'|'testnet';chainId:number;engineVersion:string;services:{database:boolean;storage:boolean;rendererAuthorization:boolean;verification:boolean;gasFaucet:boolean};databaseReachable:boolean|null;renderer:{state:'unknown'|'waiting'|'working'|'failed';queued:number|null;leased:number|null;failed:number|null}};
export const errorText=(e:unknown)=>{
 if(e&&typeof e==='object'&&'code' in e&&e.code===4001)return 'Request cancelled in your wallet. Nothing was submitted.';
 if(e&&typeof e==='object'&&'shortMessage' in e&&typeof e.shortMessage==='string')return e.shortMessage;
 return e instanceof Error?e.message:'The action could not be completed. Please try again.';
};
