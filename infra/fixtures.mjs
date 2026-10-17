// Local-only deterministic RPC fixture. No production chain is represented.
import {createServer} from 'node:http';import {parseAbi,decodeFunctionData,encodeFunctionResult,keccak256,toHex} from 'viem';
const token='0x0000000000000000000000000000000000001111',quote='0x0000000000000000000000000000000000002222',pool='0x0000000000000000000000000000000000003333',factory='0x0000000000000000000000000000000000004444',feed='0x0000000000000000000000000000000000005555';
const code='0x60006000',codeHash=keccak256(code);let reserveQuote=600000n*10n**6n;
const abi=parseAbi(['function getPair(address,address) view returns(address)','function token0() view returns(address)','function token1() view returns(address)','function factory() view returns(address)','function decimals() view returns(uint8)','function totalSupply() view returns(uint256)','function balanceOf(address) view returns(uint256)','function getReserves() view returns(uint112,uint112,uint32)','function price0CumulativeLast() view returns(uint256)','function price1CumulativeLast() view returns(uint256)','function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)']);
const policy={name:'LOCAL FIXTURE — sample token',symbol:'FIXTURE',policy:{chain:'ethereum',token,quote,pool,factory,quoteFeed:feed,tokenCodeHash:codeHash,poolCodeHash:codeHash,protocol:'v2',quoteDecimals:6,feedHeartbeat:3600,exclusions:[]}};
function reply(call){const {method,params=[]}=call;let result;
 if(method==='eth_chainId')result='0x1';
 else if(method==='eth_getCode')result=code;
 else if(method==='eth_getBlockByNumber'){const n=params[0]==='finalized'?BigInt(Math.floor(Date.now()/1000/12)):BigInt(params[0]);result={number:toHex(n),hash:toHex(n,{size:32}),timestamp:toHex(n*12n)};}
 else if(method==='eth_call'){
  const {functionName}=decodeFunctionData({abi,data:params[0].data});const block=BigInt(params[1].blockHash),at=block*12n;let out;
  if(functionName==='getPair')out=pool;else if(functionName==='token0')out=token;else if(functionName==='token1')out=quote;else if(functionName==='factory')out=factory;
  else if(functionName==='decimals')out=params[0].to.toLowerCase()===quote?6:params[0].to.toLowerCase()===feed?8:18;
  else if(functionName==='totalSupply')out=1000000n*10n**18n;else if(functionName==='balanceOf')out=0n;
  else if(functionName==='getReserves')out=[1000000n*10n**18n,reserveQuote,Number((at-10n)%2n**32n)];
  else if(functionName==='price0CumulativeLast')out=(reserveQuote*2n**112n/(1000000n*10n**18n)*(at-10n))%2n**256n;
  else if(functionName==='price1CumulativeLast')out=(1000000n*10n**18n*2n**112n/reserveQuote*(at-10n))%2n**256n;
  else if(functionName==='latestRoundData')out=[1n,100000000n,at-10n,at-10n,1n];
  result=encodeFunctionResult({abi,functionName,result:out});
 }else return {jsonrpc:'2.0',id:call.id,error:{code:-32601,message:'Unsupported fixture method'}};
 return {jsonrpc:'2.0',id:call.id,result};
}
function handler(req,res){if(req.url==='/policy'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(policy));return;}
 let body='';req.on('data',c=>{body+=c;if(body.length>100000)req.destroy();});req.on('end',()=>{try{const input=JSON.parse(body);if(req.url==='/fixture/price'){reserveQuote=BigInt(input.quoteReserveUnits);res.end(JSON.stringify({testFixture:true}));return;}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(Array.isArray(input)?input.map(reply):reply(input)));}catch{res.statusCode=400;res.end();}});}
for(const port of [3890,3891])createServer(handler).listen(port,'0.0.0.0');
