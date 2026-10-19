import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchEvmExtraNativeBalances, loadBnbAlchemy, loadTronGridNative} from '../cloudflare/insightx/native-provider-evm-extra.js';

const now = 1792424400000, hour = 3600000;
const evm = n => '0x' + n.toString(16).padStart(40, '0');
const bnbBlock = extra => ({number: '0x1234', timestamp: '0x' + (now / 1000).toString(16), transactions: Array.from({length: 20}, (_, i) => ({from: evm(i + 1)})), ...extra});
const rpcResult = result => ({jsonrpc: '2.0', id: 1, result});
const trxAddresses = ['TCXbFBt8Hq2WzvDvk3hUUkPqL9DMW8cZrf', 'TXxWzUismDoTadaqbejzERVWvgUruUecTJ', 'TQNiJq2YuPEEoThJ5ybWf2JQkS5L3zWRSm', 'TBwTMkZGjK4Srh76vNJ56zVdyY3A594Gb3', 'TN12qS4gM6qs3B2R4XjuT2zf6BomaDGdRY'];
const trxTx = owner_address => ({raw_data: {contract: [{parameter: {value: {owner_address}}}]}});
const trxBlock = extra => ({block_header: {raw_data: {number: 100, timestamp: now}}, transactions: trxAddresses.map(trxTx), ...extra});
const explorerAssets = [
  {id: 'flare-networks', chain: 'flare-network', symbol: 'FLR', provider: 'flare-explorer'},
  {id: 'kucoin-shares', chain: 'kucoin-community-chain', symbol: 'KCS', provider: 'kcc-explorer'},
  {id: 'electroneum', chain: 'electroneum', symbol: 'ETN', provider: 'etn-explorer'},
  {id: 'stratis', chain: 'stratis', symbol: 'STRAX', provider: 'xertra-explorer'},
];
const xpl = {id: 'plasma', chain: 'plasma', symbol: 'XPL', provider: 'routescan'};

test('BNB caps discovery at six unique senders and seven reads, using current balances', async () => {
  let calls = 0;
  const block = bnbBlock();
  block.transactions.unshift({from: evm(1)}, {from: 'invalid'}, {from: evm(0)});
  const result = await loadBnbAlchemy(async (url, options) => {
    assert.equal(url, 'https://bnb-mainnet.g.alchemy.com/public');
    const request = JSON.parse(options.body); calls++;
    if (calls === 1) {
      assert.equal(request.method, 'eth_getBlockByNumber');
      assert.deepEqual(request.params, ['finalized', true]); return rpcResult(block);
    }
    assert.equal(request.method, 'eth_getBalance');
    assert.deepEqual(request.params, [evm(calls - 1), 'latest']);
    return rpcResult('0xde0b6b3a7640000');
  }, now);
  assert.equal(calls, 7); assert.equal(result.records.length, 6);
  assert.equal(result.records[0].tokenBalance, 1);
  assert.equal(result.sourceAt, null); assert.equal(result.totalHolders, null);
  assert.equal(result.discoveryBlock, 0x1234); assert.equal(result.coverage, 'recent-address-sample');
});

test('BNB rejects all-zero samples and malformed balance responses', async () => {
  for (const balance of ['0x0', '0xZZ', null, 100, '0x' + 'f'.repeat(65)]) {
    let calls = 0;
    await assert.rejects(() => loadBnbAlchemy(async () => rpcResult(++calls === 1 ? bnbBlock() : balance), now), /empty-native-sample|invalid-native-balance/);
    assert.ok(calls <= 7);
  }
});

test('BNB rejects stale discovery and never reads invalid senders', async () => {
  let calls = 0;
  await assert.rejects(() => loadBnbAlchemy(async () => {calls++; return rpcResult(bnbBlock({timestamp: '0x' + ((now - 7 * hour) / 1000).toString(16)}));}, now), /native-index-delayed/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => loadBnbAlchemy(async () => {calls++; return rpcResult(bnbBlock({transactions: [{from: evm(0)}, {from: 'wrong'}]}));}, now), /empty-native-sample/);
  assert.equal(calls, 1);
});

test('BNB stops immediately on public rate-limit errors', async () => {
  let calls = 0;
  await assert.rejects(() => loadBnbAlchemy(async () => {calls++; return {jsonrpc: '2.0', id: 1, error: {code: 429, message: 'Rate limit reached'}};}, now), error => error.message === 'native-rpc-rate-limit' && error.retryAt > Date.now());
  assert.equal(calls, 1);
});

