/**
 * Cross-chain identity for the local UPIC × Monogrid study.
 *
 * The key includes the chain AND network; the same address on Ethereum and
 * Base intentionally produces different seeds. These are app identifiers.
 * Only the eip155 entries follow the standard EVM chain-ID namespace. The
 * human-readable non-EVM entries below are not claimed to be CAIP-2 IDs.
 *
 * SHA-256 makes accidental identity collisions practically negligible. It
 * cannot promise a mathematically unique seed or visibly unique artwork for
 * every possible input. The PRNG is for repeatable graphics, not cryptography.
 * No RPC is called and no contract, token, checksum or ownership is verified.
 */

export const CHAIN_OPTIONS = Object.freeze([
  { label: 'Ethereum', value: 'eip155:1' },
  { label: 'Base', value: 'eip155:8453' },
  { label: 'Arbitrum One', value: 'eip155:42161' },
  { label: 'Optimism', value: 'eip155:10' },
  { label: 'Polygon', value: 'eip155:137' },
  { label: 'BNB Smart Chain', value: 'eip155:56' },
  { label: 'Avalanche C-Chain', value: 'eip155:43114' },
  { label: 'Gnosis', value: 'eip155:100' },
  { label: 'Solana', value: 'solana:mainnet' },
  { label: 'Sui', value: 'sui:mainnet' },
  { label: 'Aptos', value: 'aptos:mainnet' },
  { label: 'TON', value: 'ton:mainnet' },
  { label: 'Tron', value: 'tron:mainnet' },
  { label: 'Bitcoin', value: 'bitcoin:mainnet' },
].map(option => Object.freeze(option)));

/** Normalize only formats whose casing rules we know; retain others literally. */
export function normalizeIdentity(chain, address) {
  if (typeof chain !== 'string' || !chain.trim()) {
    throw new Error('Choose a chain and network.');
  }
  const trimmedChain = chain.trim();
  const separator = trimmedChain.indexOf(':');
  // A custom network reference may be case-sensitive. Normalize only the
  // namespace; do not merge two references that differ by letter case.
  const normalizedChain = separator < 0 ? trimmedChain.toLowerCase()
    : trimmedChain.slice(0, separator).toLowerCase() + trimmedChain.slice(separator);
  if (!/^[a-z0-9][a-zA-Z0-9:_./-]{0,119}$/.test(normalizedChain)) {
    throw new Error('Use a chain/network identifier of up to 120 letters, numbers, colons, dots, slashes or hyphens.');
  }
  if (typeof address !== 'string' || !address.trim()) {
    throw new Error('Enter a contract address or token identifier.');
  }
  let normalizedAddress = address.trim();
  if (normalizedAddress.length > 512) {
    throw new Error('The contract address or token identifier must be 512 characters or fewer.');
  }
  if (/\s/u.test(normalizedAddress) || /[\u0000-\u001f\u007f]/u.test(normalizedAddress)) {
    throw new Error('Remove spaces and control characters inside the address.');
  }

  if (normalizedChain.startsWith('eip155:')) {
    if (!/^eip155:[1-9][0-9]*$/.test(normalizedChain)) {
      throw new Error('An EVM chain identifier must use eip155: followed by its positive numeric chain ID.');
    }
    if (!/^0x[0-9a-f]{40}$/i.test(normalizedAddress)) {
      throw new Error('An EVM contract address needs 0x followed by 40 hexadecimal characters.');
    }
    normalizedAddress = normalizedAddress.toLowerCase();
  } else if (normalizedChain.startsWith('solana:')) {
    // A format check only. See https://solana.com/docs/core/accounts/account-structure
    // Full base58 decoding / curve membership / RPC account lookup is not done.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalizedAddress)) {
      throw new Error('A Solana address needs 32–44 base58 characters. Letter case matters.');
    }
  } else if (/^(sui|aptos):/.test(normalizedChain)) {
    // Plain hexadecimal addresses are canonicalized. Full Move coin-type
    // identifiers remain literal: their module/type names can be case-sensitive.
    // https://aptos-labs.github.io/aptos-ts-sdk/ (AccountAddress long format)
    // https://faucet.sui.io/pow-spec/ (left-zero-extension of short addresses)
    if (/^0x[0-9a-f]{1,64}$/i.test(normalizedAddress)) {
      normalizedAddress = '0x' + normalizedAddress.slice(2).toLowerCase().padStart(64, '0');
    }
  }

  return {
    chain: normalizedChain,
    address: normalizedAddress,
    // A structured encoding avoids concatenation ambiguity between the fields.
    key: JSON.stringify([normalizedChain, normalizedAddress]),
  };
}

/** Stable 256-bit digest of the normalized [chain/network, address] pair. */
export async function deriveIdentity(chain, address) {
  const identity = normalizeIdentity(chain, address);
  if (!globalThis.crypto?.subtle) {
    throw new Error('Identity hashing requires a secure page or localhost.');
  }
  const buffer = await globalThis.crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(identity.key),
  );
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const hash = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  // Keep all 256 bits. This plain array also survives postMessage / JSON intact.
  const seedWords = Array.from({ length: 8 }, (_, index) => view.getUint32(index * 4, false));
  return { ...identity, hash, seedWords };
}

const MASK_64 = (1n << 64n) - 1n;
const TWO_POW_53 = 9007199254740992;
const rotl = (value, bits) => ((value << bits) | (value >> (64n - bits))) & MASK_64;

function splitMix64(value) {
  let result = (value + 0x9e3779b97f4a7c15n) & MASK_64;
  result = ((result ^ (result >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  result = ((result ^ (result >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return result ^ (result >> 31n);
}

/**
 * Repeatable [0, 1) graphics RNG with the complete 256-bit identity as state.
 * xoshiro256** by David Blackman and Sebastiano Vigna, dedicated to the public
 * domain: https://prng.di.unimi.it/xoshiro256starstar.c
 * Pass distinct small stream integers to isolate layout and runtime draws.
 * Streams are deterministically mixed; disjoint output sequences are not promised.
 */
export function identityRandom(seedWords, stream = 0) {
  if (!seedWords || seedWords.length !== 8 || Array.from(seedWords).some(
    value => !Number.isInteger(value) || value < 0 || value > 0xffffffff,
  )) {
    throw new Error('A graphics seed must contain all eight unsigned 32-bit identity words.');
  }
  if (!Number.isSafeInteger(stream) || stream < 0) {
    throw new Error('The graphics stream must be a nonnegative safe integer.');
  }
  const streamValue = BigInt(stream);
  const state = Array.from({ length: 4 }, (_, index) => {
    const word = (BigInt(seedWords[index * 2]) << 32n) | BigInt(seedWords[index * 2 + 1]);
    // XOR with a stream-dependent mask preserves all 256 input bits for any
    // fixed stream. SplitMix is not used to reduce the identity to a short seed.
    return word ^ splitMix64(streamValue + BigInt(index) * 0x9e3779b97f4a7c15n);
  });
  // xoshiro's only invalid state is all-zero. This practically unreachable
  // branch also makes an explicitly supplied pathological seed usable.
  if (state.every(value => value === 0n)) state[0] = 0x9e3779b97f4a7c15n;
  const next = () => {
    const result = (rotl((state[1] * 5n) & MASK_64, 7n) * 9n) & MASK_64;
    const shifted = (state[1] << 17n) & MASK_64;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= shifted;
    state[3] = rotl(state[3], 45n);
    return Number(result >> 11n) / TWO_POW_53;
  };
  // Diffuse every seed word through the state before the first visible draw.
  for (let index = 0; index < 16; index++) next();
  return next;
}
