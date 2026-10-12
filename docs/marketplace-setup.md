# Marketplace integration status

Configuration required on `upic-insightx`:
- Secret `OPENSEA_API_KEY` — never commit this value.
- Public variable `REOWN_PROJECT_ID`.
- Allow `https://nchrl01.github.io` in the Reown project settings.

Prepared: cached collection discovery relay, pagination, collection links, lazy-loaded EVM/Solana AppKit connection.
Pending: verify live API schemas and chain coverage, global search, NFT detail/listing UI, transaction preparation and validation, buy/list/offer/cancel flows, dedicated Abstract/Base Account connectors, Glyph/VeeFriends compatibility.
Do not describe collection links as native trading. Trading is explicitly false in the backend config until these flows are complete.

Build wallet assets with `node scripts/build-wallet.mjs`.
Deploy Worker from cloudflare/insightx with Wrangler after configuring credentials.


## Connected October 12, 2026
OpenSea temporary key is an encrypted Cloudflare runtime secret. It expires October 19, 2026 at 16:39 UTC and needs replacement before then. No secret is included in browser code. Collection search, supported network filters, pagination and collection NFT browsing use the relay. Trading links open the exact NFT on OpenSea; native order creation, fulfillment, offers and cancellation are not implemented. Wallet connection is separate from transaction execution.