test('TRX caps reads at five and only uses liquid native sun balances', async () => {
  let calls = 0;
  const block = trxBlock(); block.transactions.unshift(trxTx(trxAddresses[0]), trxTx('41' + 'a'.repeat(40)), trxTx('invalid'));
  const result = await loadTronGridNative(async (url, options) => {
    calls++;
    if (calls === 1) {assert.equal(url, 'https://api.trongrid.io/walletsolidity/getnowblock?visible=true'); return block;}
    assert.equal(url, 'https://api.trongrid.io/walletsolidity/getaccount');
    const request = JSON.parse(options.body); assert.equal(request.visible, true);
    assert.equal(request.address, trxAddresses[calls - 2]);
    return {address: request.address, balance: 1234567, frozenV2: [{amount: 900000000000}], assetV2: [{key: 'token', value: 999999999999}]};
  }, now);
  assert.equal(calls, 5); assert.equal(result.records.length, 4);
  assert.equal(result.records[0].tokenBalance, 1.234567);
  assert.equal(result.sourceAt, null); assert.equal(result.totalHolders, null);
  assert.equal(result.scope, 'recent-transactors-liquid-trx-excludes-stake');
});

test('TRX never coerces malformed balances and validates returned account identity', async () => {
  for (const balance of ['1000000', true, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    let calls = 0;
    await assert.rejects(() => loadTronGridNative(async () => ++calls === 1 ? trxBlock() : {address: trxAddresses[0], balance}, now), /invalid-native-balance/);
    assert.equal(calls, 2);
  }
  let calls = 0;
  await assert.rejects(() => loadTronGridNative(async () => ++calls === 1 ? trxBlock() : {address: trxAddresses[1], balance: 1}, now), /invalid-native-account/);
});

test('TRX treats an omitted protobuf balance as zero and rejects an entirely zero sample', async () => {
  let calls = 0;
  await assert.rejects(() => loadTronGridNative(async (_, options) => ++calls === 1 ? trxBlock() : {address: JSON.parse(options.body).address}, now), /empty-native-sample/);
  assert.equal(calls, 5);
});

test('TRX stops on stale blocks and structured rate-limit errors', async () => {
  await assert.rejects(() => loadTronGridNative(async () => trxBlock({block_header: {raw_data: {number: 100, timestamp: now - 7 * hour}}}), now), /native-index-delayed/);
  await assert.rejects(() => loadTronGridNative(async () => ({Error: 'The key exceeds the frequency limit'}), now), error => error.message === 'native-rpc-rate-limit' && error.retryAt > Date.now());
});

test('official EVM explorers require a fresh index tip and return only unique positive native balances', async () => {
  for (const asset of explorerAssets) {
    let calls = 0;
    const result = await fetchEvmExtraNativeBalances(asset, async url => {
      calls++;
      if (calls === 1) {assert.ok(url.endsWith('/api/v2/blocks?type=block')); return {items: [{height: 100, timestamp: new Date(now).toISOString()}]};}
      assert.ok(url.endsWith('/api/v2/addresses'));
      return {total: 99999999, items: [
        {hash: evm(1), coin_balance: '2500000000000000000', is_contract: true},
        {hash: evm(1), coin_balance: '9900000000000000000'},
        {hash: evm(2), coin_balance: '0'}, {hash: evm(0), coin_balance: '1'}, {hash: 'bad', coin_balance: '1'},
      ]};
    }, now);
    assert.equal(calls, 2); assert.deepEqual(result.records, [{id: evm(1), tokenBalance: 2.5, isContract: true}]);
    assert.equal(result.indexTipAt, now); assert.equal(result.sourceAt, null); assert.equal(result.totalHolders, null);
  }
});

test('official EVM explorers reject old/future tips before making the balance request', async () => {
  for (const timestamp of [now - 7 * hour, now + hour, NaN]) {
    let calls = 0;
    await assert.rejects(() => fetchEvmExtraNativeBalances(explorerAssets[0], async () => {calls++; return {items: [{height: 100, timestamp: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : 'bad'}]};}, now), /native-index-delayed/);
    assert.equal(calls, 1);
  }
});

test('unknown asset identity, chain, or provider is rejected before any external read', async () => {
  for (const changed of [{id: 'fake'}, {chain: 'wrong'}, {symbol: 'ETH'}, {provider: 'wrong'}]) {
    let calls = 0;
    await assert.rejects(() => fetchEvmExtraNativeBalances({...explorerAssets[0], ...changed}, async () => {calls++;}, now), /unsupported-native-provider/);
    assert.equal(calls, 0);
  }
});

test('Plasma uses exactly chain 9745 and refuses a different Routescan chain', async () => {
  let calls = 0;
  const result = await fetchEvmExtraNativeBalances(xpl, async url => {
    calls++; assert.ok(url.includes('/mainnet/evm/9745/addresses?'));
    return {items: [{chainId: '9745', address: evm(1), balance: '3000000000000000000'}, {chainId: '43114', address: evm(2), balance: '9000000000000000000'}]};
  }, now);
  assert.equal(calls, 1); assert.deepEqual(result.records, [{id: evm(1), tokenBalance: 3}]); assert.equal(result.totalHolders, null);
  await assert.rejects(() => fetchEvmExtraNativeBalances(xpl, async () => ({items: [{chainId: '43114', address: evm(1), balance: '1'}]}), now), /empty-native-sample/);
});
