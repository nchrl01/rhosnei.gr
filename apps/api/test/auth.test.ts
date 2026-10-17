import {describe,it,expect} from 'vitest';
import {authorized,walletFor} from '../src/auth';
import type {Env} from '../src/env';
const env={SESSION_SECRET:'test-session-secret-with-more-than-32-characters'} as Env;
const wallet='0x'+'11'.repeat(20);
async function cookie(exp:number){
 const payload=Buffer.from(JSON.stringify({wallet,exp})).toString('base64url');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))).toString('base64url');
 return 'upic_session='+payload+'.'+signature;
}
describe('wallet sessions',()=>{
 it('requires the signed session, not a claimed wallet address',async()=>{
  await expect(walletFor(env,'wallet='+wallet)).rejects.toThrow('authentication');
  expect(await walletFor(env,await cookie(Date.now()+10000))).toBe(wallet);
 });
 it('rejects an expired session and tampering',async()=>{
  await expect(walletFor(env,await cookie(Date.now()-1))).rejects.toThrow('expired');
  const valid=await cookie(Date.now()+10000);
  await expect(walletFor(env,valid.slice(0,-8)+'AAAAAAAA')).rejects.toThrow('invalid-session');
 });
 it('fails closed for a missing admin secret',async()=>{
  expect(await authorized('Bearer anything','')).toBe(false);
  const secret='admin-test-token-with-at-least-32-characters';
  expect(await authorized('Bearer '+secret,secret)).toBe(true);
  expect(await authorized('Bearer '+secret+'x',secret)).toBe(false);
 });
});
