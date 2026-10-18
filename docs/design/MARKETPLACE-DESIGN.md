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

Public snapshots: PEPE, SHIB, BRETT, DEGEN, FLOKI and TURBO, where provider data is available. Artwork comes from the existing renderer using the saved market and top-holder sample, not a desktop screenshot. Input provenance is retained in scripts/data/marketplace-preview-inputs.json; public card metadata is marketplace-preview-coins.json. Holder sampling is not a full holder index. Downloaded token imagery is input to the existing renderer, not reference-site imagery.

Live player: save at most one frame per minute per current coin on this device, retain at most 24 coins, skip replay and test-milestone simulation. IndexedDB is optional; failures never interrupt playback. The gallery chooses the newest available saved/public frame for each coin. These are not globally shared latest frames; a hosted capture pipeline will be needed for that.

Mobile shell: a direct marketplace icon, search button, existing volume control and wallet icon in a 56px header; 44px utility footer in normal page flow with token prices, Networks and More. More exposes About and upcoming legal/community links. No hamburger menu or footer wallet button. Search uses a full-screen native dialog with back, rounded search bar, explicit clipboard button, removable recent coins and real token suggestions. Trader/wallet tabs from the supplied reference are not shown because those searches are not implemented.

## Expanded catalogue
The timestamped public catalogue contains 1,000 distinct coins ordered by current market cap, plus Jean Phil as an explicitly requested emerging token. CoinGecko supplies ranks, market metrics, images, contract mappings and trending-search positions; DexScreener supplies Jean Phil's market snapshot. The contract was matched to CoinMarketCap's published Solana address before adding it. Discover prioritizes explicitly featured entries and provider trending-search rank; it does not claim social mention counts or safety. Top 1,000 is separate from Trending & emerging and Captured. Images are coin artwork unless a real UPIC frame exists; labels distinguish them. Native assets use public exchange-pair search rather than invented contracts.

At most 40 cards render initially; Load more adds another 40. Filters and search operate on the cached catalogue, not 1,000 live API requests. Each card's market snapshot/capture time is visible. Refresh with `python3 scripts/build-coin-catalogue.py`; four bounded market pages, one optional fill page for moving-rank duplicates, a contract-list request, a trending request and a verified Jean Phil query. No periodic automation was installed. The as-of timestamp describes a fetched cohort, not atomic real-time ranks.

Mobile filters live in the full-screen search menu. The network/sort controls move there on phones and return to the gallery toolbar on desktop. Search covers the complete cached catalogue and the newest available captured frames, with additional results loaded in batches. A missing capture uses labelled coin artwork; it is never portrayed as an actual player frame.


## Neutral seed studies and captures

Catalogue cards prefer a saved neutral UPIC frame, then the supplied neutral real-data preview, then a labelled Seed preview. Earlier directional (+/×) saved frames are excluded. New player captures wait for neutral dot weights.

The 1,001 seed studies use the existing EarthBound renderer at a fixed phase with each catalogue coin key and market cap. Their benchmark is explicitly simulated: 1,024 equal USD balances, $100,000 reference liquidity, 100 BPM, no directional change. They are monochrome comparative studies, not actual wallet holdings, live screenshots, or predictions. Hover text explains this distinction; the Captured filter excludes them. Market snapshot dates describe the catalogue data, not a live capture.

Regenerate with `UPIC_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/render-marketplace-seeds.mjs` from the repository root. The generator uses an isolated local browser and blocks external requests. Static WebP files are lazy-loaded; no per-card visual engine runs in the gallery.

Gallery batches append automatically near the bottom, retaining Load more as a fallback. Trending discovery requires at least $1M market cap.
