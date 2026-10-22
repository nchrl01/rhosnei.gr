# Native coin contract references

The live player attaches these same-chain wrapped counterparts to BNB and NEAR.
The address row labels them as wrapped, underlines only the address on hover,
and copies the complete wrapped contract when clicked. Native coin identity,
market data, holder data, saves and capture keys remain native.

Verified 2026-10-23:

| Native coin | Network | Wrapped token | Contract | Issuer source |
| --- | --- | --- | --- | --- |
| BNB | BSC | WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | https://www.bnbchain.org/en/blog/what-is-wbnb |
| NEAR | NEAR | wNEAR | `wrap.near` | https://github.com/near/core-contracts/tree/master/w-near |

Activity was checked through public pool APIs. Dexscreener returned the canonical
WBNB/USDT pool with approximately $15.96m liquidity and $81.42m daily volume.
GeckoTerminal returned wrap.near pools with approximately $89.93m–$103.44m reserves
and $4.31m–$8.85m daily volume for the first two stablecoin pools. These are
point-in-time API observations, not an exhaustive cross-chain popularity ranking.

Sources:
- https://api.dexscreener.com/tokens/v1/bsc/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
- https://api.geckoterminal.com/api/v2/networks/near/tokens/wrap.near/pools

Additional native assets require individually verified references. No ticker-only
contract lookup or automatic substitution is used.
