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

Mobile shell: hamburger navigation, search button, existing volume control and wallet icon in a 56px header; fixed 44px utility footer with token prices, Networks and More. More exposes About, upcoming legal/community links and Connect Wallet. These are UPIC choices inspired by the observed OpenSea arrangement, not a pixel-identical copy.
