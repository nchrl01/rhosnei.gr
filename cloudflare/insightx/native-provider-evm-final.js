const HOUR = 3600000;
const hexQuantity = value => typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value);
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);

// Fixed mainnet identities only. No caller-supplied endpoint or fallback host.
// Public endpoints and native currencies were checked in each chain's official docs:
// https://docs.monad.xyz/developer-essentials/network-information
// https://docs.soniclabs.com/sonic/build-on-sonic/getting-started
// https://docs.somnia.network/developer/json-rpc-api
// https://docs.wemix.com/en/quick-start/start-node/use-public-api-server-rpc
// https://docs.xdc.network/api/
// https://doc.confluxnetwork.org/docs/espace/network-endpoints/
// https://docs.sei.io/evm
// https://docs.berachain.com/general/introduction/connect-to-berachain
const CONFIGS = Object.freeze({
  MON: {id:'monad',chain:'monad',provider:'monad-public',chainId:143,url:'https://rpc.monad.xyz',source:'Monad public native balances',scope:'recent-transactors-current-native-balances'},
  S: {id:'sonic-3',chain:'sonic',provider:'sonic-public',chainId:146,url:'https://rpc.soniclabs.com',source:'Sonic public native balances',scope:'recent-transactors-current-native-balances'},
  SOMI: {id:'somnia',chain:'somnia',provider:'somnia-public',chainId:5031,url:'https://api.infra.mainnet.somnia.network',source:'Somnia public native balances',scope:'recent-transactors-current-native-balances'},
  WEMIX: {id:'wemix-token',chain:'wemix-network',provider:'wemix-public',chainId:1111,url:'https://api.wemix.com',source:'WEMIX public native balances',scope:'recent-transactors-current-native-balances'},
  XDC: {id:'xdce-crowd-sale',chain:'xdc-network',provider:'xdc-public',chainId:50,url:'https://rpc.xinfin.network',source:'XDC public native balances',scope:'recent-transactors-current-native-balances'},
  SEI: {id:'sei-network',chain:'sei-network',provider:'sei-public',chainId:1329,url:'https://evm-rpc.sei-apis.com',source:'Sei public EVM native balances',scope:'sei-evm-recent-addresses-only'},
  BERA: {id:'berachain-bera',chain:'berachain',provider:'berachain-public',chainId:80094,url:'https://rpc.berachain.com',source:'Berachain public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true},
  CFX: {id:'conflux-token',chain:'conflux',provider:'conflux-espace',chainId:1030,url:'https://evm.confluxrpc.com',source:'Confura eSpace native balances',scope:'conflux-espace-recent-addresses-only-excludes-core-space'},
});

export const FINAL_EVM_NATIVE_ASSETS = Object.freeze(Object.entries(CONFIGS).map(([symbol, {id,chain,provider}]) => Object.freeze({id,chain,symbol,provider,refreshMs:2*HOUR})));

// Two-hour shared cache. Six calls maximum, counting the identity check and discovery.
// No balance list is a native-coin holder census; totals remain unknown.
export async function fetchFinalEvmNativeBalances(asset, read, now = Date.now()) {
  const config = CONFIGS[asset?.symbol];
  if (!config || config.id !== asset.id || config.chain !== asset.chain || config.provider !== asset.provider) throw Error('unsupported-native-provider');
  let calls = 0;
  const rpc = async (method, params) => {
    if (++calls > 6) throw Error('native-call-budget');
    const body = await read(config.url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
    if (body?.error) {
      const limited = [-32005,429].includes(Number(body.error.code)) || /rate.?limit|usage limit|quota|too many requests/i.test(String(body.error.message));
      throw Object.assign(Error(limited ? 'native-rpc-rate-limit' : 'native-rpc-unavailable'), limited ? {retryAt:now+2*HOUR} : {});
    }
    if (body?.id !== 1 || body?.jsonrpc !== '2.0' || body.result === undefined) throw Error('invalid-native-rpc');
    return body.result;
  };
  const chainId = await rpc('eth_chainId',[]);
  if (!hexQuantity(chainId) || BigInt(chainId) !== BigInt(config.chainId)) throw Error('native-chain-mismatch');
  const checkedBlock = (block, expectedNumber) => {
    if (!hexQuantity(block?.number) || !hexQuantity(block?.timestamp) || !Array.isArray(block?.transactions)) throw Error('invalid-native-block');
    const number = Number(BigInt(block.number)), time = Number(BigInt(block.timestamp))*1000;
    if (!Number.isSafeInteger(number) || number < 1 || (expectedNumber !== undefined && number !== expectedNumber) || !Number.isSafeInteger(time) || time > now+300000 || now-time > 6*HOUR) throw Error('native-index-delayed');
    return {...block,numberValue:number};
  };
  const senders = block => [...new Set(block.transactions.slice(0,2048)
    // System transactions are not user transactors (e.g. Berachain's type 0x7e).
    .filter(tx => tx && tx.type !== '0x7e' && address(tx.from))
    .map(tx => tx.from.toLowerCase()).concat(config.includeProposer && address(block.miner) ? [block.miner.toLowerCase()] : []))];
  let block = checkedBlock(await rpc('eth_getBlockByNumber',['finalized',true]));
  let ids = senders(block);
  // A quiet finalized block gets at most one preceding-block lookup, never a scan.
  if (!ids.length && block.numberValue > 1) {
    const previous = block.numberValue-1;
    block = checkedBlock(await rpc('eth_getBlockByNumber',['0x'+previous.toString(16),true]),previous);
    ids = senders(block);
  }
  ids = ids.slice(0,6-calls);
  if (!ids.length) throw Error('empty-native-sample');
  const records=[];
  for (const id of ids) {
    const raw = await rpc('eth_getBalance',[id,'latest']);
    if (!hexQuantity(raw)) throw Error('invalid-native-balance');
    const tokenBalance = Number(BigInt(raw))/1e18;
    if (!Number.isFinite(tokenBalance)) throw Error('invalid-native-balance');
    if (tokenBalance > 0) records.push({id,tokenBalance});
  }
  if (!records.length) throw Error('empty-native-sample');
  // The finalized block discovers addresses; balances are sequential current-state reads.
  return {source:config.source,scope:config.scope,coverage:'recent-address-sample',totalHolders:null,supply:null,referencePrice:null,referenceMarketCap:null,sourceAt:null,indexCadence:'current-rpc-state',discoveryBlock:block.numberValue,records};
}
