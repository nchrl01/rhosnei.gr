const HOUR = 3600000;
const hexQuantity = value => typeof value === 'string' && /^0x[0-9a-f]{1,64}$/i.test(value);
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);

// Fixed mainnet identities only. No caller-supplied endpoint or fallback host.
// Public endpoints and native currencies were checked in each chain's official docs:
// https://docs.monad.xyz/developer-essentials/network-information
// https://docs.soniclabs.com/sonic/build-on-sonic/getting-started
// https://docs.somnia.network/developer/json-rpc-api
// https://docs.wemix.com/en/quick-start/start-node/use-public-api-server-rpc
// https://xdc.public-rpc.com/ — independent Ankr-operated community endpoint, no key.
// https://doc.confluxnetwork.org/docs/espace/network-endpoints/
// https://evmapi.confluxscan.org/doc — account discovery, followed by current RPC balances.
// https://docs.sei.io/evm
// https://docs.berachain.com/general/introduction/connect-to-berachain
const CONFIGS = Object.freeze({
  QIE: {id:'qie',chain:'qie-blockchain',provider:'qie-mainnet',chainId:1990,url:'https://rpc1mainnet.qie.digital/',source:'QIE current mainnet native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  DOT: {id:'polkadot',chain:'polkadot',provider:'polkadot-hub-rpc',chainId:420420419,url:'https://eth-rpc.polkadot.io',source:'Polkadot Hub public native balances',scope:'polkadot-hub-ethereum-compatible-accounts-only',includeProposer:true,blockTag:'latest'},
  GRX: {id:'grx-chain',chain:'grx-chain',provider:'grx-chain-public-rpc',chainId:1110,url:'https://rpc.grxchain.io',source:'GRX official native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  TAO: {id:'bittensor',chain:'bittensor',provider:'bittensor-public-rpc',chainId:964,url:'https://lite.chain.opentensor.ai',source:'TAO public native balances',scope:'bittensor-evm-accounts-only-excludes-substrate-accounts',includeProposer:true,blockTag:'latest'},
  OZO: {id:'ozone-chain',chain:'ozone-chain',provider:'ozone-chain-public-rpc',chainId:4000,url:'https://node1.ozonechain.io',source:'OZO public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  PROS: {quietLookback:64,id:'pharos-network',chain:'pharos',provider:'pharos-public-rpc',chainId:1672,url:'https://rpc.pharos.xyz',source:'PROS public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  DATA: {id:'story-2',chain:'story',provider:'story-public-rpc',chainId:1514,url:'https://mainnet.datarpc.io',source:'DATA public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  ABEY: {id:'abey',chain:'abey',provider:'abey-public-rpc',chainId:179,url:'https://rpc.abeychain.com',source:'ABEY public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  KUB: {accountLogs:true,id:'bitkub-coin',chain:'bitkub-chain',provider:'bitkub-chain-public-rpc',chainId:96,url:'https://rpc.bitkubchain.io',source:'KUB public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  XP: {id:'xphere',chain:'xphere',provider:'xphere-public-rpc',chainId:20250217,url:'https://en-bkk.x-phere.com',source:'XP public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  BTY: {accountLogs:true,id:'bityuan',chain:'bityuan',provider:'bityuan-public-rpc',chainId:2999,url:'https://mainnet.bityuan.com/eth',source:'BTY public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  KAIA: {id:'kaia',chain:'kaia',provider:'kaia-public-rpc',chainId:8217,url:'https://kaia.drpc.org',source:'KAIA public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true,blockTag:'latest'},
  MON: {id:'monad',chain:'monad',provider:'monad-public',chainId:143,url:'https://rpc.monad.xyz',source:'Monad public native balances',scope:'recent-transactors-current-native-balances'},
  S: {id:'sonic-3',chain:'sonic',provider:'sonic-public',chainId:146,url:'https://rpc.soniclabs.com',source:'Sonic public native balances',scope:'recent-transactors-current-native-balances'},
  SOMI: {id:'somnia',chain:'somnia',provider:'somnia-public',chainId:5031,url:'https://api.infra.mainnet.somnia.network',source:'Somnia public native balances',scope:'recent-transactors-current-native-balances'},
  WEMIX: {id:'wemix-token',chain:'wemix-network',provider:'wemix-public',chainId:1111,url:'https://api.wemix.com',source:'WEMIX public native balances',scope:'recent-transactors-current-native-balances'},
  XDC: {id:'xdce-crowd-sale',chain:'xdc-network',provider:'xdc-ankr-public',chainId:50,url:'https://xdc.public-rpc.com',source:'Ankr XDC public native balances',scope:'recent-transactors-current-native-balances'},
  SEI: {id:'sei-network',chain:'sei-network',provider:'sei-public',chainId:1329,url:'https://evm-rpc.sei-apis.com',source:'Sei public EVM native balances',scope:'sei-evm-recent-addresses-only'},
  BERA: {id:'berachain-bera',chain:'berachain',provider:'berachain-public',chainId:80094,url:'https://rpc.berachain.com',source:'Berachain public native balances',scope:'recent-transactors-and-block-proposers-current-native-balances',includeProposer:true},
  CFX: {id:'conflux-token',chain:'conflux',provider:'conflux-espace',chainId:1030,url:'https://evm.confluxrpc.com',source:'ConfluxScan / Confura eSpace native balances',scope:'conflux-espace-indexed-accounts-current-native-balances-excludes-core-space',accountIndex:'https://evmapi.confluxscan.org/data/accounts?limit=20&sort=desc'},
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
  let block = checkedBlock(await rpc('eth_getBlockByNumber',[config.blockTag||'finalized',true]));
  let ids;
  if (config.accountIndex) {
    // eSpace often has empty finalized blocks. Discover real indexed accounts instead;
    // index balances/totals are never trusted or used to manufacture holder counts.
    if (++calls > 6) throw Error('native-call-budget');
    const data = await read(config.accountIndex);
    if (data?.status !== '1' || !Array.isArray(data?.result)) {
      const limited = /rate.?limit|usage limit|quota|too many requests/i.test(String(data?.message)+' '+String(data?.result));
      throw Object.assign(Error(limited ? 'native-rpc-rate-limit' : 'invalid-native-account-index'),limited ? {retryAt:now+2*HOUR} : {});
    }
    ids = [...new Set(data.result.slice(0,20).filter(row=>address(row?.address)).map(row=>row.address.toLowerCase()))];
  } else if(config.accountLogs){
    const from=Math.max(1,block.numberValue-128);if(++calls>6)throw Error('native-call-budget');
    const logs=await read(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getLogs',params:[{fromBlock:'0x'+from.toString(16),toBlock:'0x'+block.numberValue.toString(16),topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef']}]})});
    if(logs?.error||logs?.id!==1||!Array.isArray(logs.result)||logs.result.length>10000)throw Error('invalid-native-account-logs');
    const found=[];for(const log of logs.result){if(log?.removed===true||!hexQuantity(log?.blockNumber)||Number(BigInt(log.blockNumber))<from||Number(BigInt(log.blockNumber))>block.numberValue||log.topics?.[0]!=='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef')continue;for(const topic of log.topics.slice(1,3)){if(typeof topic==='string'&&/^0x0{24}[0-9a-f]{40}$/i.test(topic)){const id='0x'+topic.slice(-40);if(address(id))found.push(id.toLowerCase());}}}ids=[...new Set(found)];
  } else ids = senders(block);
  // A quiet finalized block gets at most one preceding-block lookup, never a scan.
  if (!config.accountIndex && !config.accountLogs && !ids.length && block.numberValue > 1) {
    const previous = Math.max(1,block.numberValue-(config.quietLookback||1));
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
  // Balances are sequential current-state reads. The CFX block is only a health check;
  // it is not the source block or timestamp of the index's discovered accounts.
  return {source:config.source,scope:config.accountLogs?'recent-transfer-participants-current-native-balances-excludes-token-amounts':config.scope,coverage:config.accountIndex?'ledger-account-sample':'recent-address-sample',totalHolders:null,supply:null,referencePrice:null,referenceMarketCap:null,sourceAt:null,indexTipAt:Number(BigInt(block.timestamp))*1000,indexCadence:'current-rpc-state',...(config.accountIndex?{indexTip:block.numberValue}:{discoveryBlock:block.numberValue}),records};
}
