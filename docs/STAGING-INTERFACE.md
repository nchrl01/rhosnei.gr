# Staging interface and current engine

Staging keeps the platform and testnet flow at `/`. The live instrument is at
`/instrument`; the coin preview gallery, profile and labs are the current shared
pages. These are different views of the project, with a staging menu explaining
their purpose and connecting them.

## Navigation

- The **Testnet desk** prepares collections and editions before requesting a wallet transaction.
- **Test marketplace** lists test editions. **Test wallet** holds editions, faucets and revenue actions.
- **Live instrument** follows market data. **Coin previews** links to that instrument.
- **Saved profile** stores bookmarks. Its wallet sign-in and the platform test-wallet session are separate.
- **Labs** use simulated inputs; changes and presets stay local to the lab.

Static pages get a **Staging** menu with destination descriptions and a short guide
for the current page. Their Home links go to the live instrument. Root links with
`?coin=…` redirect to the instrument, preserving search and saved-coin links. Old
root `#search`, `#take=…` and `#score=…` links are handed to the instrument as well.
Platform tab links use `/?tab=collections`, `marketplace`, `wallet` or `explore`.

## Build isolation

`infra/staging/prepare-web.mjs` runs after the normal Vite build and only changes
`apps/web/dist`. It copies in the staging menu, adds it to HTML pages, rewrites the
data worker URL to the staging `/x` binding, removes public-host redirects and source
maps, and preserves the Cloudflare Access cookie on same-origin data requests.
Third-party market requests continue to omit cookies. Vendor code is not changed
by the credentials rewrite. Production page sources and GitHub Pages output never
receive the staging menu or endpoint rewrite.

The gateway still verifies Access before serving the application, assets or API.
API and data Workers remain private service bindings. Shared capture reads continue
to use the existing public capture pipeline; staging profiles and data caches keep
their separate Durable Objects. No contract deployment or change to testnet fees,
splits, supply, signing or verification is part of this interface refresh.

## Staging release 473

The current composer is `upic-nft-gb-v7`. It retains the visual seed and the GB
cores while giving phrases room to answer, warming arps and reducing competing
noise. Market cap still shapes rhythm, liquidity harmonic stability, holders arp
span, signed price change contour, and activity tempo. Archived edition media
and deployed contract addresses are preserved. The new current-engine player
labels recompositions and does not present them as old immutable recordings.
