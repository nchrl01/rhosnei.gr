import { ApiError, CHAINS, chainFor, addressFor } from './chains';
import { database, type DatabaseEnv } from './database';
import { poolSnapshot, blockContext, object, providerConfig, rpcURLs, type ProviderEnv } from './providers';

interface Env extends DatabaseEnv, ProviderEnv {
  ADMIN_TOKEN?: string; ALLOWED_ORIGIN?: string; INGEST_ENABLED?: string;
  PUBLIC_MARKET_DATA?: string; DAILY_MARKET_REQUEST_LIMIT?: string;
  MIN_REQUEST_SPACING_SECONDS?: string; MAX_TRACKED_ASSETS?: string;
}
interface Context { waitUntil(promise: Promise<unknown>): void }
interface Asset { id: string; chain: string; token_address: string; pool_address: string; poll_seconds: number }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const integer = (input: unknown, fallback: number, min: number, max: number) => {
  const value = input === undefined ? fallback : Number(input);
  if (!Number.isInteger(value) || value < min || value > max) throw new ApiError(400, 'invalid-numeric-configuration');
  return value;
};
async function authorize(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) throw new ApiError(503, 'admin-unconfigured');
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([hash(supplied), hash(env.ADMIN_TOKEN)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  if (difference) throw new ApiError(401, 'unauthorized');
}
async function body(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new ApiError(415, 'json-required');
  if (Number(request.headers.get('Content-Length')) > 4096) throw new ApiError(413, 'body-too-large');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'body-required');
  const parts: Uint8Array[] = []; let size = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    size += part.value.length;
    if (size > 4096) { await reader.cancel(); throw new ApiError(413, 'body-too-large'); }
    parts.push(part.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError(400, 'invalid-json'); }
  try { return object(value); } catch { throw new ApiError(400, 'invalid-body'); }
}

async function ingest(env: Env) {
  if (env.INGEST_ENABLED !== 'true') return { state: 'disabled' };
  providerConfig(env); // Validate configuration before reserving quota.
  const claims = await database<Asset[]>(env, 'rpc/upic_claim_market_asset', {
    method: 'POST', body: JSON.stringify({
      p_daily_limit: integer(env.DAILY_MARKET_REQUEST_LIMIT, 100, 1, 100000),
      p_spacing: integer(env.MIN_REQUEST_SPACING_SECONDS, 60, 6, 86400)
    })
  });
  const asset = claims[0];
  if (!asset) return { state: 'idle-or-budget-limited' };
  let result;
  try {
    const chain = chainFor(asset.chain);
    result = await poolSnapshot(env, chain, addressFor(chain, asset.token_address), addressFor(chain, asset.pool_address, true));
    let context;
    try { context = await blockContext(env, chain); }
    catch (error) { context = { state: error instanceof ApiError ? error.message : 'rpc-unavailable', marketDataVerified: false }; }
    const serialized = JSON.stringify(result.raw);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized)));
    const digest = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    await database(env, 'rpc/upic_record_market_snapshot', {
      method: 'POST', body: JSON.stringify({ p_asset: asset.id, p_snapshot: result.snapshot, p_raw: result.raw, p_digest: digest, p_block: context })
    });
    return { state: 'stored', asset: asset.id };
  } catch (error) {
    const state = error instanceof ApiError ? error.message : 'ingestion-failed';
    // Persist a redacted error; never log provider URLs, credentials, or raw errors.
    await database(env, `upic_market_assets?id=eq.${asset.id}`, {
      method: 'PATCH', body: JSON.stringify({ last_error: state }), headers: { Prefer: 'return=minimal' }
    });
    return { state, asset: asset.id };
  }
}

async function route(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') return json({
    service: 'upic-market', databaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY),
    provider: providerConfig(env).mode, ingestionEnabled: env.INGEST_ENABLED === 'true',
    publicMarketData: env.PUBLIC_MARKET_DATA === 'true', minting: 'not-implemented'
  });
  if (request.method === 'GET' && url.pathname === '/v1/chains') {
    const configured = rpcURLs(env);
    return json({ chains: CHAINS.map(chain => ({ ...chain, rpcConfigured: Boolean(configured[chain.id]), coverage: 'configured-target-not-validated' })) });
  }
  if (url.pathname.startsWith('/admin/')) {
    await authorize(request, env);
    if (request.method === 'POST' && url.pathname === '/admin/ingest') return json(await ingest(env));
    if (request.method === 'POST' && url.pathname === '/admin/assets') {
      const input = await body(request), chain = chainFor(input.chain);
      const assets = await database<Asset[]>(env, 'rpc/upic_register_market_asset', {
        method: 'POST', body: JSON.stringify({
          p_chain: chain.id, p_token: addressFor(chain, input.token), p_pool: addressFor(chain, input.pool, true),
          p_poll_seconds: integer(input.pollSeconds, 900, 60, 86400),
          p_max_assets: integer(env.MAX_TRACKED_ASSETS, 10, 1, 10000)
        })
      });
      if (!assets.length) throw new ApiError(409, 'asset-capacity-reached');
      return json({ asset: assets[0], state: 'registered-unverified' }, 201);
    }
    if (request.method === 'GET' && url.pathname === '/admin/assets') return json(await database(env, 'upic_market_assets?select=id,chain,token_address,pool_address,poll_seconds,enabled,last_attempt,last_error&order=created_at.asc'));
    return json({ error: 'not-found' }, 404);
  }
  const match = /^\/v1\/markets\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (request.method === 'GET' && match) {
    if (env.PUBLIC_MARKET_DATA !== 'true') throw new ApiError(403, 'public-market-data-disabled');
    const chain = chainFor(match[1]), token = addressFor(chain, match[2]);
    const query = new URLSearchParams({ select: 'id,poll_seconds,last_error', chain: `eq.${chain.id}`, token_address: `eq.${token}`, enabled: 'eq.true', limit: '1' });
    const assets = await database<(Asset & { last_error: string | null })[]>(env, `upic_market_assets?${query}`);
    const asset = assets[0];
    if (!asset) throw new ApiError(404, 'market-not-tracked');
    const rows = await database<{ snapshot: Record<string, unknown>; block_context: unknown; raw_sha256: string }[]>(env,
      `upic_market_snapshots?asset_id=eq.${asset.id}&select=snapshot,block_context,raw_sha256&order=observed_at.desc&limit=1`);
    const row = rows[0];
    if (!row) return json({ state: 'awaiting-observation', lastError: asset.last_error }, 202);
    const age = Date.now() - Date.parse(String(row.snapshot.observedAt));
    return json({
      state: asset.last_error || age > Math.max(120000, asset.poll_seconds * 2000) ? 'stale' : 'snapshot',
      snapshot: row.snapshot, blockContext: row.block_context, rawSha256: row.raw_sha256,
      lastError: asset.last_error, attribution: 'Market data by CoinGecko / GeckoTerminal'
    });
  }
  return json({ error: 'not-found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGIN;
    if (origin && origin !== allowed) return json({ error: 'origin-forbidden' }, 403);
    let response: Response;
    try {
      response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) : await route(request, env);
    } catch (error) { response = json({ error: error instanceof ApiError ? error.message : 'service-unavailable' }, error instanceof ApiError ? error.status : 503); }
    response.headers.set('Vary', 'Origin');
    if (origin && allowed) response.headers.set('Access-Control-Allow-Origin', allowed);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  },
  scheduled(_event: unknown, env: Env, ctx: Context) {
    ctx.waitUntil(ingest(env).catch(() => { console.error('UPIC market ingestion unavailable; check configuration and database.'); }));
  }
};
