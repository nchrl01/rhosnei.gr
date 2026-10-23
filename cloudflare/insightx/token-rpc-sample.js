// Bounded observed participant sample, never a holder census or inferred balance.
const ADDRESS=/^0x[\da-f]{40}$/i,WORD=/^0x[\da-f]{64}$/i,HASH=/^0x[\da-f]{64}$/i;
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const URL='https://xdc.public-rpc.com';
const fail=reason=>{throw Object.assign(Error(reason),{reason});};
function amount(raw,decimals){const digits=BigInt(raw).toString().padStart(decimals+1,'0');const n=Number(decimals?digits.slice(0,-decimals)+'.'+digits.slice(-decimals):digits);return Number.isFinite(n)&&n>0?n:null;}
export async function xdcTokenSample(address,{reserve=()=>true}={}){
 if(!ADDRESS.test(address))fail('rpc-invalid-address');address=address.toLowerCase();let serial=0;
 async function batch(calls){
  if(calls.length>8){const values=[];for(let i=0;i<calls.length;i+=8)values.push(...await batch(calls.slice(i,i+8)));return values;}
  if(!reserve())fail('daily-budget-exhausted');
  const body=calls.map(([method,params])=>({jsonrpc:'2.0',id:++serial,method,params}));
  const response=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)fail('rpc-http-'+response.status);
  const data=await response.json();if(!Array.isArray(data)||data.length!==body.length)fail('rpc-invalid-response');
  const byID=new Map(data.map(row=>[row.id,row]));
  return body.map(call=>{const row=byID.get(call.id);if(!row||row.error||!Object.hasOwn(row,'result'))fail('rpc-read-failed');return row.result;});
 }
 const [chain,tip]=await batch([['eth_chainId',[]],['eth_getBlockByNumber',['latest',false]]]);
 if(chain!=='0x32'||!/^0x[\da-f]+$/i.test(tip?.number||''))fail('rpc-chain-mismatch');
 const height=BigInt(tip.number)-12n;if(height<0n)fail('rpc-invalid-block');const tag='0x'+height.toString(16);
 const [block,code,decimalWord]=await batch([['eth_getBlockByNumber',[tag,false]],['eth_getCode',[address,tag]],['eth_call',[{to:address,data:'0x313ce567'},tag]]]);
 if(block?.number!==tag||!HASH.test(block?.hash||'')||!/^0x[\da-f]+$/i.test(block?.timestamp||'')||!/^0x[\da-f]+$/i.test(code||'')||code==='0x0'||!WORD.test(decimalWord||''))fail('rpc-invalid-token');
 const decimals=Number(BigInt(decimalWord));if(decimals<0||decimals>80)fail('rpc-invalid-decimals');
 const sourceAt=Number(BigInt(block.timestamp))*1000;if(!Number.isSafeInteger(sourceAt)||Date.now()-sourceAt>30*60000||sourceAt>Date.now()+60000)fail('rpc-stale-block');
 let logs=[];let from=height;
 for(const depth of [500n,2000n]){
  from=height>=depth-1n?height-depth+1n:0n;
  [logs]=await batch([['eth_getLogs',[{address,fromBlock:'0x'+from.toString(16),toBlock:tag,topics:[TRANSFER]}]]]);
  if(!Array.isArray(logs)||logs.length>10000)fail('rpc-invalid-logs');if(logs.length)break;
 }
 const ids=new Set();
 for(const log of logs.slice(-1000).reverse()){
  if(log.removed||log.address?.toLowerCase()!==address||log.topics?.length!==3||log.topics[0]?.toLowerCase()!==TRANSFER||!WORD.test(log.data||'')||!/^0x[\da-f]+$/i.test(log.blockNumber||''))continue;
  const at=BigInt(log.blockNumber);if(at<from||at>height)continue;
  for(const topic of log.topics.slice(1)){if(!/^0x0{24}[\da-f]{40}$/i.test(topic))continue;const id='0x'+topic.slice(-40).toLowerCase();if(!/^0x0{40}$/.test(id)&&ids.size<32)ids.add(id);}
  if(ids.size===32)break;
 }
 if(!ids.size)fail('rpc-no-participants');
 const wallets=[...ids],balances=await batch(wallets.map(id=>['eth_call',[{to:address,data:'0x70a08231'+id.slice(2).padStart(64,'0')},tag]]));
 const records=[];for(let i=0;i<wallets.length;i++){if(!WORD.test(balances[i]||''))fail('rpc-invalid-balance');const tokenBalance=amount(balances[i],decimals);if(tokenBalance!==null)records.push({id:wallets[i],tokenBalance,balanceRaw:BigInt(balances[i]).toString(),decimals});}
 if(!records.length)fail('rpc-no-balances');
 const [confirmed]=await batch([['eth_getBlockByNumber',[tag,false]]]);if(confirmed?.hash!==block.hash)fail('rpc-block-changed');
 return {network:'xdc',address,state:'snapshot',source:'XDC public RPC · observed token balances',records,decimals,totalHolders:null,complete:false,truncated:false,coverage:'recent-transfer-participants',scope:'recent-token-transfer-participants-current-token-balances',sourceBlock:Number(height),sourceBlockHash:block.hash,sourceAt,fetchedAt:Date.now()};
}
