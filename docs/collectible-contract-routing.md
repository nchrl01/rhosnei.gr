# Contract-linked collectibles

Collectible cards select an exact contract/token identifier and network before
forming a link. They never navigate through native `SYMBOL/USD` or exchange
fallbacks. The main instrument can still open explicitly selected native markets.

- `collectible-selection.js` owns contract selection, exact capture matching and
  strict contract URLs.
- Verified native counterparts from `native-contracts.js` take precedence.
- Explicit network filters never substitute a different chain.
- `coinPreview` remains available for the independent native instrument search.
- Marketplace search suggestions use contract selection, while exact saved
  markets and explicit exchange search retain their existing identities.
- Original native artwork, holder totals, market cap and liquidity are not reused
  as observations of a wrapped or bridged contract.
- Cards without a verified contract have no href and show CONTRACT UNAVAILABLE.
- Named verified identifiers, including `wrap.near`, use exact token discovery.

`collectible-ca-links.json` records all 100 slots: 94 contract links and 6 pending
at this catalogue revision. The 100-coin market-cap order is unchanged.

## Capture integration

`scripts/attach-collectible-contracts.mjs` adds the verified identifiers to public
platform metadata and the cloud publisher's exact-identity allowlist, without
changing native identities or ranks. Its changes are idempotent. The proposed
workflow uses `--contracts-only` so collectible captures follow their contract
links, including BNB/WBNB and BTC/WBTC. Native captures remain separately addressable.

The user explicitly approved the production backend update. The exact-identity
allowlist was deployed on 2026-10-23 (Worker version
`2fe6a17c-3d68-401e-928a-76e3b2387080`) before publishing the matching
workflow and catalogue updates.

## Follow-up verification and marketplace repair

See `new-contract-verification-2026-10-23.json` for the eight newly verified
identities and source-backed reasons for the six remaining entries. Verification
means contract identity, not a guarantee of bridge backing, safety, or available
market observations. No native artwork or metrics are substituted for wrappers.

The gallery rendering regression was an update-before-append error: the name
node was queried before it existed. The offline gallery check renders all 100
cards and asserts 94 exact contract links. The address-copy fixture now provides
the DOM methods used by the current control. Full workspace checks pass
(198 passed, 2 intentionally skipped); browser control was not used.
