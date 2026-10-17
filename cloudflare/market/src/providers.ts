import { ApiError, addressFor, type Chain } from './chains';

export interface ProviderEnv {
  MARKET_PROVIDER?: string;
  COINGECKO_API_KEY?: string;
  QUICKNODE_RPC_URLS?: string;
}
type ObjectValue = Record<string, unknown>;
export function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(502, 'invalid-upstream-response');
  return value as ObjectValue;
}
function decimal(value: unknown): string | null {
  // Keep provider decimal strings; avoid rounding money through JavaScript numbers.
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  return /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text) && Number.isFinite(Number(text)) ? text : null;
}
async function fetchJSON(url: string | URL, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new ApiError(502, response.status === 429 ? 'provider-rate-limited' : 'provider-unavailable');
  return response.json();
}
export function providerConfig(env: ProviderEnv) {
  const mode = env.MARKET_PROVIDER || 'geckoterminal';
  if (mode === 'geckoterminal') return { mode, base: 'https://api.geckoterminal.com/api/v2', headers: { Accept: 'application/json' } };
  if (mode !== 'coingecko-pro' && mode !== 'coingecko-demo') throw new ApiError(503, 'invalid-provider-configuration');
  if (!env.COINGECKO_API_KEY) throw new ApiError(503, 'missing-coingecko-key');
  return {
    mode,
    base: mode === 'coingecko-pro' ? 'https://pro-api.coingecko.com/api/v3/onchain' : 'https://api.coingecko.com/api/v3/onchain',
    headers: { Accept: 'application/json', [mode === 'coingecko-pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key']: env.COINGECKO_API_KEY }
  };
}
export async function poolSnapshot(env: ProviderEnv, chain: Chain, token: string, pool: string) {
  const provider = providerConfig(env);
  const raw = object(await fetchJSON(`${provider.base}/networks/${chain.network}/pools/${encodeURIComponent(pool)}`, { headers: provider.headers }));
  const data = object(raw.data), attributes = object(data.attributes), relationships = object(data.relationships);
  if (addressFor(chain, attributes.address, true) !== pool) throw new ApiError(502, 'pool-mismatch');
  const related = (side: string) => {
    const id = object(object(relationships[side]).data).id;
    if (typeof id !== 'string' || !id.startsWith(chain.network + '_')) throw new ApiError(502, 'token-identity-unavailable');
    return addressFor(chain, id.slice(chain.network.length + 1));
  };
  // Pool cap and FDV describe the base token. Do not attribute them to its quote.
  if (related('base_token') !== token) throw new ApiError(422, 'pool-base-token-mismatch');
  const snapshot = {
    schemaVersion: 1, chain: chain.id, token, pool, quoteToken: related('quote_token'),
    observedAt: new Date().toISOString(), source: provider.mode,
    priceUsd: decimal(attributes.base_token_price_usd),
    liquidityUsd: decimal(attributes.reserve_in_usd),
    marketCapUsd: decimal(attributes.market_cap_usd), fdvUsd: decimal(attributes.fdv_usd),
    volume24hUsd: decimal(object(attributes.volume_usd).h24),
    verification: 'provider-observation', milestoneEligible: false
  };
  if (!snapshot.priceUsd || Number(snapshot.priceUsd) <= 0) throw new ApiError(502, 'price-unavailable');
  // FDV is deliberately kept separate; a missing circulating market cap stays null.
  return { snapshot, raw };
}

export function rpcURLs(env: ProviderEnv): Record<string, string> {
  if (!env.QUICKNODE_RPC_URLS) return {};
  let value: ObjectValue;
  try { value = object(JSON.parse(env.QUICKNODE_RPC_URLS)); }
  catch { throw new ApiError(503, 'invalid-rpc-configuration'); }
  const urls: Record<string, string> = {};
  for (const [chain, input] of Object.entries(value)) {
    if (typeof input !== 'string') throw new ApiError(503, 'invalid-rpc-configuration');
    let url: URL;
    try { url = new URL(input); } catch { throw new ApiError(503, 'invalid-rpc-configuration'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new ApiError(503, 'invalid-rpc-configuration');
    urls[chain] = input;
  }
  return urls;
}
async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const value = object(await fetchJSON(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  }));
  if (value.error || value.result === undefined || value.result === null) throw new ApiError(502, 'rpc-unavailable');
  return value.result;
}
export async function blockContext(env: ProviderEnv, chain: Chain): Promise<ObjectValue> {
  const url = rpcURLs(env)[chain.id];
  if (!url) return { state: 'unconfigured', marketDataVerified: false };
  if (chain.kind === 'evm') {
    const chainId = await rpc(url, 'eth_chainId', []);
    if (typeof chainId !== 'string' || Number(BigInt(chainId)) !== chain.chainId) throw new ApiError(502, 'rpc-chain-mismatch');
    const block = object(await rpc(url, 'eth_getBlockByNumber', ['latest', false]));
    if (typeof block.hash !== 'string' || typeof block.number !== 'string') throw new ApiError(502, 'invalid-rpc-block');
    return { state: 'observed', source: 'quicknode', number: block.number, hash: block.hash, finality: 'latest-unfinalized', marketDataVerified: false };
  }
  if (chain.kind === 'solana') {
    if (await rpc(url, 'getGenesisHash', []) !== '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp') throw new ApiError(502, 'rpc-chain-mismatch');
    const slot = await rpc(url, 'getSlot', [{ commitment: 'finalized' }]);
    if (!Number.isSafeInteger(slot)) throw new ApiError(502, 'invalid-rpc-slot');
    return { state: 'observed', source: 'quicknode', slot, finality: 'finalized', marketDataVerified: false };
  }
  // Tron needs a chain-specific verification adapter, rather than EVM assumptions.
  return { state: 'verification-adapter-pending', marketDataVerified: false };
}
