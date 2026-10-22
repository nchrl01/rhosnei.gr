# Testnet and private staging

Everything here runs on test networks with valueless assets. Nothing is a public offering.

## Public staging interface on GitHub Pages

The interface is published at https://upic-art.github.io/rhosnei.gr/staging/.
The Pages workflow builds production from `main` and the staging interface from
`staging/testnet-readiness`, then publishes them in one artifact. A completed
Staging workflow refreshes this Pages build without deploying from an unapproved
branch into the production Pages environment.

This path is public, with `noindex,nofollow`; it is not protected by Cloudflare
Access. No secrets are included. Until a public staging API is configured through
the repository variable `STAGING_PUBLIC_API_URL`, the interface displays an
unconnected status and disables wallet connection. Publishing this interface does
not deploy contracts, the platform API, or the private Cloudflare environment.
A future API endpoint must explicitly allow the Pages origin and handle cross-origin
sessions; the existing private service binding cannot be used as that endpoint.

## What deploys where

| Piece | Source | Staging Worker | Public URL |
|---|---|---|---|
| Gateway (site + Access check) | `infra/staging/` | `pv-gate` | `pv-gate.<subdomain>.workers.dev`, behind Cloudflare Access |
| Data (holders, history, captures, profiles) | `cloudflare/insightx` (`--env staging`) | `pv-data` | none (service binding only) |
| Platform API (sign-in, mint signatures, indexer, upkeep, faucet) | `apps/api` (`--env staging`) | `pv-api` | none (service binding only) |
| Contracts | `contracts/` | — | Robinhood Chain testnet (46630); Arbitrum Sepolia (421614) as fallback |

Production (GitHub Pages and `upic-insightx`) is untouched. Staging has its own Durable Objects, so its profiles and caches never mix with production data. Marketplace live captures are read from production, which is public anyway, so there is no second capture fleet to pay for.

Workflows:
- **Staging** (`staging.yml`) runs on every push to `main` or `staging/**`. It builds, deploys, configures Access and runs a smoke test. Until Cloudflare secrets exist it exits with a notice rather than failing.
- **Contracts** (`contracts.yml`) runs tests on every contract change. Deploys run manually (Actions → Contracts → Run workflow), or on push when the repository variable `AUTO_DEPLOY_CONTRACTS=true` is set. Deploys are gated by the `testnet` environment.

## One-time setup

1. **Cloudflare**
   - Open Zero Trust once and choose the Free plan, which covers up to 50 users.
   - Create an API token with these permissions:
     - *Account › Workers Scripts: Edit*
     - *Account › Access: Apps and Policies: Edit*
     - *Account › Access: Service Tokens: Read*
     - *Account › Access: Organizations, Identity Providers, and Groups: Read*
     - *Account › Workers AI: Read*
     - *Account › Account Settings: Read*
   - Under Zero Trust → Access → Service Auth, create a service token named `pv-ci`.
