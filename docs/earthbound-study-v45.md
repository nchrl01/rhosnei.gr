# Earthbound study v45 integration

Previous production version: backup/before-earthbound-test-2026-10-18 (0aeb13e).

- Existing UPIC interface and transport/pause envelope retained.
- One dot per supplied positive wallet balance, maximum 10,000; no repeated sample holders.
- USD holding divided by USD liquidity sets softened intrinsic diameter.
- Liquidity controls regular grid gaps, without positional noise or overlapping cells.
- Market cap controls zoom and image detail, without a separate dot-growth phase.
- Artwork detail: 4 at $3K, 8 at $100K, 16 at $500K, 32 at $2M, 64 at $10M; intermediate levels interpolate logarithmically. Liquidity does not limit detail.
- Original artwork colours tint existing marks. Earthbound patterns animate brightness; artwork no longer moves or removes marks.
- Observed supply percentages are converted to USD using current market cap. Unknown units are not treated as USD. No study simulations are shipped into the live data path.
- Missing individual holdings, including historical replay holdings, display an unavailable message; exports require holdings.

Validation: shared site shell build and JavaScript syntax checks. Browser rendering and live market feeds have not been tested for this integration.
