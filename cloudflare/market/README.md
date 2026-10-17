# UPIC market backend

This is the first backend stage for NFT-backed UPIC collections. It ingests a
small operator-selected set of pools into Supabase and exposes saved snapshots.
It does not deploy contracts, mint NFTs, sign transactions, render media, publish
to IPFS, or accept permanent milestone upgrades. The existing browser feeds are
unchanged; the player has not yet been switched to this backend.

## Start without a paid subscription

- A free Supabase project supplies Postgres and its server REST API.
- A free Cloudflare account hosts the Worker, subject to invocation/CPU limits.
- The default GeckoTerminal public API does not require an API key. This is
  low-volume development access, not a production tick stream or an unlimited
  historical archive.
- QuickNode is optional for ingestion. A trial can supply block context. Until
  configured, snapshots explicitly report that blockchain context is missing.
- No Bitquery, Pinata, R2, or rendering subscription is needed for this stage.

Provider subscriptions and redistribution permissions must be settled before
public production use. Turning on an environment flag is not a licence. Current
provider documentation: [CoinGecko](https://www.coingecko.com/en/api/pricing),
[QuickNode](https://www.quicknode.com/pricing),
[Supabase](https://supabase.com/pricing),
[Workers](https://developers.cloudflare.com/workers/platform/pricing/).

## Configure

1. Create a Supabase project and run
   `supabase/migrations/202610110001_market_data.sql` in its SQL editor.
2. Set Worker secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `ADMIN_TOKEN`.
   Use a server secret key (`sb_secret_...`) or legacy service-role JWT, never
   a publishable/anonymous key. The admin token must be random and at least 32
   characters long. Do not put any of these secrets into the static website.
3. For local configuration, copy `.dev.vars.example` to `.dev.vars` and fill it
   in. For deployment use Cloudflare's secret settings, not `wrangler.jsonc` vars.
4. Keep `MARKET_PROVIDER=geckoterminal` for development. To use paid access, set
   it to `coingecko-pro` and supply the `COINGECKO_API_KEY` secret. Demo-key mode
   is `coingecko-demo`. The adapter selects the matching host and key header.
5. Optionally set `QUICKNODE_RPC_URLS` to a JSON object mapping canonical chain
   names to complete HTTPS endpoints. RPC URLs stay server-side. HyperEVM's
   `/nanoreth` route supports archive reads. See `src/chains.ts` for names.
6. Deploy the separate Worker when ready. It is not part of the GitHub Pages
   deployment. Register an asset through the protected endpoint below, then set
   `INGEST_ENABLED=true`. Cron reserves at most one provider request each minute.
7. Set `PUBLIC_MARKET_DATA=true` only after resolving permission to expose this
   data. Set `ALLOWED_ORIGIN` to the player origin. CORS is not authentication;
   the read endpoint is public when enabled.

The defaults cap ingestion at **100 market requests per UTC day**, with at least
60 seconds between starts, ten registered assets, and a requested 15-minute
poll interval. This is a shared quota across visitors, administrators, cron runs,
and Worker instances. Ten assets will exhaust that quota before receiving every
requested poll; defaults are intentionally suited to a small development sample.
Failed provider requests spend quota. Quotas do not include RPC calls or database
requests. Cron makes database requests even when no asset is due. Provider
credit billing can differ from request count.

## HTTP API

| Endpoint | Access | Behavior |
|---|---|---|
| `GET /health` | Public | Configuration status; no credentials or upstream calls |
| `GET /v1/chains` | Public | Ten target chains and whether an RPC URL is configured |
| `POST /admin/assets` | Admin bearer token | Register a chain/token/base-token pool |
| `GET /admin/assets` | Admin bearer token | List tracked assets and last ingestion error |
| `POST /admin/ingest` | Admin bearer token | Ingest one due asset using the shared quota |
| `GET /v1/markets/{chain}/{token}` | Public when enabled | Latest stored observation and stale status |

Registration uses `Content-Type: application/json` and this shape:

```json
{
  "chain": "ethereum",
  "token": "0x0000000000000000000000000000000000000000",
  "pool": "0x0000000000000000000000000000000000000000",
  "pollSeconds": 900
}
```

Replace addresses with a real supported token and pool. Only a pool where the
requested token is the base token is accepted by ingestion; quote-token market
cap must not be mistaken for the selected token's cap. EVM v4 pool IDs can be
32 bytes. Re-registering a token does not silently change its pool. Assets can
be disabled in the Supabase editor; pool migration needs explicit handling.

## Evidence and remaining work

Snapshots preserve decimal strings, nullable circulating market cap, separate
FDV, observation time, raw upstream JSON, and a SHA-256 of `JSON.stringify` of
the parsed upstream object. This hash detects changes to that serialized payload;
it is not a cryptographic proof of a market observation or original HTTP bytes.
Database snapshots are append-only for the Worker role. Project owners can still
change them; durable evidence publication and contract anchoring are later work.

Optional EVM context checks chain ID and records a latest, unfinalized block.
Solana checks the mainnet genesis hash and records a finalized slot. Neither
verifies that provider price/liquidity/supply came from those records. Tron's
verification adapter is explicitly pending. All ten networks are configuration
targets; authenticated provider coverage and each pool must be validated before
claiming production support.

Every snapshot is `provider-observation` with `milestoneEligible=false`. There
is no path to an automatic irreversible upgrade. Remaining stages include:
trade/candle ingestion, pool selection and migration, supply and USD valuation
rules, finality and manipulation checks, historical backfills, milestone reports,
Robinhood contracts and signing, media rendering and publication, marketplace
playback, retention/export policies, and browser integration.

## Verification

`npm run typecheck` runs TypeScript without emitting or building files. No
devserver, build, database migration, deployment, or runtime test is performed
automatically. Operator checks after setup should include authentication,
concurrent quota claims, malformed addresses, wrong base token, null market cap,
provider failures, stale reads, and an incorrect RPC network. These require your
configured services; type checking alone does not establish runtime correctness.
