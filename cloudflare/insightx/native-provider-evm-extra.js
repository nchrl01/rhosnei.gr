const HOUR = 3600000;
const evmAddress = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);
const base = (source, scope, coverage = 'top-holder-sample') => ({source, scope, coverage, totalHolders: null, supply: null, referencePrice: null, referenceMarketCap: null, sourceAt: null, indexCadence: 'provider-indexed'});

// Official independent keyless service: https://www.alchemy.com/rpc/bnb
// Six addresses plus discovery = at most seven calls/hour. Relay caps this provider at 180/day.
// No runtime retries or fallback to providers that rejected access.
export async function loadBnbAlchemy(read, now = Date.now()) {
  const rpc = async (method, params) => {
    const body = await read('https://bnb-mainnet.g.alchemy.com/public', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
    if (body?.error) {
      const limited = [-32005, 429].includes(Number(body.error.code)) || /rate.?limit|usage limit|quota|too many requests/i.test(String(body.error.message));
      throw Object.assign(Error(limited ? 'native-rpc-rate-limit' : 'native-rpc-unavailable'), limited ? {retryAt: Date.now() + HOUR} : {});
    }
    if (body?.id !== 1 || body?.jsonrpc !== '2.0' || body.result === undefined) throw Error('invalid-native-rpc');
    return body.result;
  };
  const block = await rpc('eth_getBlockByNumber', ['finalized', true]);
  if (!block || !/^0x[0-9a-f]+$/i.test(block.number) || !/^0x[0-9a-f]+$/i.test(block.timestamp) || !Array.isArray(block.transactions)) throw Error('invalid-native-block');
  const tipAt = Number.parseInt(block.timestamp, 16) * 1000;
  if (!Number.isSafeInteger(tipAt) || tipAt > now + 300000 || now - tipAt > 6 * HOUR) throw Error('native-index-delayed');
  const ids = [...new Set(block.transactions.slice(0, 2048).map(tx => evmAddress(tx?.from) ? tx.from.toLowerCase() : null).filter(Boolean))].slice(0, 6);
  const records = [];
  for (const id of ids) {
    const raw = await rpc('eth_getBalance', [id, 'latest']);
    if (typeof raw !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(raw)) throw Error('invalid-native-balance');
    const tokenBalance = Number(BigInt(raw)) / 1e18;
    if (Number.isFinite(tokenBalance) && tokenBalance > 0) records.push({id, tokenBalance});
  }
  if (!records.length) throw Error('empty-native-sample');
  // Latest-state reads are sequential, not atomic at the discovery block.
  return {...base('Alchemy public BNB balances', 'recent-transactors-current-native-balances', 'recent-address-sample'), records, discoveryBlock: Number.parseInt(block.number, 16), indexCadence: 'current-rpc-state'};
}

// Each is a separately operated official mainnet explorer, with documented public APIs.
// Flare identity/decimals: https://dev.flare.network/network/overview
// KCC identity/API: https://docs.kcc.io/developers/explorer and /network-endpoints
// ETN identity/decimals: https://developer.electroneum.com/foundational-topics/accounts
// STRAX's official explorer redirects to Xertra: https://explorer.stratisevm.com/
// Endpoint schema: https://github.com/blockscout/blockscout-api-v2-swagger/blob/main/swagger.yaml
const EXPLORERS = Object.freeze({
  FLR: {id: 'flare-networks', chain: 'flare-network', provider: 'flare-explorer', origin: 'https://flare-explorer.flare.network', source: 'Flare official explorer', scope: 'flare-evm-addresses-excludes-p-chain-stake'},
  KCS: {id: 'kucoin-shares', chain: 'kucoin-community-chain', provider: 'kcc-explorer', origin: 'https://scan.kcc.io', source: 'KCC official explorer', scope: 'kcc-native-addresses'},
  ETN: {id: 'electroneum', chain: 'electroneum', provider: 'etn-explorer', origin: 'https://blockexplorer.electroneum.com', source: 'Electroneum official explorer', scope: 'electroneum-smart-chain-addresses'},
  STRAX: {id: 'stratis', chain: 'stratis', provider: 'xertra-explorer', origin: 'https://explorer.xertra.com', source: 'Xertra official explorer', scope: 'stratis-evm-addresses-excludes-beacon-stake'},
});

async function explorer(asset, config, read, now) {
  // Check the index tip before accepting a balance list from a stalled explorer.
  const blocks = await read(config.origin + '/api/v2/blocks?type=block');
  const tip = blocks?.items?.[0], tipAt = Date.parse(tip?.timestamp);
  if (!Number.isSafeInteger(tip?.height) || !Number.isSafeInteger(tipAt) || tipAt > now + 300000 || now - tipAt > 6 * HOUR) throw Error('native-index-delayed');
  const body = await read(config.origin + '/api/v2/addresses');
  if (!Array.isArray(body?.items)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of body.items.slice(0, 50)) {
    const id = typeof row?.hash === 'string' ? row.hash.toLowerCase() : '', raw = String(row?.coin_balance ?? '');
    if (!evmAddress(id) || !/^\d{1,78}$/.test(raw) || seen.has(id)) continue;
    const tokenBalance = Number(raw) / 1e18;
    if (!Number.isFinite(tokenBalance) || tokenBalance <= 0) continue;
    seen.add(id); records.push({id, tokenBalance, isContract: row.is_contract === true});
  }
  if (!records.length) throw Error('empty-native-sample');
  // The tip proves index health; it does not prove every balance was measured in that block.
  return {...base(config.source, config.scope), records, indexTipAt: tipAt, indexTip: tip.height};
}

// Plasma chain 9745 is present in Routescan's live /network/mainnet/evm/all/blockchains registry.
// https://routescan.io/docs/api/addresses ; shared Routescan attribution/quota also applies here.
async function plasma(read) {
  const body = await read('https://api.routescan.io/v2/network/mainnet/evm/9745/addresses?sort=balance%2Cdesc&limit=50');
  if (!Array.isArray(body?.items)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of body.items.slice(0, 50)) {
    const id = typeof row?.address === 'string' ? row.address.toLowerCase() : '', raw = String(row?.balance ?? '');
    if (String(row?.chainId) !== '9745' || !evmAddress(id) || !/^\d{1,78}$/.test(raw) || seen.has(id)) continue;
    const tokenBalance = Number(raw) / 1e18;
    if (!Number.isFinite(tokenBalance) || tokenBalance <= 0) continue;
    seen.add(id); records.push({id, tokenBalance});
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('Routescan native balances', 'plasma-native-addresses'), records};
}

export async function fetchEvmExtraNativeBalances(asset, read, now = Date.now()) {
  if (asset.id === 'binancecoin' && asset.chain === 'bsc' && asset.symbol === 'BNB' && asset.provider === 'bnb-alchemy') return loadBnbAlchemy(read, now);
  if (asset.id === 'tron' && asset.chain === 'tron' && asset.symbol === 'TRX' && asset.provider === 'trongrid') return loadTronGridNative(read, now);
  if (asset.id === 'plasma' && asset.chain === 'plasma' && asset.symbol === 'XPL' && asset.provider === 'routescan') return plasma(read);
  const config = EXPLORERS[asset.symbol];
  if (!config || config.id !== asset.id || config.chain !== asset.chain || config.provider !== asset.provider) throw Error('unsupported-native-provider');
  return explorer(asset, config, read, now);
}

// Independent node API, not a proxy for TRONSCAN:
// https://tronprotocol.github.io/documentation-en/api/http/block-and-tx-query/getnowblock/
// https://developers.tron.network/reference/walletsolidity-getaccount
// https://developers.tron.network/reference/rate-limits
// Relay pacing >=1100ms; a four-address sample uses five calls per hourly refresh.
export async function loadTronGridNative(read, now = Date.now()) {
  const checked = body => {
    const message = body?.Error || body?.error;
    if (message || body?.success === false) {
      const limited = Number(body?.statusCode) === 429 || /limit|frequency|quota|too many|api.?key/i.test(String(message));
      throw Object.assign(Error(limited ? 'native-rpc-rate-limit' : 'native-rpc-unavailable'), limited ? {retryAt: Date.now() + HOUR} : {});
    }
    return body;
  };
  const block = checked(await read('https://api.trongrid.io/walletsolidity/getnowblock?visible=true'));
  const header = block?.block_header?.raw_data;
  if (!Number.isSafeInteger(header?.number) || !Number.isSafeInteger(header?.timestamp) || header.timestamp > now + 300000 || now - header.timestamp > 6 * HOUR || !Array.isArray(block?.transactions)) throw Error('native-index-delayed');
  const address = id => typeof id === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(id);
  // The visible response still contains hex-form addresses in some contract types; exclude them.
  const ids = [...new Set(block.transactions.slice(0, 2048).flatMap(tx => (Array.isArray(tx?.raw_data?.contract) ? tx.raw_data.contract.slice(0, 10) : []).map(c => c?.parameter?.value?.owner_address)).filter(address))].slice(0, 4);
  const records = [];
  for (const id of ids) {
    const account = checked(await read('https://api.trongrid.io/walletsolidity/getaccount', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({address: id, visible: true})}));
    if (account?.address !== id) throw Error('invalid-native-account');
    // TRON omits the protobuf zero default. Only this native balance field is used, never assetV2.
    const raw = account.balance ?? 0;
    if (!Number.isSafeInteger(raw) || raw < 0) throw Error('invalid-native-balance');
    if (raw > 0) records.push({id, tokenBalance: raw / 1e6});
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('TronGrid solidified native balances', 'recent-transactors-liquid-trx-excludes-stake', 'recent-address-sample'), records, discoveryBlock: header.number, indexCadence: 'solidified-rpc-state'};
}
