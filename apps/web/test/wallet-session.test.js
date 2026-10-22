import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

// Exercise the shipped state machine with a fake connector, without loading a wallet SDK.
const source=readFileSync(new URL('../public/wallet-session.js',import.meta.url),'utf8')
 .replace(/export /g,'')
 .replace(/import\('\.\/vendor\/wallet\/connect\.js\?v=[^']+'\)/g,'walletModule()');
const connected={isConnected:true,address:'0x1234567890123456789012345678901234567890',caipAddress:'eip155:1:0x1234567890123456789012345678901234567890'};

function fixture({open=true,immediateAccount=false}={}){
 let current=null,state={open},onAccount;
 const accounts=new Set(),states=new Set(),closes=new Set();
 const page=new EventTarget();page.hidden=false;
 const add=vi.spyOn(page,'addEventListener'),remove=vi.spyOn(page,'removeEventListener');
 const subscribe=(listeners,listener)=>{listeners.add(listener);return vi.fn(()=>listeners.delete(listener));};
 const modal={
  getAccount:()=>current,getState:()=>state,
  close:vi.fn(async()=>{state={open:false};for(const listener of [...states])listener(state);}),
  subscribeAccount:vi.fn(listener=>{
   const off=subscribe(accounts,listener);
   if(immediateAccount){current=connected;listener(current);}
   return off;
  }),
  subscribeState:vi.fn(listener=>{const off=subscribe(states,listener);listener(state);return off;}),
  subscribeClose:vi.fn(listener=>subscribe(closes,listener)),
 };
 const connect=vi.fn(async(projectId,listener)=>{onAccount=listener;listener(current);return modal;});
 const context=vm.createContext({
  document:page,fetch:vi.fn(async()=>({ok:true,json:async()=>({projectId:'fixture'})})),
  AbortSignal:{timeout:()=>({})},setTimeout,clearTimeout,
  walletModule:async()=>({connect}),
 });
 vm.runInContext(source+'\nglobalThis.api={ensureWalletAccount,getWalletAccount};',context);
 const stateChange=value=>{state={open:value};for(const listener of [...states])listener(state);};
 return {
  api:context.api,modal,page,accounts,states,closes,add,remove,
  state:stateChange,
  account(value=connected){current=value;onAccount?.(value);for(const listener of [...accounts])listener(value);},
  explicitClose(){stateChange(false);for(const listener of [...closes])listener();},
  visibility(hidden){page.hidden=hidden;page.dispatchEvent(new Event('visibilitychange'));},
 };
}
async function start(f){
 const done=vi.fn(),failed=vi.fn(),promise=f.api.ensureWalletAccount();
 promise.then(done,failed);
 for(let i=0;i<100&&!f.closes.size&&!done.mock.calls.length&&!failed.mock.calls.length;i++)await Promise.resolve();
 expect(f.closes.size+done.mock.calls.length+failed.mock.calls.length).toBeGreaterThan(0);
 return {promise,done,failed};
}
function expectClean(f){
 expect(f.accounts.size+f.states.size+f.closes.size).toBe(0);
 expect(f.remove).toHaveBeenCalledWith('visibilitychange',f.add.mock.calls[0][1]);
 expect(vi.getTimerCount()).toBe(0);
}

beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});

