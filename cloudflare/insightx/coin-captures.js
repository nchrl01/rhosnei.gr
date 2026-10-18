import catalogue from './coin-capture-catalogue.json' with {type:'json'};
const ISSUER='https://token.actions.githubusercontent.com',JWKS=ISSUER+'/.well-known/jwks';
const REPOSITORY='nchrl01/rhosnei.gr',WORKFLOW=REPOSITORY+'/.github/workflows/captures.yml@refs/heads/main';
const KIND='live-player-frame-v1',MAX_IMAGE=750000,MAX_BODY=1048576,MAX_TOTAL=64*1024*1024;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const captureKey=(chain,address)=>chain+':'+(/^0x[\da-f]{40}$/i.test(address||'')?address.toLowerCase():address);
const identities=new Map();
for(const coin of catalogue.coins){for(const p of [{chain:coin.chain,address:coin.address},...(coin.platforms||[])])if(p.chain&&p.address){const key=captureKey(p.chain,p.address);if(!identities.has(key))identities.set(key,{key,chain:p.chain,network:p.chain,address:/^0x[\da-f]{40}$/i.test(p.address)?p.address.toLowerCase():p.address,id:coin.id,symbol:coin.symbol,name:coin.name});}}
export function captureIdentity(network,address){return typeof network==='string'&&typeof address==='string'?identities.get(captureKey(network,address))||null:null;}
export const captureCapabilities={central:true,publisher:'GitHub Actions OIDC',catalogueIdentities:identities.size,maxImageBytes:MAX_IMAGE,maxStorageBytes:MAX_TOTAL};
function fail(message,status=400){const error=Error(message);error.status=status;throw error;}
async function boundedText(response,limit){
 if(Number(response.headers.get('Content-Length'))>limit)fail('Request too large',413);
 const reader=response.body?.getReader();if(!reader)return '';const chunks=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();fail('Request too large',413);}chunks.push(value);}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(bytes);
}
function decodeURL(text){if(typeof text!=='string'||!/^[A-Za-z0-9_-]+$/.test(text))fail('Invalid publisher token',401);try{return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-text.length%4)%4)),c=>c.charCodeAt(0));}catch{fail('Invalid publisher token',401);}}
let cachedKeys=null,keysAt=0,keysPending;
async function githubKeys(){
 if(cachedKeys&&Date.now()-keysAt<300000)return cachedKeys;
 if(keysPending)return keysPending;
 keysPending=(async()=>{const response=await fetch(JWKS,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});if(!response.ok)fail('Publisher keys unavailable',503);const data=JSON.parse(await boundedText(response,65536));if(!Array.isArray(data.keys)||!data.keys.length||data.keys.length>20)fail('Publisher keys unavailable',503);cachedKeys=data.keys;keysAt=Date.now();return cachedKeys;})();
 try{return await keysPending;}finally{keysPending=null;}
}
export async function verifyCapturePublisher(token,{now=Math.floor(Date.now()/1000),jwks}={}){
 if(typeof token!=='string'||token.length>16384)fail('Invalid publisher token',401);
 const parts=token.split('.');if(parts.length!==3)fail('Invalid publisher token',401);
 let header,claims;try{header=JSON.parse(new TextDecoder().decode(decodeURL(parts[0])));claims=JSON.parse(new TextDecoder().decode(decodeURL(parts[1])));}catch{fail('Invalid publisher token',401);}
 if(header?.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||header.kid.length>200||header.crit||header.jku||header.jwk||header.x5u)fail('Invalid publisher token',401);
 if(claims?.iss!==ISSUER||claims.aud!=='upic-live-captures'||claims.repository!==REPOSITORY||claims.ref!=='refs/heads/main'||(claims.job_workflow_ref??claims.workflow_ref)!==WORKFLOW)fail('Untrusted capture publisher',401);
 if(!['schedule','workflow_dispatch','push'].includes(claims.event_name))fail('Untrusted capture trigger',401);
 if(!Number.isInteger(claims.exp)||!Number.isInteger(claims.iat)||claims.exp<=now||claims.iat>now+30||claims.iat<now-900||claims.exp<=claims.iat||claims.exp-claims.iat>900||(claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>now+30)))fail('Expired or invalid publisher token',401);
 const keys=jwks||await githubKeys(),matches=keys.filter(key=>key.kid===header.kid&&key.kty==='RSA'&&(!key.alg||key.alg==='RS256')&&(!key.use||key.use==='sig'));
 if(matches.length!==1)fail('Unknown publisher key',401);
 try{const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeURL(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));if(!valid)fail('Invalid publisher signature',401);}catch{fail('Invalid publisher signature',401);}
 return claims;
}
export async function authenticateCaptureRequest(request){const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(request.headers.get('Authorization')||'');if(!match)fail('Publisher authentication required',401);return verifyCapturePublisher(match[1]);}
export function validateCapturePayload(body,now=Date.now()){
 const input=body?.metadata,identity=captureIdentity(input?.chain??input?.network,input?.address);
 if(!identity||input.captureKind!==KIND||(input.key!==undefined&&input.key!==identity.key))fail('Capture identity is not in the catalogue',400);
 if(!Number.isSafeInteger(input.capturedAt)||input.capturedAt<=0||input.capturedAt>now+1000||input.capturedAt<now-86400000)fail('Invalid capture timestamp',400);
 const text=body.imageBase64;if(typeof text!=='string'||text.length>Math.ceil(MAX_IMAGE/3)*4||text.length%4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))fail('Invalid WebP encoding',400);
 let bytes;try{bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));}catch{fail('Invalid WebP encoding',400);}
 if(bytes.length<20||bytes.length>MAX_IMAGE||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP'||new DataView(bytes.buffer).getUint32(4,true)!==bytes.length-8||!['VP8 ','VP8L','VP8X'].includes(String.fromCharCode(...bytes.slice(12,16))))fail('Invalid WebP image',400);
 const metadata={...identity,captureKind:KIND,capturedAt:input.capturedAt,source:'Live UPIC player frame'};
 for(const key of ['marketCap','liquidity','holders'])if(input[key]!=null){if(!Number.isFinite(input[key])||input[key]<0||(key==='holders'&&!Number.isSafeInteger(input[key])))fail('Invalid capture metrics');metadata[key]=input[key];}
 for(const key of ['holderFetchedAt','marketObservedAt','renderedAt'])if(input[key]!=null){if(!Number.isSafeInteger(input[key])||input[key]<=0||input[key]>input.capturedAt+1000)fail('Invalid source timestamp');metadata[key]=input[key];}
 if(input.coverage!=null){if(typeof input.coverage!=='string'||input.coverage.length>180||/[\u0000-\u001f]/.test(input.coverage))fail('Invalid coverage');metadata.coverage=input.coverage;}
 if(input.sourceDataHash!=null){if(typeof input.sourceDataHash!=='string'||!/^[a-f0-9]{64}$/i.test(input.sourceDataHash))fail('Invalid source hash');metadata.sourceDataHash=input.sourceDataHash.toLowerCase();}
 return {metadata,bytes};
}
function publicMetadata(raw,origin){const metadata=typeof raw==='string'?JSON.parse(raw):raw;const imageURL='/coin-captures/image?'+new URLSearchParams({key:metadata.key,v:String(metadata.capturedAt)});return {...metadata,imageURL,snapshot:new URL(imageURL,origin).href};}
export class CoinCaptures{
 constructor(ctx){this.ctx=ctx;this.sql=ctx.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS live_coin_captures (key TEXT PRIMARY KEY, metadata TEXT NOT NULL, captured INTEGER NOT NULL, image BLOB NOT NULL, bytes INTEGER NOT NULL)');for(const row of this.sql.exec('SELECT key FROM live_coin_captures').toArray())if(!identities.has(row.key))this.sql.exec('DELETE FROM live_coin_captures WHERE key=?',row.key);}
 async fetch(request){
  const url=new URL(request.url);
  try{
   if(request.method==='POST'&&url.pathname==='/coin-captures'){
    // Authenticate here too: the Durable Object is never an unauthenticated write path.
    await authenticateCaptureRequest(request);
    if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return json({error:'JSON required'},415);
    let body;try{body=JSON.parse(await boundedText(request,MAX_BODY));}catch(error){if(error.status)throw error;fail('Invalid JSON');}
    const {metadata,bytes}=validateCapturePayload(body);
    const result=this.ctx.storage.transactionSync(()=>{
     const previous=this.sql.exec('SELECT captured,bytes FROM live_coin_captures WHERE key=?',metadata.key).toArray()[0];
     if(previous?.captured>=metadata.capturedAt)return 'older';
     const totals=this.sql.exec('SELECT COUNT(*) AS count, COALESCE(SUM(bytes),0) AS total FROM live_coin_captures').toArray()[0];
     if((!previous&&totals.count>=identities.size)||totals.total-(previous?.bytes||0)+bytes.length>MAX_TOTAL)return 'capacity';
     this.sql.exec('INSERT OR REPLACE INTO live_coin_captures(key,metadata,captured,image,bytes) VALUES(?,?,?,?,?)',metadata.key,JSON.stringify(metadata),metadata.capturedAt,bytes.buffer,bytes.length);return 'saved';
    });
    if(result==='older')return json({error:'A newer or identical capture already exists'},409);
    if(result==='capacity')return json({error:'Capture storage limit reached; previous captures retained'},507);
    return json({state:'saved',capture:publicMetadata(metadata,url.origin)},201);
   }
   if(request.method!=='GET')return json({error:'Method not allowed'},405);
   const identity=url.searchParams.has('key')?identities.get(url.searchParams.get('key')):captureIdentity(url.searchParams.get('network'),url.searchParams.get('address'));
   if(url.pathname==='/coin-captures/image'){
    if(!identity)return json({error:'Unknown catalogue identity'},404);
    const row=this.sql.exec('SELECT image,captured FROM live_coin_captures WHERE key=?',identity.key).toArray()[0];if(!row)return json({error:'No live capture yet'},404);
    if(url.searchParams.has('v')&&url.searchParams.get('v')!==String(row.captured))return json({error:'Capture superseded; reload the manifest'},404);
    const etag='"'+row.captured+'"';if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':'no-store'}});
    return new Response(row.image,{headers:{'Content-Type':'image/webp','Cache-Control':'no-store',ETag:etag,'X-Content-Type-Options':'nosniff'}});
   }
   if(url.pathname!=='/coin-captures')return json({error:'Not found'},404);
   if(url.searchParams.has('network')||url.searchParams.has('address')||url.searchParams.has('key')){
    if(!identity)return json({error:'Unknown catalogue identity'},404);const row=this.sql.exec('SELECT metadata FROM live_coin_captures WHERE key=?',identity.key).toArray()[0];return row?json(publicMetadata(row.metadata,url.origin)):json({error:'No live capture yet'},404);
   }
   const cursor=url.searchParams.get('cursor')||'';if(cursor.length>512)fail('Invalid cursor');
   const rows=this.sql.exec('SELECT key,metadata,captured FROM live_coin_captures WHERE key>? ORDER BY key LIMIT 1002',cursor).toArray(),page=rows.slice(0,1001);
   return json({version:1,captures:page.map(row=>publicMetadata(row.metadata,url.origin)),asOf:page.length?Math.max(...page.map(row=>row.captured)):null,nextCursor:rows.length>1001?page.at(-1).key:null});
  }catch(error){return json({error:error.status?error.message:'Capture storage unavailable'},error.status||503);}
 }
}
