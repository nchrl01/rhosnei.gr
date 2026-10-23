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

`collectible-ca-links.json` records all 100 slots: 86 contract links and 14 pending
at this catalogue revision. The 100-coin market-cap order is unchanged.

## Prepared capture integration (backend approval required)

`scripts/attach-collectible-contracts.mjs` adds the verified identifiers to public
platform metadata and the cloud publisher's exact-identity allowlist, without
changing native identities or ranks. Its changes are idempotent. The proposed
workflow uses `--contracts-only` so collectible captures follow their contract
links, including BNB/WBNB and BTC/WBTC. Native captures remain separately addressable.

The production backend deployment was rejected by automatic approval review until
the user explicitly approves that production backend change. Do not bypass this
through another deployment route. Website routing can deploy independently;
new contract captures cannot publish until the backend accepts their identities.
