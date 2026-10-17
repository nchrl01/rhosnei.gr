import {coordinator,type Env} from './env';
export function canonicalJSON(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON((value as Record<string,unknown>)[k])).join(',')+'}';
}
export async function sha256(value:unknown){const raw=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJSON(value))));return '0x'+Array.from(raw,b=>b.toString(16).padStart(2,'0')).join('');}
export async function pinJSON(env:Env,value:unknown):Promise<string>{
 if(env.MODE==='local'){
  const form=new FormData();form.append('file',new Blob([canonicalJSON(value)],{type:'application/json'}),'evidence.json');
  const r=await fetch((env.IPFS_API||'http://127.0.0.1:5001')+'/api/v0/add?cid-version=1&pin=true',{method:'POST',body:form});
  if(!r.ok)throw Error('local-pinning-failed');return 'ipfs://'+(await r.json() as {Hash:string}).Hash;
 }
 if(!env.PINATA_JWT)throw Error('pinning-unconfigured');
 const reserve=await coordinator(env).fetch('https://internal/storage/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bytes:new TextEncoder().encode(canonicalJSON(value)).length,files:1})});
 if(!reserve.ok)throw Error('archive-budget-exhausted');
 const r=await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS',{method:'POST',headers:{Authorization:'Bearer '+env.PINATA_JWT,'Content-Type':'application/json'},body:JSON.stringify({pinataContent:value,pinataOptions:{cidVersion:1}}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('pinning-failed');const data=await r.json() as {IpfsHash:string};return 'ipfs://'+data.IpfsHash;
}
export function gateway(env:Env,uri:string){
 if(!/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._-]+)*$/.test(uri))throw Error('invalid-archive-uri');
 const base=env.PINATA_GATEWAY;if(!base)throw Error('gateway-unconfigured');return base.replace(/\/$/,'')+'/ipfs/'+uri.slice(7);
}
export async function retrieveJSON(env:Env,uri:string){const r=await fetch(gateway(env,uri),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('archive-unavailable');if(Number(r.headers.get('Content-Length'))>250000)throw Error('archive-too-large');const raw=await r.text();if(raw.length>250000)throw Error('archive-too-large');return JSON.parse(raw);}
