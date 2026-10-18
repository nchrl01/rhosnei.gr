# Marketplace test design

Reference captures inspected 18 October 2026:
- https://courtyard.io/marketplace — desktop and mobile screenshot + page text via Firecrawl.
- https://opensea.io/ — desktop and mobile screenshot + page text via Firecrawl.

## Observed reference patterns
Courtyard: dense artwork-first inventory; contained card surfaces; image, name and value hierarchy; a single search/filter toolbar. Its mobile capture has two cards per row and compact controls above them. Extracted branding reports a black background, white primary text, blue primary controls, 4px spacing unit and 8px radii. These tokens vary from its slightly lighter card surfaces visible in the capture.

OpenSea mobile: hamburger and brand at left; search and account action at right; horizontally browsable categories/networks; a narrow bottom utility bar showing the native price and compact controls. Desktop uses a left navigation rail. Extracted branding reports background #101011, white primary text, gtAmerica typography and subdued outlined controls. Captures establish the closed-menu layout; expanded menu contents were not inspected.

## UPIC adaptation (proposed implementation, not copied reference values)
Keep black #000, existing Unifont typography, existing three font-size tokens, white controls and no bold. Card spacing 24px desktop / 12–16px mobile. Use four artwork cards per row at normal desktop widths, five on wide screens, three on tablet, two on phone. Keep the artwork itself square and the metadata below it.

The primary gallery contains possible coin collectibles, clearly marked as preview-only. It shows a captured visual from UPIC's existing renderer, ticker, originating network, actual snapshot market cap and capture timestamp. No fake listing prices, sales, editions or ownership. The existing OpenSea collection browser remains available in a separate tab.

Public captures are original WebP pixels from the actual live player, stored only in Cloudflare for exact catalogue network/address identities. The capture runner uses the same instrument page, history, holder and market pipeline with silent visual playback. It never replaces holdings or normalizes brightness. Metadata includes actual render time and observed-data coverage.

The gallery reads the shared paginated manifest on opening, every minute while visible and on focus. It retains only in-memory metadata. No browser capture queue, IndexedDB archive or static seed fallback remains; legacy capture IndexedDB is deleted. Newer captures replace earlier captures atomically in the shared store. An absent capture remains pending. The old neutral-only gate is removed: directional shapes stay exactly as rendered live.

## Expanded catalogue
The timestamped public catalogue contains 1,000 distinct coins ordered by current market cap, plus Jean Phil as an explicitly requested emerging token. CoinGecko supplies ranks, market metrics, images, contract mappings and trending-search positions; DexScreener supplies Jean Phil's market snapshot. The contract was matched to CoinMarketCap's published Solana address before adding it. Discover prioritizes explicitly featured entries and provider trending-search rank; it does not claim social mention counts or safety. Top 1,000 is separate from Trending & emerging and Captured. Gallery artwork contains actual player frames only. Native assets use public exchange-pair search rather than invented contracts.

At most 40 cards render initially; Load more adds another 40. Filters and search operate on the cached catalogue, not 1,000 live API requests. Each card's market snapshot/capture time is visible. Refresh with `python3 scripts/build-coin-catalogue.py`; four bounded market pages, one optional fill page for moving-rank duplicates, a contract-list request, a trending request and a verified Jean Phil query. The catalogue itself is refreshed separately from the hourly live-capture workflow. The as-of timestamp describes a fetched cohort, not atomic real-time ranks.

Mobile filters live in the full-screen search menu. The network/sort controls move there on phones and return to the gallery toolbar on desktop. Search covers the complete cached catalogue and the newest available captured frames, with additional results loaded in batches. A missing gallery capture remains pending. Small search identity thumbnails may use the original coin image.


## Actual live capture collection

`.github/workflows/captures.yml` runs 40 attempts hourly with two isolated players and a 90-second limit per coin. Half the scheduled batch refreshes the oldest captures (over one hour old), with unused slots going to missing coins. Manual runs default to 100, prioritizing one supported identity per coin before alternate networks. Failed providers cannot starve refreshes. This is a periodic capture service, not an instantaneous full-catalogue feed.

Writes require a signed GitHub Actions OIDC token restricted to this repository, main branch and capture workflow. Cloudflare accepts only the 2,425 exact bundled catalogue identities; the current runner has observed-holder providers for 1,809 identities across 820 coins. The store keeps one latest image per identity, capped at 750 KB/image and 64 MiB total. Capacity errors preserve earlier frames.

Local development captures use a temporary output directory outside the public site. Native coins without token identifiers and networks without an observed-holder source are reported honestly; they cannot be filled with simulated wallet balances. Robinhood can use the existing private Blockscout connection through a cached, catalogue-only, daily-budgeted relay. Wallet samples carry actual coverage and retrieval times; initial public pagination settles after 30 seconds, retaining real records rather than waiting indefinitely.
