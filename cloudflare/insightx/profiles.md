# Private profile Saved coins

`ProfileStore` is a separate SQLite Durable Object, bound as `PROFILE_STORE`.
The worker routes `/profile/*` to `private-profiles-v1`. Saved rows are keyed by
an authenticated wallet account. No endpoint lists profiles or accepts a wallet
address as authorization to read or change bookmarks.

## Authentication

A wallet connection alone is not authentication. Request a server challenge,
sign its exact message, and exchange the signature for an opaque session token.

- EVM: EIP-4361 message, EIP-191 `personal_sign`, 0x hexadecimal signature.
  Only externally owned accounts are supported; ERC-1271/smart accounts fail
  closed without remote verification.
- Solana: exact UTF-8 challenge, Ed25519 signature encoded as standard base64
  (64 decoded bytes).
- The challenge binds origin, application URI, wallet, nonce and expiration.
  It expires after five minutes and is consumed once. A new challenge replaces
  the previous pending challenge for that wallet and origin.
- Session tokens are random 256-bit values. Only their SHA-256 digests are
  stored. Sessions last eight hours, are origin-bound, and logout revokes the
  current session. Up to eight recent sessions may exist per wallet.
- Clients keep the token in memory. Bookmarks persist on the server across
  sessions/devices; reconnecting or reloading may require signing in again.
- Existing browser bookmarks are not automatically uploaded.

All requests require the configured `ALLOWED_ORIGIN` or existing local testing
origins on ports 4173/4180. CORS permits the `Authorization` header. Responses
are `private, no-store`; the Worker does not put these responses into its public
cache. No new shared secret is required.

## API

| Method/path | Body | Response |
|---|---|---|
| `POST /profile/challenge` | `{namespace:"eip155"\|"solana",address,chainId?}` | `{challengeId,message,expiresAt}` |
| `POST /profile/login` | `{challengeId,signature}` | `{token,expiresAt,account}` |
| `GET /profile/session` | — | `{account,expiresAt}` |
| `GET /profile/saved` | — | `{coins}` |
| `POST /profile/saved` | `{coin}` | `{coins}` |
| `POST /profile/saved/remove` | `{key}` | `{coins}` |
| `POST /profile/logout` | `{}` | `{ok:true}` |

Except challenge/login, requests require `Authorization: Bearer <token>`.
`expiresAt` and `savedAt` are Unix milliseconds. `account` contains `namespace`,
`address`, `key`, and `chainId` for EVM. EVM profile keys use lowercase addresses;
Solana addresses retain case. EVM profile identity is shared across EVM chains.

The server rebuilds saved `key`, `query`, `url`, and `savedAt`, accepting only
bounded identity/display fields. DEX bookmarks retain chain and exact token
identity; exchange bookmarks retain venue/pair/native identity. Re-saving is
idempotent, and removing an absent key is harmless. Private read/write queries
always include the session account.

## Limits and failures

- 100 saved coins per account; a new item at capacity returns 409
  `saved-limit-reached` without silently deleting another item.
- 50,000 total saved rows, 1,000 pending challenges, 20,000 active sessions.
- 12,000-byte JSON request limit.
- Authentication: 10,000 requests/day globally, 30/5 minutes and 300/day per IP;
  five challenges/5 minutes per account, at most five attempts/challenge.
- Authenticated traffic: 120 requests/minute and 30 writes/minute per account.
- Expired challenge/session/rate rows are removed during requests.
- 401 requires signing in; 429 means rate or service capacity; 503 is a service
  failure. Neither connection status nor a client-supplied address bypasses it.

Verification: `node --test cloudflare/insightx/profiles.test.mjs` exercises real
ephemeral EVM/Solana signatures, nonce replay/concurrency, cross-account
isolation, expiry/logout, origins, identity normalization and bounds. Fixtures
are kept offline and never use a user's wallet.
