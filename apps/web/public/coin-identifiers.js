import {NATIVE_CONTRACT_REFERENCES} from './native-contracts.js?v=445';
// Named and typed identifiers are admitted only when explicitly verified.
const knownIdentifiers=new Set(Object.values(NATIVE_CONTRACT_REFERENCES).map(r=>r.address));
export const isTokenIdentifier=query=>typeof query==='string'&&(knownIdentifiers.has(query)||/^[EU]Q[A-Za-z0-9_-]{46}$/.test(query)||/^0x[0-9a-f]{40,64}$/i.test(query)||/^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(query)||/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(query));
