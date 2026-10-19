import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchFinalEvmNativeBalances, FINAL_EVM_NATIVE_ASSETS} from '../cloudflare/insightx/native-provider-evm-final.js';
const now = 1792430000000;
const ids = Array.from({length:8},(_,i)=>'0x'+String(i+1).padStart(40,'0'));
const config = {
 MON:['https://rpc.monad.xyz',143],S:['https://rpc.soniclabs.com',146],SOMI:['https://api.infra.mainnet.somnia.network',5031],
 WEMIX:['https://api.wemix.com',1111],XDC:['https://rpc.xinfin.network',50],CFX:['https://evm.confluxrpc.com',1030],
 SEI:['https://evm-rpc.sei-apis.com',1329],BERA:['https://rpc.berachain.com',80094]
};
const asset = symbol => FINAL_EVM_NATIVE_ASSETS.find(x=>x.symbol===symbol);
const block = (overrides={}) => ({number:'0x1000',timestamp:'0x'+Math.floor(now/1000).toString(16),transactions:ids.map(from=>({from,type:'0x2'})),...overrides});
const reply = result => ({jsonrpc:'2.0',id:1,result});
function mock(symbol,handler) {
 const calls=[];
 return {calls, read: async(url,opts)=>{
  assert.equal(url,config[symbol][0]);assert.equal(opts.method,'POST');
  const req=JSON.parse(opts.body);calls.push(req);
  const custom=handler?.(req,calls.length);
  if(custom!==undefined) return custom;
  if(req.method==='eth_chainId')return reply('0x'+config[symbol][1].toString(16));
  if(req.method==='eth_getBlockByNumber')return reply(block());
  if(req.method==='eth_getBalance')return reply('0xde0b6b3a7640000');
  throw Error('unexpected');
 }};
}
for (const symbol of Object.keys(config)) test(symbol+' exact mainnet, bounded real balance sample',async()=>{
 const m=mock(symbol);const value=await fetchFinalEvmNativeBalances(asset(symbol),m.read,now);
 assert.equal(m.calls.length,6);assert.equal(value.records.length,4);
 assert.equal(value.records[0].tokenBalance,1);assert.equal(value.totalHolders,null);
 assert.equal(value.sourceAt,null);assert.equal(value.coverage,'recent-address-sample');
 assert.equal(asset(symbol).refreshMs,7200000);
 assert(m.calls.filter(x=>x.method==='eth_getBalance').every(x=>x.params[1]==='latest'));
 if(symbol==='CFX')assert.match(value.scope,/excludes-core-space/);
});
test('one empty block gets one preceding block and only three balance reads',async()=>{
 const m=mock('SEI',(r,n)=>r.method==='eth_getBlockByNumber'?reply(n===2?block({transactions:[]}):block({number:'0xfff'})):undefined);
 const v=await fetchFinalEvmNativeBalances(asset('SEI'),m.read,now);
 assert.equal(m.calls.length,6);assert.equal(v.records.length,3);
 assert.equal(m.calls[2].params[0],'0xfff');assert.equal(v.discoveryBlock,4095);
});
test('two empty blocks stop without invented addresses or extra scans',async()=>{
 const m=mock('S',(r,n)=>r.method==='eth_getBlockByNumber'?reply(block({number:n===2?'0x1000':'0xfff',transactions:[]})):undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('S'),m.read,now),/empty-native-sample/);
 assert.equal(m.calls.length,3);
});
test('Berachain system sender excluded, observed proposer included with explicit scope',async()=>{
 const m=mock('BERA',r=>r.method==='eth_getBlockByNumber'?reply(block({miner:ids[2],transactions:[{from:ids[0],type:'0x7e'}]})):undefined);
 const v=await fetchFinalEvmNativeBalances(asset('BERA'),m.read,now);
 assert.equal(m.calls.length,3);assert.deepEqual(v.records,[{id:ids[2],tokenBalance:1}]);
 assert.match(v.scope,/block-proposers/);
});
test('deduplicates validated senders and excludes zero and malformed addresses',async()=>{
 const m=mock('MON',r=>r.method==='eth_getBlockByNumber'?reply(block({transactions:[{from:ids[0]},{from:ids[0].toUpperCase().replace('0X','0x')},{from:'0x'+'0'.repeat(40)},{from:'not-an-address'}]})):undefined);
 const v=await fetchFinalEvmNativeBalances(asset('MON'),m.read,now);
 assert.equal(v.records.length,1);assert.equal(m.calls.length,3);
});
test('rejects all-zero balances and malformed or coerced balance representations',async()=>{
 for(const raw of ['0x0',1,true,null,'123','0x'+'f'.repeat(65)]){
  const m=mock('MON',r=>r.method==='eth_getBalance'?reply(raw):undefined);
  await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),/empty-native-sample|invalid-native-balance/);
 }
});
test('wrong network identity rejects before discovery or balances',async()=>{
 const m=mock('MON',r=>r.method==='eth_chainId'?reply('0x1'):undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),/native-chain-mismatch/);
 assert.equal(m.calls.length,1);
});
test('wrong exact asset identity rejects without network requests',async()=>{
 for(const key of ['id','chain','symbol','provider']){
  let n=0;await assert.rejects(()=>fetchFinalEvmNativeBalances({...asset('MON'),[key]:'wrong'},async()=>{n++},now),/unsupported-native-provider/);assert.equal(n,0);
 }
});
test('rejects stale/future/invalid tip and wrong preceding block',async()=>{
 for(const timestamp of ['0x1','0x'+Math.floor((now+3600000)/1000).toString(16),'invalid']){
  const m=mock('MON',r=>r.method==='eth_getBlockByNumber'?reply(block({timestamp})):undefined);
  await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),/native-index-delayed|invalid-native-block/);assert.equal(m.calls.length,2);
 }
 const m=mock('MON',r=>r.method==='eth_getBlockByNumber'?reply(block({transactions:[]})):undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),/native-index-delayed/);
});
test('RPC rate limit aborts immediately with cache cooldown',async()=>{
 const m=mock('MON',r=>r.method==='eth_getBalance'?{jsonrpc:'2.0',id:1,error:{code:-32005,message:'quota exceeded'}}:undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),e=>e.message==='native-rpc-rate-limit'&&e.retryAt===now+7200000);
 assert.equal(m.calls.length,3);
});
test('malformed RPC envelopes cannot become sample data',async()=>{
 for(const body of [{jsonrpc:'1.0',id:1,result:'0x8f'},{jsonrpc:'2.0',id:9,result:'0x8f'},{jsonrpc:'2.0',id:1}]){
  const m=mock('MON',()=>body);await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('MON'),m.read,now),/invalid-native-rpc/);assert.equal(m.calls.length,1);
 }
});