describe('wallet connection handoff',()=>{
 it('waits for a delayed account when SDK state is already closed',async()=>{
  const f=fixture({open:false}),result=await start(f);
  await vi.advanceTimersByTimeAsync(1500);
  expect(result.failed).not.toHaveBeenCalled();expect(result.done).not.toHaveBeenCalled();
  f.account();await expect(result.promise).resolves.toMatchObject({address:connected.address,namespace:'eip155',chainId:'1'});
  expectClean(f);
 });
 it('does not interpret SDK auto-close as user cancellation',async()=>{
  const f=fixture(),result=await start(f);
  f.state(false);await vi.advanceTimersByTimeAsync(2000);
  expect(result.failed).not.toHaveBeenCalled();
  f.account();await expect(result.promise).resolves.toMatchObject({address:connected.address});
  expectClean(f);
 });
 it('cancels an explicit dismissal only after its account delivery grace period',async()=>{
  const f=fixture(),result=await start(f);
  f.explicitClose();await vi.advanceTimersByTimeAsync(499);
  expect(result.failed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  await expect(result.promise).rejects.toThrow('Sign-in cancelled.');expectClean(f);
 });
 it('accepts an account delivered just after an explicit close',async()=>{
  const f=fixture(),result=await start(f);
  f.explicitClose();await vi.advanceTimersByTimeAsync(300);f.account();
  await expect(result.promise).resolves.toMatchObject({address:connected.address});
  expectClean(f);
 });
 it('clears old dismissal timers when the picker reopens',async()=>{
  const f=fixture(),result=await start(f);
  f.explicitClose();await vi.advanceTimersByTimeAsync(100);f.explicitClose();
  await vi.advanceTimersByTimeAsync(100);f.state(true);await vi.advanceTimersByTimeAsync(1200);
  expect(result.failed).not.toHaveBeenCalled();
  f.account();await expect(result.promise).resolves.toMatchObject({address:connected.address});expectClean(f);
 });
 it('disposes subscriptions even when subscribeAccount delivers synchronously',async()=>{
  const f=fixture({immediateAccount:true}),result=await start(f);
  await expect(result.promise).resolves.toMatchObject({address:connected.address});
  expect(f.modal.subscribeAccount.mock.results[0].value).toHaveBeenCalledOnce();
  expect(f.modal.subscribeState).not.toHaveBeenCalled();expect(f.modal.subscribeClose).not.toHaveBeenCalled();
  expectClean(f);
 });
 it('does not cancel a hidden tab and rechecks the account after returning',async()=>{
  const f=fixture(),result=await start(f);
  f.visibility(true);f.explicitClose();await vi.advanceTimersByTimeAsync(5000);
  expect(result.failed).not.toHaveBeenCalled();
  f.visibility(false);await vi.advanceTimersByTimeAsync(750);f.account();
  await expect(result.promise).resolves.toMatchObject({address:connected.address});expectClean(f);
 });
 it('does not cancel if the tab becomes hidden during the dismissal grace period',async()=>{
  const f=fixture(),result=await start(f);
  f.explicitClose();await vi.advanceTimersByTimeAsync(100);f.visibility(true);
  await vi.advanceTimersByTimeAsync(1000);expect(result.failed).not.toHaveBeenCalled();
  f.visibility(false);await vi.advanceTimersByTimeAsync(1000);
  await expect(result.promise).rejects.toThrow('Sign-in cancelled.');expectClean(f);
 });
 it('times out a visible connection after 180 seconds',async()=>{
  const f=fixture(),result=await start(f);
  await vi.advanceTimersByTimeAsync(180001);
  await expect(result.promise).rejects.toThrow('Sign-in timed out.');expectClean(f);
 });
 it('defers a hidden timeout until return, without polling timers or extending its deadline',async()=>{
  const f=fixture(),result=await start(f);f.visibility(true);
  await vi.advanceTimersByTimeAsync(240000);
  expect(result.failed).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  f.visibility(false);await vi.advanceTimersByTimeAsync(1000);
  await expect(result.promise).rejects.toThrow('Sign-in timed out.');expectClean(f);
 });
 it('accepts restored account delivery after returning from a timed-out hidden handoff',async()=>{
  const f=fixture(),result=await start(f);f.visibility(true);
  await vi.advanceTimersByTimeAsync(240000);f.visibility(false);
  await vi.advanceTimersByTimeAsync(500);f.account();
  await expect(result.promise).resolves.toMatchObject({address:connected.address});expectClean(f);
 });
});
