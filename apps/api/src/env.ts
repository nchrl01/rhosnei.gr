import type {Deployment} from '@upic/domain';
export interface Env {
 MARKET:DurableObjectNamespace;MODE:'local'|'testnet';CHAIN_ID:string;ALLOWED_ORIGIN:string;
 POSTGREST_URL:string;POSTGREST_TOKEN:string;ADMIN_TOKEN:string;RENDERER_TOKEN:string;SESSION_SECRET:string;
 RH_RPC_URL:string;DEPLOYMENT_JSON:string;MINT_PRIVATE_KEY:`0x${string}`;VERIFIER_PRIVATE_KEY:`0x${string}`;RELAYER_PRIVATE_KEY:`0x${string}`;
 OKX_API_KEY:string;OKX_SECRET:string;OKX_PASSPHRASE:string;SOURCE_RPC_JSON:string;
 PINATA_JWT:string;PINATA_GATEWAY:string;PUBLIC_APP_URL:string;
 IPFS_API?:string;
 MAX_ASSETS:string;OKX_BASIC_LIMIT:string;OKX_PREMIUM_LIMIT:string;DEX_RPM:string;
}
export function deployment(env:Env):Deployment {
 const d=JSON.parse(env.DEPLOYMENT_JSON||'{}') as Deployment;
 if(!d.factory||d.chainId!==Number(env.CHAIN_ID)||!['local','testnet'].includes(env.MODE)||d.mode!==env.MODE||d.chainId!==(env.MODE==='local'?31337:46630))throw Error('deployment-unconfigured');
 return d;
}
export const coordinator=(env:Env)=>env.MARKET.get(env.MARKET.idFromName('global-v1'));
