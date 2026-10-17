export const CHAINS = [
  { id: 'ethereum', name: 'Ethereum', network: 'eth', kind: 'evm', chainId: 1 },
  { id: 'bsc', name: 'BNB Chain', network: 'bsc', kind: 'evm', chainId: 56 },
  { id: 'base', name: 'Base', network: 'base', kind: 'evm', chainId: 8453 },
  { id: 'solana', name: 'Solana', network: 'solana', kind: 'solana', chainId: null },
  { id: 'tron', name: 'Tron', network: 'tron', kind: 'tron', chainId: null },
  { id: 'monad', name: 'Monad', network: 'monad', kind: 'evm', chainId: 143 },
  { id: 'hyperevm', name: 'HyperEVM', network: 'hyperevm', kind: 'evm', chainId: 999 },
  { id: 'arbitrum', name: 'Arbitrum', network: 'arbitrum', kind: 'evm', chainId: 42161 },
  { id: 'xlayer', name: 'X Layer', network: 'x-layer', kind: 'evm', chainId: 196 },
  { id: 'robinhood', name: 'Robinhood', network: 'robinhood', kind: 'evm', chainId: 4663 }
] as const;
export type Chain = typeof CHAINS[number];

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function chainFor(id: unknown): Chain {
  const chain = CHAINS.find(item => item.id === id);
  if (!chain) throw new ApiError(422, 'unsupported-chain');
  return chain;
}
export function addressFor(chain: Chain, input: unknown, pool = false): string {
  if (typeof input !== 'string') throw new ApiError(400, 'invalid-address');
  // Uniswap v4 identifies a pool by a 32-byte ID rather than a contract address.
  const valid = chain.kind === 'evm'
    ? (pool ? /^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/ : /^0x[a-fA-F0-9]{40}$/).test(input)
    : chain.kind === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)
    : /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input);
  if (!valid) throw new ApiError(400, 'invalid-address');
  return chain.kind === 'evm' ? input.toLowerCase() : input;
}
