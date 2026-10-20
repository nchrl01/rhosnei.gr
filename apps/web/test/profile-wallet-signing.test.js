import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {describe,expect,it,vi} from 'vitest';

const source=readFileSync(new URL('../legacy/wallet/connect.js',import.meta.url),'utf8');
const signer=source.slice(source.indexOf('export async function signProfileMessage')).replace('export ','');
const evm={namespace:'eip155',address:'0x1234',caipAddress:'eip155:1:0x1234',isConnected:true};
const sol={namespace:'solana',address:'SolanaAddress',caipAddress:'solana:mainnet:SolanaAddress',isConnected:true};
function fixture(account=evm){
 const provider={request:vi.fn(async()=>'0x'+'ab'.repeat(65)),signMessage:vi.fn(async()=>new Uint8Array(64).fill(9))};
 const modal={getAccount:vi.fn(()=>account),getProvider:vi.fn(()=>provider)};
 const context=vm.createContext({modal,TextEncoder,Uint8Array,ArrayBuffer,btoa});
 vm.runInContext(signer,context);
 return {sign:context.signProfileMessage,provider,modal};
}
describe('explicit profile wallet signatures',()=>{
 it('signs the exact UTF8 challenge through personal_sign, never a transaction method',async()=>{
  const f=fixture(),message='Sign in to $AV\nΔοκιμή';
  await f.sign(message,evm);
  expect(f.provider.request).toHaveBeenCalledWith({method:'personal_sign',params:['0x'+Buffer.from(message).toString('hex'),evm.address]});
  expect(f.provider.signMessage).not.toHaveBeenCalled();
 });
 it('encodes a 64-byte Solana signature as base64',async()=>{
  const f=fixture(sol),message='Sign in\nNonce: 123';
  const signature=await f.sign(message,sol);
  expect(signature).toBe(Buffer.alloc(64,9).toString('base64'));
  expect([...f.provider.signMessage.mock.calls[0][0]]).toEqual([...new TextEncoder().encode(message)]);
  expect(f.provider.request).not.toHaveBeenCalled();
 });
 it('accepts Solana providers that return the signature in an object',async()=>{
  const f=fixture(sol);f.provider.signMessage.mockResolvedValue({signature:new Uint8Array(64).fill(2)});
  expect(await f.sign('Sign in',sol)).toBe(Buffer.alloc(64,2).toString('base64'));
 });
 it('rejects account or namespace changes before asking for a signature',async()=>{
  const f=fixture(sol);await expect(f.sign('Sign in',evm)).rejects.toThrow('wallet changed');
  expect(f.provider.request).not.toHaveBeenCalled();expect(f.provider.signMessage).not.toHaveBeenCalled();
 });
 it('rejects an account change while the wallet prompt is open',async()=>{
  const f=fixture();f.provider.request.mockImplementation(async()=>{f.modal.getAccount.mockReturnValue({...evm,address:'0x9876'});return '0x'+'ab'.repeat(65);});
  await expect(f.sign('Sign in',evm)).rejects.toThrow('wallet changed');
 });
 it('accepts equivalent numeric and string chain IDs',async()=>{
  const f=fixture({...evm,caipAddress:undefined,chainId:'1'});
  await expect(f.sign('Sign in',{...evm,caipAddress:undefined,chainId:1})).resolves.toBe('0x'+'ab'.repeat(65));
 });
 it('rejects a network change before opening the signature prompt',async()=>{
  const f=fixture({...evm,caipAddress:'eip155:8453:0x1234'});
  await expect(f.sign('Sign in',{...evm,chainId:1})).rejects.toThrow('wallet network changed');
  expect(f.provider.request).not.toHaveBeenCalled();
 });
 it('rejects a network change during EVM signing even when the account is unchanged',async()=>{
  const f=fixture();f.provider.request.mockImplementation(async()=>{f.modal.getAccount.mockReturnValue({...evm,caipAddress:'eip155:8453:0x1234'});return '0x'+'ab'.repeat(65);});
  await expect(f.sign('Sign in',evm)).rejects.toThrow('wallet network changed');
 });
 it('rejects a Solana network change during signing',async()=>{
  const f=fixture(sol);f.provider.signMessage.mockImplementation(async()=>{f.modal.getAccount.mockReturnValue({...sol,caipAddress:'solana:devnet:SolanaAddress'});return new Uint8Array(64);});
  await expect(f.sign('Sign in',sol)).rejects.toThrow('wallet network changed');
 });
 it('rejects incomplete Solana signatures and unsupported wallet families',async()=>{
  const f=fixture(sol);f.provider.signMessage.mockResolvedValue(new Uint8Array(32));
  await expect(f.sign('Sign in',sol)).rejects.toThrow('invalid signature');
  await expect(f.sign('Sign in',{namespace:'bitcoin',address:'btc'})).rejects.toThrow('Ethereum or Solana');
 });
 it('does not request signatures for empty or oversized messages',async()=>{
  const f=fixture();await expect(f.sign('',evm)).rejects.toThrow('Invalid sign-in');
  await expect(f.sign('a'.repeat(8193),evm)).rejects.toThrow('Invalid sign-in');
  expect(f.provider.request).not.toHaveBeenCalled();
 });
});
