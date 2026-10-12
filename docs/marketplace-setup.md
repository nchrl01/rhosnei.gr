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
