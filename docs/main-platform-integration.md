# Main instrument and collection platform

## Current boundary

`main` publishes the live static instrument in `apps/web/public` through
`.github/workflows/pages.yml`. The shell generator uses
`apps/web/legacy/site`. `npm start` and `npm run dev:instrument` serve this
instrument on port 4173.

The separate React collection application is `apps/web/src`, built by Vite from
`apps/web/index.html`. `npm run start:platform` and the unchanged `npm run dev:web`
serve it. The workspace `build`, typecheck and test commands retain their existing
platform behavior. Neither application is a replacement for the other.

## Preserve f8al3rr's progress

This cleanup does not change the platform implementation in `apps/api`,
`apps/renderer`, `apps/web/src`, `apps/web/functions`, `contracts`, `packages`,
`infra`, or `supabase`. Vite configuration, platform dependencies, deployment
workflows and the staging/testnet-readiness branch are unchanged.

The platform is not removed because it is not yet live. In particular, contract
ABIs, signatures, chain verification, mint intents, renderer/archive processing,
wallet sessions and database schemas remain owned by that implementation.

## Connect through the existing collection boundary

The instrument's `nft-owner-preview.js` already provides the collection-status
boundary. It accepts a configured collection API via `data-collection-api` or
`meta[name="upic-api-base"]`; its current policy requires a same-origin API.
It reads `/v1/config`, `/v1/collections`, then collection details. Testnet/local
configurations are deliberately not displayed as production ownership claims.

Integration requires actual deployed contracts, a working platform API/indexer,
and a deliberate hosting/proxy decision. GitHub Pages cannot execute the existing
Cloudflare Pages Functions proxy in `apps/web/functions`. Do not point the public
instrument at a testnet API to make tokenization appear available. A testnet
adapter or separate hosted platform must be agreed before enabling actions.

The registry currently returns a bounded list: a missing entry is not proof a
coin can be tokenized. Eligibility belongs to the platform's signed-intent flow.
Continue passing network plus exact token address, not ticker alone. Existing
profile saving in `cloudflare/insightx` is separate from platform wallet sessions;
there is no automatic account/session migration in this cleanup.

## Cleanup completed on main

- Removed the always-null test-mint shim, unreachable simulated activity and
  frozen test-export session from the live player. Live and replay inputs now
  reach the existing engines directly; mappings and renderer implementations
  are unchanged.
- Archived four retired simulation/export modules outside the published site.
  Existing test entry points import the archived helpers; no new tests added.
- Made the public instrument the default start command, with an explicit alias
  for the existing collection application.
- Corrected the repository's live URL and source-folder documentation.

## Deferred inventory

- `cloudflare/market`: earlier ingestion backend, disabled in checked-in config.
  Keep until deployment and database usage are inventoried; absence of a browser
  import does not prove it is undeployed.
- `audio-dots.js`: older visual wrapper, still referenced by `checks/visual-field.mjs`.
- `upic-earthbound-renderer.js` and its core/shaders: earlier renderer preserved
  pending a complete review of historical checks and partner usage.
- Root pixel-blast modules: still support labs and shared visual parameters;
  retain them. The live wrapper uses `upic-oct07-renderer.js` and `oct07-live`.
- ENVION, Pure Data, GeneralUser/Earthbound samples and MusicRNN remain connected
  to runtime paths. Hidden inspector controls are not evidence that audio is dead.

No contract deployment, ownership migration, provider changes or staging
publication is included in this cleanup.
