import {createSiweMessage,parseSiweMessage} from 'viem/siwe';
import {createPublicClient,http,type Address,type Hex} from 'viem';
import {DB} from './db';
import type {Env} from './env';
const bytes=(v:string)=>new TextEncoder().encode(v);
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(env:Env){if(env.SESSION_SECRET?.length<32)throw Error('session-unconfigured');return crypto.subtle.importKey('raw',bytes(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function challenge(env:Env,wallet:Address){
 const nonce=crypto.randomUUID().replace(/-/g,'');const expires=new Date(Date.now()+300000);
 await new DB(env).call('upic_auth_nonces',{nonce,wallet:wallet.toLowerCase(),expires_at:expires.toISOString()});
 const origin=new URL(env.PUBLIC_APP_URL);
 return createSiweMessage({domain:origin.host,address:wallet,statement:'Sign in to UPIC. This does not authorize a transaction.',uri:origin.origin,version:'1',chainId:Number(env.CHAIN_ID),nonce,issuedAt:new Date(),expirationTime:expires});
}
export async function login(env:Env,message:string,signature:Hex){
 const parsed=parseSiweMessage(message),origin=new URL(env.PUBLIC_APP_URL);
 if(parsed.domain!==origin.host||parsed.uri!==origin.origin||parsed.chainId!==Number(env.CHAIN_ID)||!parsed.address||!parsed.nonce||!parsed.expirationTime||parsed.expirationTime.getTime()<Date.now())throw Error('invalid-sign-in');
 const client=createPublicClient({transport:http(env.RH_RPC_URL)});
 if(!await client.verifySiweMessage({message,signature,address:parsed.address}))throw Error('invalid-signature');
 if(!await new DB(env).rpc('upic_auth_consume',{p_nonce:parsed.nonce,p_wallet:parsed.address.toLowerCase()}))throw Error('nonce-used');
 const payload=b64(bytes(JSON.stringify({wallet:parsed.address.toLowerCase(),exp:Date.now()+3600000})));
 return payload+'.'+b64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),bytes(payload))));
}
export async function walletFor(env:Env,cookie:string):Promise<Address>{
 const token=/(?:^|;\s*)upic_session=([^;]+)/.exec(cookie)?.[1];if(!token)throw Error('authentication-required');
 const [payload,signature]=token.split('.');if(!payload||!signature||!await crypto.subtle.verify('HMAC',await key(env),unb64(signature),bytes(payload)))throw Error('invalid-session');
 const data=JSON.parse(new TextDecoder().decode(unb64(payload))) as {wallet:Address;exp:number};if(data.exp<Date.now())throw Error('session-expired');return data.wallet;
}
export async function authorized(supplied:string,expected:string){
 if(!expected||expected.length<32)return false;
 const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(v)));
 const [a,b]=await Promise.all([hash(supplied.replace(/^Bearer /,'')),hash(expected)]);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]!^b[i]!;return diff===0;
}
