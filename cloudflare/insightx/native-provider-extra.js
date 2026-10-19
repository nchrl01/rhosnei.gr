const HOUR = 3600000;
const BNB_RPC = 'https://bsc-dataseed-public.bnbchain.org';
const BCH_API = 'https://api.bitcore.io/api/BCH/mainnet';
const TRON_API = 'https://apilist.tronscanapi.com/api';
const evmAddress = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);
const positive = value => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const base = (source, scope, coverage) => ({source, scope, coverage, totalHolders: null, supply: null, referencePrice: null, referenceMarketCap: null, sourceAt: null, indexCadence: 'provider-indexed'});

function freshBlock(timestamp, now) {
  if (!Number.isSafeInteger(timestamp) || timestamp > now + 300000 || now - timestamp > 6 * HOUR) throw Error('native-index-delayed');
}

async function rpc(read, method, params) {
  const body = await read(BNB_RPC, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  if (body?.error) {
    const limited = [-32005, 429].includes(Number(body.error.code)) || /rate.limit|too many requests/i.test(String(body.error.message));
    throw Object.assign(Error(limited ? 'native-rpc-rate-limit' : 'native-rpc-unavailable'), limited ? {retryAt: Date.now() + HOUR} : {});
  }
  if (body?.id !== 1 || body?.jsonrpc !== '2.0' || body.result === undefined) throw Error('invalid-native-rpc');
  return body.result;
}

// Official public RPC: https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/
// A bounded sample of recent transaction senders. These are neither a rich list nor a holder census.
// The public endpoint supports individual latest-state balances; historical/batch reads are not assumed.
async function bnb(read, now) {
  const block = await rpc(read, 'eth_getBlockByNumber', ['finalized', true]);
  if (!block || !/^0x[0-9a-f]+$/i.test(block.number) || !/^0x[0-9a-f]+$/i.test(block.timestamp) || !Array.isArray(block.transactions)) throw Error('invalid-native-block');
  freshBlock(Number.parseInt(block.timestamp, 16) * 1000, now);
  const ids = [...new Set(block.transactions.slice(0, 2048).map(tx => evmAddress(tx?.from) ? tx.from.toLowerCase() : null).filter(Boolean))].slice(0, 12);
  const records = [];
  for (const id of ids) {
    const raw = await rpc(read, 'eth_getBalance', [id, 'latest']);
    if (typeof raw !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(raw)) throw Error('invalid-native-balance');
    const tokenBalance = Number(BigInt(raw)) / 1e18;
    if (Number.isFinite(tokenBalance) && tokenBalance > 0) records.push({id, tokenBalance});
  }
  if (!records.length) throw Error('empty-native-sample');
  // Current balances are sequential reads, so the discovery block must not be claimed as their block.
  return {...base('BNB Chain public RPC', 'recent-transactors-current-native-balances', 'recent-address-sample'), records, discoveryBlock: Number.parseInt(block.number, 16), indexCadence: 'current-rpc-state'};
}

// Public Bitcore API, source-maintained routes:
// https://github.com/bitpay/bitcore/blob/master/packages/bitcore-node/src/routes/api/block.ts
// https://github.com/bitpay/bitcore/blob/master/packages/bitcore-node/src/routes/api/address.ts
async function bch(read, now) {
  const block = await read(BCH_API + '/block/tip');
  if (block?.chain !== 'BCH' || block.network !== 'mainnet' || !/^[0-9a-f]{64}$/i.test(block.hash) || !Number.isSafeInteger(block.height)) throw Error('invalid-native-block');
  freshBlock(Date.parse(block.time), now);
  const coins = await read(BCH_API + '/block/' + block.hash + '/coins/8/1');
  if (!Array.isArray(coins?.outputs) || !Array.isArray(coins?.inputs)) throw Error('invalid-native-outputs');
  const ids = [...new Set([...coins.outputs.slice(0, 1000), ...coins.inputs.slice(0, 1000)]
    .map(row => typeof row?.address === 'string' ? row.address.replace(/^bitcoincash:/, '') : '')
    .filter(id => /^[qp][023456789acdefghjklmnpqrstuvwxyz]{41,111}$/.test(id)))].slice(0, 8);
  const records = [];
  for (const id of ids) {
    const balance = await read(BCH_API + '/address/' + id + '/balance');
    const confirmed = Number(balance?.confirmed);
    if (!Number.isSafeInteger(confirmed) || confirmed < 0) throw Error('invalid-native-balance');
    // Exclude mempool value and spent output amounts; fetch the address's full confirmed balance.
    if (confirmed > 0) records.push({id: 'bitcoincash:' + id, tokenBalance: confirmed / 1e8});
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('Bitcore confirmed BCH balances', 'recent-addresses-confirmed-balances', 'recent-address-sample'), records, discoveryBlock: block.height};
}

// https://docs.tronscan.org/en/api/account/account-list
// Keyless requests are permitted with rate limits: https://docs.tronscan.org/en/api/api-keys
async function tron(read) {
  const body = await read(TRON_API + '/account/list?sort=-balance&limit=50&start=0');
  if (!Array.isArray(body?.data)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of body.data.slice(0, 50)) {
    const id = row?.address, raw = positive(row?.totalBalance);
    if (typeof id !== 'string' || !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(id) || !raw || seen.has(id)) continue;
    seen.add(id); records.push({id, tokenBalance: raw / 1e6, isContract: body.contractMap?.[id] === true});
  }
  if (!records.length) throw Error('empty-native-sample');
  // total/account_number are pagination/all-account counts, never total holders.
  // totalBalance explicitly includes staked native TRX; updateTime is an account event, not index freshness.
  return {...base('TRONSCAN native balances', 'public-addresses-including-stake', 'top-holder-sample'), records};
}

// https://api.tzkt.io/#tag/Accounts/operation/Accounts_Get
// This endpoint filters to user accounts; its sample excludes delegates and originated contracts.
async function tezos(read) {
  const rows = await read('https://api.tzkt.io/v1/accounts?type=user&balance.gt=0&sort.desc=balance&limit=50&select=address,balance');
  if (!Array.isArray(rows)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of rows.slice(0, 50)) {
    const id = row?.address, raw = Number(row?.balance);
    if (typeof id !== 'string' || !/^tz[1-4][1-9A-HJ-NP-Za-km-z]{33}$/.test(id) || !Number.isSafeInteger(raw) || raw <= 0 || seen.has(id)) continue;
    seen.add(id); records.push({id, tokenBalance: raw / 1e6});
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('TzKT native balances', 'user-addresses-excludes-delegates-and-contracts', 'top-holder-sample'), records};
}

const CHAINZ = Object.freeze({
  DASH: {id: 'dash', chain: 'dash', path: 'dash'},
  DGB: {id: 'digibyte', chain: 'digibyte', path: 'dgb'},
  FIRO: {id: 'zcoin', chain: 'firo', path: 'firo'},
});

// Free documented API: https://chainz.cryptoid.info/api.dws
// The shared relay must enforce its global limit of one request every ten seconds.
async function chainz(asset, read) {
  const mapped = CHAINZ[asset.symbol];
  if (!mapped || mapped.id !== asset.id || mapped.chain !== asset.chain) throw Error('unsupported-native-provider');
  const body = await read('https://chainz.cryptoid.info/' + mapped.path + '/api.dws?q=rich');
  if (!Array.isArray(body?.rich1000)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of body.rich1000.slice(0, 1000)) {
    const id = row?.addr, tokenBalance = positive(row?.amount);
    // Exclude provider aggregates such as "Anonymous" and "op_return" from wallet records.
    const address = typeof id === 'string' && (/^[1-9A-HJ-NP-Za-km-z]{26,60}$/.test(id) || (asset.symbol === 'DGB' && /^dgb1[023456789acdefghjklmnpqrstuvwxyz]{20,90}$/.test(id)));
    if (!address || !tokenBalance || seen.has(id)) continue;
    seen.add(id); records.push({id, tokenBalance});
    if (records.length >= 100) break;
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('Chainz CryptoID native balances', asset.symbol === 'FIRO' ? 'transparent-addresses-only' : 'public-addresses', 'top-holder-sample'), records};
}

const ROUTESCAN = Object.freeze({
  AVAX: {id: 'avalanche-2', chain: 'avalanche', chainId: '43114', scope: 'avalanche-c-chain-only'},
  NXPC: {id: 'nexpace', chain: 'henesys', chainId: '68414', scope: 'henesys-native-addresses'},
});

// https://routescan.io/docs/api/addresses (native gas balance, 18 decimals on these two chains).
// Public attribution is required by https://routescan.io/docs/plans-and-limits/api-keys-and-pricing.
async function routescan(asset, read) {
  const mapped = ROUTESCAN[asset.symbol];
  if (!mapped || mapped.id !== asset.id || mapped.chain !== asset.chain) throw Error('unsupported-native-provider');
  const body = await read('https://api.routescan.io/v2/network/mainnet/evm/' + mapped.chainId + '/addresses?sort=balance%2Cdesc&limit=50');
  if (!Array.isArray(body?.items)) throw Error('invalid-native-sample');
  const seen = new Set(), records = [];
  for (const row of body.items.slice(0, 50)) {
    const id = typeof row?.address === 'string' ? row.address.toLowerCase() : '', raw = String(row?.balance ?? '');
    if (String(row?.chainId) !== mapped.chainId || !evmAddress(id) || !/^\d{1,78}$/.test(raw) || seen.has(id)) continue;
    const tokenBalance = Number(raw) / 1e18;
    if (!Number.isFinite(tokenBalance) || tokenBalance <= 0) continue;
    seen.add(id); records.push({id, tokenBalance});
  }
  if (!records.length) throw Error('empty-native-sample');
  return {...base('Routescan native balances', mapped.scope, 'top-holder-sample'), records};
}

export async function fetchExtraNativeBalances(asset, read, now = Date.now()) {
  if (asset.chain === 'bsc' && asset.symbol === 'BNB' && asset.provider === 'bnb-rpc') return bnb(read, now);
  if (asset.chain === 'bitcoin-cash' && asset.symbol === 'BCH' && asset.provider === 'bitcore') return bch(read, now);
  if (asset.chain === 'tron' && asset.symbol === 'TRX' && asset.provider === 'tronscan') return tron(read);
  if (asset.chain === 'tezos' && asset.symbol === 'XTZ' && asset.provider === 'tzkt') return tezos(read);
  if (asset.provider === 'chainz') return chainz(asset, read);
  if (asset.provider === 'routescan') return routescan(asset, read);
  throw Error('unsupported-native-provider');
}