2. **GitHub repository secrets** (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. **GitHub Environment `staging`**:
   - Variable `ACCESS_EMAILS`: comma-separated tester emails.
   - Secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, from the service token.
   - Optional variable `STAGING_REOWN_PROJECT_ID`: a separate Reown project with the staging hostname allow-listed.
   - Optional data secrets, copied from production if you want the same coverage: `GOPLUS_APP_KEY`, `GOPLUS_APP_SECRET`, `BLOCKSCOUT_API_KEY`, `OPENSEA_API_KEY`, `INSIGHTX_API_KEY`.
4. **Keys.** Run `node infra/staging/new-keys.mjs --gh` on your own machine. It generates five throwaway keys and stores them in the `testnet` and `staging` environments; nothing is printed or written to disk. Then fund the printed deployer, mint-signer, relayer and faucet addresses from the [Robinhood testnet faucet](https://faucet.testnet.chain.robinhood.com). QuickNode's faucet is a backup.
5. **GitHub Environment `testnet`.** Add yourself as a *required reviewer*, so every contract deploy waits for approval. Optionally set `RH_RPC_URL` to a QuickNode or Alchemy endpoint; the public RPC is shared and rate-limited.
6. **Deploy.** Run *Contracts* manually, then *Staging*. The gateway serves the addresses at `/config/deployment.json`, and the API reads them from `DEPLOYMENT_JSON`.

To run the full mint pipeline as well, also set `DEPLOY_PLATFORM_API=true` and these in the `staging` environment:
- the `POSTGREST_URL` variable;
- the secrets `POSTGREST_TOKEN`, `SESSION_SECRET` (32+ characters), `ADMIN_TOKEN`, `RENDERER_TOKEN`, `PINATA_JWT`, `PINATA_GATEWAY`, `OKX_API_KEY`, `OKX_SECRET`, `OKX_PASSPHRASE` and `SOURCE_RPC_JSON`.

These connect to the existing Supabase, IPFS and renderer stack (see `infra/`). Without them, staging still serves the instrument, the data worker and the contract addresses, but minting through the API stays disabled.

## How discreet this is, honestly

- **Hidden:**
  - The site requires an Access login.
  - The gateway also verifies the Access JWT itself, so a deleted or misconfigured Access policy fails closed (HTTP 403).
  - Backing Workers have no public URL.
  - `noindex` headers and a deny-all `robots.txt` are served, and source maps are stripped.
  - The staging hostname is masked in CI logs.
  - Deployment addresses live in CI artifacts, not in the repo; `contracts/deployments/*.json` is gitignored.
- **Neutral on-chain labels:**
  - The test token deploys as "Staging Utility Token (TEST)" / `tSTG`; override this with the `TEST_TOKEN_NAME` and `TEST_TOKEN_SYMBOL` variables.
  - The EIP-712 domains are `Factory`, `Collection` and `Market`.
  - Source is **not** verified on the explorer unless you tick *verify* when deploying.
- **Not hidden:**
  - Testnets are public. Anyone following the deployer address, the factory's events or the bytecode can find the contracts.
  - The workers.dev hostname contains the account subdomain.
  - Treat obscurity as delay, never as access control.
  - Keep "TEST" in the token name so it can never pass as a real asset.
  - Use a fresh deployer per environment and never reuse these keys on mainnet.

## Tokenomics (testnet parameters)

All values are test-unit defaults. Change them with `factory.setEconomics(fee, basePrice)` or the deploy env (`CREATION_FEE`, `BASE_PRICE`).

| Lever | Value |
|---|---|
| Creation fee | 1,000 test tokens per collection: 50% burned, 50% to the protocol treasury. Requires one approval. |
| Editions | 100 per collection. Edition 1 (Genesis) goes to the initiator at creation. |
| Primary price | Stepped over the 99 sold editions: #2–26 at 1×, #27–51 at 1.25×, #52–76 at 1.5×, #77–100 at 2× the base price (0.002 test ETH). Overpayment is refunded. |
| Primary split | Initiator 30% · protocol 25% · **art upkeep 25%** · buyback-and-burn 20% |
| Secondary (own marketplace) | 6% total: 5% ERC-2981 royalty (initiator 2%, upkeep 2%, buyback 1%) plus a 1% protocol fee. Self-trades are rejected. |
| External royalties | ERC-2981 pays the collection, which forwards to the vault: 40% initiator, 40% upkeep, 20% buyback. |
| Upkeep pool | 10% of every upkeep inflow goes to a shared pool that keeps underfunded collections at a weekly cadence. |

## Funding living art

Each collection's maintenance treasury (`RevenueVault.maintenance[collection]`) pays for the API calls and compute that keep its art current.
- **Debit.** The API's upkeep job (`apps/api/src/upkeep.ts`) runs at 07 past each hour and acts on at most 10 collections per run. Each collection is handled once per UTC day; the cap (`maxUpkeepPerEpoch`) and the once-per-UTC-day rule are both enforced on-chain.
- **Charge by cadence.** The job charges that day's cost for the collection's cadence through `debitUpkeep`: full for live, half for daily, a seventh for weekly, nothing while hibernating.
- **Cadence.** The job then sets the collection's cadence from its remaining runway and emits ERC-4906 refresh signals:

| Runway | Cadence | Signals |
|---|---|---|
| ≥ 365 days | live | daily |
| 90–364 days | daily | daily |
| 30–89 days (or kept up by the pool) | weekly | weekly |
| < 30 days | hibernating | once; the archived Genesis media is recorded on-chain as `hibernationSnapshot`, and renders stop |

- **Top-ups.** Anyone can extend a collection's runway with `fundMaintenance(collection)` (the *Fund art upkeep* button). Any top-up revives a hibernating collection at the next daily run.

At the default live cost of 0.00002 ETH/day (about $1.80/month at $3,000/ETH), the share of a sold-out collection's primary sales that stays in its own treasury (25% upkeep, minus the 10% that goes to the pool) funds roughly 3,200 days of live updates. Cheap or unsold collections slow down instead of breaking. That matters because Async Art showed dynamic NFTs need a permanent fallback state.

## API cost outlook

| Scale | Monthly | Main drivers |
|---|---|---|
| Testnet (~100 coins hourly, private) | ~$5–40 | Cloudflare Workers Paid $5; free data tiers |
| 1,000 coins hourly (public beta) | ~$175–480 | CoinGecko Basic $35 (commercial licence), Etherscan Lite $49 for BNB/Base, Blockscout PRO up to $49, GoPlus up to $199 |
| Near-real-time + ~10k daily users | ~$1,000–1,800 | CoinGecko Analyst/Lite, Blockscout Pro, GoPlus, dedicated RPC |

Before any non-private user:
- Replace CoinGecko Demo, which does not allow commercial use.
- Paid Etherscan is needed for chains 56 and 8453.
- Arbitrum's free Etherscan quota moves to a shared pool on 1 November 2026.

Captures cost $0 in Actions minutes on a public repo, or about $96/month on a private one.

Prefer batched `/coins/markets` calls (250 coins each), and refresh holders every 6–24 hours.

## Before any mainnet

- Get legal review of the utility token, in particular revenue-funded buyback-and-burn under Howey and MiCA.
- Get an external audit.
- Add an initiator claim delay and wash-trade heuristics in the indexer.
- Have the upkeep job pin an IPFS/Arweave snapshot per epoch.
- Add Robinhood mainnet (4663) as a source chain if needed: `factory.setSourceChain(4663, true)`.
