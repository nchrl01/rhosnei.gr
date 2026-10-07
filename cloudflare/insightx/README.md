# UPIC InsightX adapter

Deploy this folder as a Cloudflare Worker. Add `INSIGHTX_API_KEY` as an encrypted
runtime secret in Cloudflare, never a repository file or public build variable.
The SQLite Durable Object uses the free plan and is created by the migration.

`GET /clusters?network=sol|eth|base&address=...` returns delayed cluster snapshots.
`GET /health` reports configuration without revealing credentials.

The single shared cache retains successful snapshots for six hours. Global
upstream allowance: 28 calls per UTC day (at most 868 in 31 days), one per 16
seconds. Errors back off; unavailable data never becomes invented holders.
Other applications using the same InsightX account share its provider quota.
Only documented networks are enabled; Robinhood is not supported here.

CORS restricts browser origins, not arbitrary HTTP clients. The global budget
also bounds requests from non-browser clients. A public visitor could exhaust
the small daily allowance; cached snapshots remain available. No paid upgrades
or automatic billing changes are configured.

Clusters are inferred wallet relationships, not people or verified ownership.
These are current snapshots, not historical replay data or watcher counts.

## Short take links

`POST /takes` stores one public frozen candle score (up to 64 KiB and 256
rows) and returns a 16-character content ID. `GET /takes/:id` restores it.
Identical scores reuse the same ID. The independent SQLite TakeStore namespace
keeps existing links; it limits new entries to 500/day and 10,000 in total,
returning a capacity error instead of increasing storage indefinitely. It does
not consume InsightX calls, store audio files, or change paid-plan settings.
