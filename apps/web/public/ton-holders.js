// Official TonAPI jetton snapshots, read-only and without a private key.
export function tonAddress(value){
 if(typeof value!=='string')return null;
 const raw=/^(-?\d+):([0-9a-f]{64})$/i.exec(value);if(raw)return Number(raw[1])+':'+raw[2].toLowerCase();
 if(!/^[A-Za-z0-9_-]{48}$/.test(value))return null;
 try{
  const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  if(bytes.length!==36||![0x11,0x51].includes(bytes[0]&0x7f))return null;
  let crc=0;for(const byte of bytes.slice(0,34)){crc^=byte<<8;for(let i=0;i<8;i++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}
  if(bytes[34]!==crc>>8||bytes[35]!== (crc&255))return null;
  return (bytes[1]>127?bytes[1]-256:bytes[1])+':'+[...bytes.slice(2,34)].map(b=>b.toString(16).padStart(2,'0')).join('');
 }catch{return null;}
}
let nextRead=0;
async function read(url,signal){
 const wait=Math.max(0,nextRead-Date.now());nextRead=Date.now()+wait+1100;
 if(wait>12000)throw Error('ton-queue-busy');
 if(wait)await new Promise(resolve=>{const timer=setTimeout(resolve,wait);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
 signal?.throwIfAborted();
 const response=await fetch(url,{credentials:'omit',headers:{Accept:'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
 if(!response.ok){if(response.status===429)nextRead=Math.max(nextRead,Date.now()+60000);throw Error(response.status===429?'rate-limited':'ton-http-'+response.status);}
 return response.json();
}
export async function fetchTonHolders(address,{signal}={}){
 const expected=tonAddress(address);if(!expected)return {state:'invalid-token',holders:null};
 try{
  const url='https://tonapi.io/v2/jettons/'+encodeURIComponent(address),metadata=await read(url,signal);
  const decimals=Number(metadata.metadata?.decimals);
  if(tonAddress(metadata.metadata?.address)!==expected||!Number.isInteger(decimals)||decimals<0||decimals>80)throw Error('invalid-token-metadata');
  const data=await read(url+'/holders?limit=100&offset=0',signal),wallets=new Map(),seen=new Set();
  if(!Array.isArray(data.addresses))throw Error('invalid-holder-response');
  for(const row of data.addresses.slice(0,100)){
   const id=tonAddress(row.owner?.address),account=tonAddress(row.address),raw=String(row.balance??'');
   if(!id||!account||seen.has(account)||!/^\d{1,100}$/.test(raw))continue;seen.add(account);
   const padded=raw.padStart(decimals+1,'0'),tokenBalance=Number(decimals?padded.slice(0,-decimals)+'.'+padded.slice(-decimals):padded);
   if(Number.isFinite(tokenBalance)&&tokenBalance>0)wallets.set(id,(wallets.get(id)||0)+tokenBalance);
  }
  const count=Number(data.total??metadata.holders_count),holders=Number.isSafeInteger(count)&&count>0?count:null;
  const holderBalances=[...wallets].map(([id,tokenBalance])=>({id,tokenBalance}));
  return holders||holderBalances.length?{state:'snapshot',holders,holderBalances,lastUpdated:null,source:'TonAPI',approximate:false,fetchedAt:Date.now()}:{state:'unavailable',holders:null};
 }catch(error){return {state:error.message==='rate-limited'?'rate-limited':'unavailable',holders:null};}
}
