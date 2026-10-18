# Actual holder balances for Earthbound

The browser now requests public Blockscout token metadata and paginated ERC-20 holder balances. No API key or Worker deployment is required. Existing holder-count and InsightX relationship APIs remain separate.

Data path:
1. holder-metadata.setMarket starts holder-balances for the selected chain/address.
2. GET /api/v2/tokens/{address} supplies decimals and indexed holder count.
3. GET /api/v2/tokens/{address}/holders supplies wallet addresses and raw balances. Follow validated next_page_params, 50 records/page, paced at 750 ms, up to 10,000 records. Stop/abort when selecting another coin. Hidden tabs pause pagination.
4. Decimal strings are scaled before conversion to JavaScript numbers; raw balances and decimals are retained. Duplicate EVM addresses collapse case-insensitively.
5. audience.holdings has independent freshness; missing aggregate-count metadata does not disable valid balances.
6. observedHolderBalances values tokens at the latest UPIC quote from context.path (or latestPrice when supplied). No sample-normalized shares or hypothetical wallets.
7. Earthbound applies the existing absolute-dollar/liquidity sizing and faintness.

Networks: Ethereum, Base, Arbitrum, Optimism, Polygon, ZKsync, Celo, Robinhood. Hosts come from the official Blockscout chain directory. Other GoPlus-supported EVM networks and Solana use actual GoPlus top-holder samples. InsightX remains the final fallback.

Coverage:
- Publish each received page, explicitly loading/partial until pagination completes.
- The largest 10,000 are a capped sample for larger tokens, never claimed as all holders.
- Indexed lists include contract and exchange addresses. They represent on-chain holding addresses, not individual people or custodial beneficial owners.
- GoPlus returns a small top-holder sample; never label it a complete census. Distinct sampled Solana token accounts aggregate by owner, duplicates do not add funds.
- Snapshot retrieval takes time; pages are not guaranteed to share one block.
- Session cache: 15 minutes, hard expiry after one hour. Rate limiting backs off 5 minutes; other errors 2 minutes. No uncontrolled retry loop or paid account creation.
- Replay does not reuse today's balances as historical data.
- Holder count tooltip and engine inspector expose balance coverage; renderer diagnostics retain it.

Provider discovery on 2026-10-18:
- Public Ethereum Blockscout returned 50 PEPE holders plus next_page_params, decimals=18, holders_count=595967, raw balances as decimal strings.
- CORS response allows browser origin; advertised request limit 180.
- Existing public Solana RPC rejected getTokenLargestAccounts with HTTP 403. GoPlus Solana token_security did return actual token-unit balances (account, token_account, balance); those records now supply a labelled partial sample.
- Cloudflare deployment CLI is not authenticated. This public API path does not need Cloudflare credentials. No existing Worker secrets changed.

Sources:
https://docs.blockscout.com/devs/apis/rest
https://docs.blockscout.com/devs/apis/rpc/token
https://chains.blockscout.com/api/chains
https://solana.com/docs/rpc/http/gettokenlargestaccounts

Build: shared static shell. No browser or automated test suite was run for this change.

New main changes preserved: GoPlus total-count fallback, private Robinhood Blockscout count relay, and pool-liquidity freshness improvements. GoPlus holder records were previously discarded; fetchGoPlusCount now retains them. No new key, paid plan or Worker secret required.
https://docs.gopluslabs.io/reference/response-details
https://docs.gopluslabs.io/reference/solanatokensecurityusingget
