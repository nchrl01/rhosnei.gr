# Thirty-day chart history cache

`history-cache.js` stores DEX and public-exchange candle datasets in this browser's IndexedDB for up to 30 days from saving. Cache identity includes network/pool/base token/timeframe/aggregation for DEX candles, or exchange/symbol/timeframe for exchange candles. Currency remains USD, as in the existing loaders. Original coverage, provider observation times and gaps are preserved.

Existing localStorage entries migrate when their exact key is requested; their timestamp is not reset during migration. No unrelated user storage is removed. Storage failures fall back to fetching, not a broken player. An IndexedDB open that hangs times out after 1.5 seconds.

On reopen, saved candles render before the provider refresh. Completed DEX backfills are reused; partial backfills continue at their oldest edge, and a real gap between the recent page and saved data is bridged. The first latest-page request is reduced to the number of intervals since the latest saved candle, with overlap, bounded at 10–1,000 candles. Very recent complete datasets can skip refresh for 60 seconds. Public-exchange backfills stop once new data overlaps a sufficiently covered saved range. Current candles and live trades continue updating; this cache never freezes a market for a month.

Limits: 64 MiB estimated serialized size, 512 datasets, maximum 16 MiB per dataset, existing DEX 20,000 / exchange 1,200 candle bounds. Oldest-written/expired records are pruned under pressure. A small eight-entry memory cache covers immediate reuse. Browser quota eviction, private browsing or clearing site data can remove cached history sooner.

This is a per-browser cache, not a shared global backend archive. It saves repeat history/backfill requests on that browser; first visits on other devices still need the provider. Thirty-day retention does not guarantee market-data providers retain or never revise older candles. No schema, coverage or historical-holder data is fabricated.
