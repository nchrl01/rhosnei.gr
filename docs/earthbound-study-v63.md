# Earthbound study v63 integration

Backup: backup/before-earthbound-v63-2026-10-18 (d519e09).

Ported the current test into the existing UPIC renderer, not the study interface.
- No Monogrid transition effects.
- Regular non-overlapping holder cells; one dot per supplied positive wallet balance, up to 10,000.
- Sizes and faintness use both absolute USD bags and bag / liquidity. Tiny bags cannot dominate thin liquidity.
- Low-cap footprint gathers in the centre with address-derived irregular edge taper. It opens fully at $1M; cap is clamped at $1B.
- Lower liquidity means tighter gaps; higher liquidity means larger gaps.
- Image detail reaches 64 cells per side at $10M.
- White until $50M, then a finite stepped reveal of two original-image primary colours. Falling below reverses it. Black artwork is lifted enough to remain visible.
- Original play/pause envelope retained; no audio-level coupling.
- GPU and software renderers both receive holder faintness and the same palette.
- Unknown liquidity/cap do not inherit the study's simulated dollar defaults.
- Existing latest holder-count UI changes retained.

## Provider wiring

Market selection/snapshots in app.js use Dexscreener and GeckoTerminal; live price/trade adapters feed contextualizeMarket. The visual reads context.latestCap, observation.liquidity, music.changePct, music.tempo and freshness.
Liquidity expires after 20 seconds without a fresh market snapshot.

holder-metadata.js calls the Cloudflare /holders relay, with direct GeckoTerminal token-info fallback. This yields total count and timestamp, not individual balances.

holder-clusters.js calls /clusters on upic-insightx.nchrl01.workers.dev for Ethereum, Base and Solana. InsightX cluster wallet supply percentages are converted to USD using latest cap. Other networks are currently unsupported by this wallet source.
The relay caches six hours, allows 28 upstream calls/day and retains delayed snapshots for up to one day. This is a partial relationship sample, not a complete holder census.

A public relay read on 2026-10-18 returned configured:true. The cached PEPE snapshot returned clusters:[] and no wallet records, despite being a successful snapshot.
Aggregate counts cannot recreate the per-wallet dollar balances needed for this engine. No simulated wallets were introduced. Replay has no historical individual holdings and remains without holder marks.
Full coverage requires a per-wallet balance indexer/API (including token units/decimals or USD value, token/chain identity, timestamp, pagination and coverage), or archived historical snapshots for replay. No additional provider account, secret or subscription was configured.

Renderer diagnostics expose totalHolders separately from holderSamples/markCount and holderProviderState.
