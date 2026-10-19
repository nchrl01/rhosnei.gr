import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchFinalEvmNativeBalances, FINAL_EVM_NATIVE_ASSETS} from '../cloudflare/insightx/native-provider-evm-final.js';
const now = 1792430000000;
const ids = Array.from({length:8},(_,i)=>'0x'+String(i+1).padStart(40,'0'));
const config = {
 QIE:['https://rpc1mainnet.qie.digital/',1990],DOT:['https://eth-rpc.polkadot.io',420420419],GRX:['https://rpc.grxchain.io',1110],TAO:['https://lite.chain.opentensor.ai',964],OZO:['https://node1.ozonechain.io',4000],PROS:['https://rpc.pharos.xyz',1672],DATA:['https://mainnet.datarpc.io',1514],ABEY:['https://rpc.abeychain.com',179],KUB:['https://rpc.bitkubchain.io',96],XP:['https://en-bkk.x-phere.com',20250217],BTY:['https://mainnet.bityuan.com/eth',2999],KAIA:['https://kaia.drpc.org',8217],
 MON:['https://rpc.monad.xyz',143],S:['https://rpc.soniclabs.com',146],SOMI:['https://api.infra.mainnet.somnia.network',5031],
 WEMIX:['https://api.wemix.com',1111],XDC:['https://xdc.public-rpc.com',50],CFX:['https://evm.confluxrpc.com',1030],
 SEI:['https://evm-rpc.sei-apis.com',1329],BERA:['https://rpc.berachain.com',80094]
};
const asset = symbol => FINAL_EVM_NATIVE_ASSETS.find(x=>x.symbol===symbol);
const block = (overrides={}) => ({number:'0x1000',timestamp:'0x'+Math.floor(now/1000).toString(16),transactions:ids.map(from=>({from,type:'0x2'})),...overrides});
const reply = result => ({jsonrpc:'2.0',id:1,result});
function mock(symbol,handler) {
 const calls=[];
 return {calls, read: async(url,opts)=>{
  if(symbol==='CFX'&&url==='https://evmapi.confluxscan.org/data/accounts?limit=20&sort=desc') {
   assert.equal(opts,undefined);
   const req={method:'account-index'};calls.push(req);
   return handler?.(req,calls.length)??{status:'1',message:'OK',result:ids.map(address=>({address}))};
  }
  assert.equal(url,config[symbol][0]);assert.equal(opts.method,'POST');
  const req=JSON.parse(opts.body);calls.push(req);
  const custom=handler?.(req,calls.length);
  if(custom!==undefined) return custom;
  if(req.method==='eth_chainId')return reply('0x'+config[symbol][1].toString(16));
  if(req.method==='eth_getBlockByNumber')return reply(block());
  if(req.method==='eth_getLogs')return reply(ids.map(id=>({blockNumber:'0x1000',topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef','0x'+'0'.repeat(24)+id.slice(2)]})));
  if(req.method==='eth_getBalance')return reply('0xde0b6b3a7640000');
  throw Error('unexpected');
 }};
}
for (const symbol of Object.keys(config)) test(symbol+' exact mainnet, bounded real balance sample',async()=>{
 const m=mock(symbol);const value=await fetchFinalEvmNativeBalances(asset(symbol),m.read,now);
 assert.equal(m.calls.length,6);assert.equal(value.records.length,['CFX','KUB','BTY'].includes(symbol)?3:4);
 assert.equal(value.records[0].tokenBalance,1);assert.equal(value.totalHolders,null);
 assert.equal(value.sourceAt,null);assert.equal(value.coverage,symbol==='CFX'?'ledger-account-sample':'recent-address-sample');
 assert.equal(asset(symbol).refreshMs,7200000);
 assert(m.calls.filter(x=>x.method==='eth_getBalance').every(x=>x.params[1]==='latest'));
 if(symbol==='CFX')assert.match(value.scope,/excludes-core-space/);
});
test('CFX empty blocks use indexed accounts with three current balance reads within six calls',async()=>{
 const m=mock('CFX',r=>r.method==='eth_getBlockByNumber'?reply(block({transactions:[]})):undefined);
 const v=await fetchFinalEvmNativeBalances(asset('CFX'),m.read,now);
 assert.equal(m.calls.length,6);assert.equal(v.records.length,3);
 assert.equal(m.calls.filter(r=>r.method==='eth_getBlockByNumber').length,1);
 assert.equal(m.calls[2].method,'account-index');assert.equal(v.indexTip,4096);
 assert.equal(v.discoveryBlock,undefined);assert.equal(v.sourceAt,null);
 assert.match(v.scope,/indexed-accounts.*excludes-core-space/);
});
test('CFX index validates addresses and deduplicates without trusting returned balances',async()=>{
 const m=mock('CFX',r=>r.method==='account-index'?{status:'1',result:[{address:ids[0],balance:'9999999999'},{address:ids[0]},{address:'invalid'},{address:'0x'+'0'.repeat(40)}]}:undefined);
 const v=await fetchFinalEvmNativeBalances(asset('CFX'),m.read,now);
 assert.deepEqual(v.records,[{id:ids[0],tokenBalance:1}]);assert.equal(m.calls.length,4);
});
test('CFX invalid or empty account index cannot fabricate a sample',async()=>{
 for(const data of [{status:'0',result:ids}, {status:'1',result:ids}, {status:'1',result:[]}, {status:'1',result:{address:ids[0]}}]) {
  const m=mock('CFX',r=>r.method==='account-index'?data:undefined);
  await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('CFX'),m.read,now),/invalid-native-account-index|empty-native-sample/);
  assert.equal(m.calls.length,3);
 }
});
test('CFX index rate limits abort without alternate discovery or balance calls',async()=>{
 const m=mock('CFX',r=>r.method==='account-index'?{status:'0',message:'Rate limit reached',result:[]}:undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('CFX'),m.read,now),e=>e.message==='native-rpc-rate-limit'&&e.retryAt===now+7200000);
 assert.equal(m.calls.length,3);
});
test('CFX indexed accounts still require positive real RPC balances',async()=>{
 const m=mock('CFX',r=>r.method==='eth_getBalance'?reply('0x0'):undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('CFX'),m.read,now),/empty-native-sample/);
 assert.equal(m.calls.length,6);
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
test('XDC independent Ankr endpoint rejects old denied provider identity before requests',async()=>{
 let calls=0;
 await assert.rejects(()=>fetchFinalEvmNativeBalances({...asset('XDC'),provider:'xdc-public'},async()=>{calls++},now),/unsupported-native-provider/);
 assert.equal(calls,0);assert.equal(asset('XDC').provider,'xdc-ankr-public');
 const m=mock('XDC',r=>r.method==='eth_chainId'?reply('0xa1337'):undefined);
 await assert.rejects(()=>fetchFinalEvmNativeBalances(asset('XDC'),m.read,now),/native-chain-mismatch/);
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
test('KUB discovers accounts from bounded Transfer logs but reads only current native balances',async()=>{const m=mock('KUB',r=>r.method==='eth_getBlockByNumber'?reply(block({transactions:[],miner:'0x'+'0'.repeat(40)})):undefined);const r=await fetchFinalEvmNativeBalances(asset('KUB'),m.read,now);assert.equal(r.records[0].tokenBalance,1);assert.equal(m.calls.length,6);const q=m.calls.find(x=>x.method==='eth_getLogs').params[0];assert.equal(q.fromBlock,'0xf80');assert.equal(q.toBlock,'0x1000');assert.match(r.scope,/excludes-token-amounts/);});
