import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {afterEach,describe,expect,it,vi} from 'vitest';

const source=readFileSync(new URL('../legacy/wallet/connect.js',import.meta.url),'utf8');
const signingSource=source.slice(source.indexOf('async function requestMobileProfileSignature')).replace('export ','');
const closeSource=source.slice(source.indexOf('function dismissShell'),source.indexOf('// Prepare the dialog'));
const account={namespace:'eip155',address:'0x1234',caipAddress:'eip155:1:0x1234',isConnected:true};
const validSignature='0x'+'ab'.repeat(65);

class Element extends EventTarget{
 constructor(tag){super();this.tag=tag;this.children=[];this.attributes={};this.open=false;this.className='';this.classList={add:name=>{this.className+=' '+name;},remove:name=>{this.className=this.className.split(' ').filter(item=>item!==name).join(' ');}};}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 setAttribute(name,value){this.attributes[name]=value;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
 find(name){return this.children.find(child=>child.className.split(' ').includes(name))||this.children.map(child=>child.find(name)).find(Boolean);}
}
function fixture({connectorId='walletConnect',wallet='MetaMask',link={name:'MetaMask',href:'metamask://'},closing=null,reduced=true}={}){
 const body=new Element('body');
 const document={body,visibilityState:'visible',hasFocus:vi.fn(()=>true),createElement:tag=>new Element(tag)};
 const provider={request:vi.fn(async()=>validSignature),signMessage:vi.fn(async()=>new Uint8Array(64).fill(7))};
 const modal={getAccount:vi.fn(()=>account),getProvider:vi.fn(()=>provider)};
 const publishClose=vi.fn(),openHref=vi.fn();
 const context=vm.createContext({document,modal,closing,TextEncoder,Uint8Array,ArrayBuffer,btoa,setTimeout,matchMedia:()=>({matches:reduced}),publishClose,
  ConnectorController:{getConnectorId:()=>connectorId,getConnectorById:()=>({name:wallet})},
  StorageUtil:{getWalletConnectDeepLink:()=>link},CoreHelperUtil:{isMobile:()=>true,openHref},
 });
 vm.runInContext(signingSource,context);
 return {sign:context.signProfileMessage,document,body,provider,modal,publishClose,openHref,
  dialog:()=>body.find('upic-signature-dialog'),button:name=>body.find('upic-signature-'+name)};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
afterEach(()=>vi.useRealTimers());

describe('mobile profile signature handoff',()=>{
 it('prepares the challenge and waits for a fresh tap before calling the provider',async()=>{
  const f=fixture(),result=f.sign('Finish signing in',account);
  expect(f.dialog().open).toBe(true);expect(f.button('continue').textContent).toBe('Continue in MetaMask');
  expect(f.provider.request).not.toHaveBeenCalled();
  f.button('continue').click();
  expect(f.provider.request).toHaveBeenCalledOnce();
  expect(f.provider.request).toHaveBeenCalledWith({method:'personal_sign',params:['0x'+Buffer.from('Finish signing in').toString('hex'),account.address]});
  expect(f.button('status').textContent).toContain('Approve');
  await expect(result).resolves.toBe(validSignature);expect(f.dialog()).toBeUndefined();expect(f.publishClose).not.toHaveBeenCalled();
 });
 it('calls the provider inside the click dispatch, before any asynchronous hop',async()=>{
  const f=fixture();let insideClick=false;
  f.provider.request.mockImplementation(()=>{expect(insideClick).toBe(true);return Promise.resolve(validSignature);});
  const result=f.sign('Sign in',account);insideClick=true;f.button('continue').click();insideClick=false;
  await expect(result).resolves.toBe(validSignature);
 });
 it('does not request while hidden and never auto-requests on return',async()=>{
  const f=fixture(),result=f.sign('Sign in',account);f.document.visibilityState='hidden';
  f.button('continue').click();expect(f.provider.request).not.toHaveBeenCalled();
  f.document.visibilityState='visible';await Promise.resolve();expect(f.provider.request).not.toHaveBeenCalled();
  f.button('continue').click();await expect(result).resolves.toBe(validSignature);
 });
 it('requires focus as well as visibility before dispatching',async()=>{
  const f=fixture(),result=f.sign('Sign in',account);f.document.hasFocus.mockReturnValue(false);
  f.button('continue').click();expect(f.provider.request).not.toHaveBeenCalled();
  f.document.hasFocus.mockReturnValue(true);f.button('continue').click();await expect(result).resolves.toBe(validSignature);
 });
 it('keeps one request pending and reopens the selected wallet without another signature request',async()=>{
  const f=fixture(),request=deferred();f.provider.request.mockReturnValue(request.promise);
  const result=f.sign('Sign in',account);f.button('continue').click();
  f.button('continue').dispatchEvent(new Event('click'));
  expect(f.button('continue').disabled).toBe(true);expect(f.button('reopen').hidden).toBe(false);
  f.button('reopen').click();f.button('reopen').click();
  expect(f.openHref).toHaveBeenCalledWith('metamask://','_self');expect(f.openHref).toHaveBeenCalledTimes(2);
  expect(f.provider.request).toHaveBeenCalledOnce();request.resolve(validSignature);await result;
 });
 it('does not reuse another session’s saved deep link for an injected provider',async()=>{
  const f=fixture({connectorId:'injected',wallet:'Phantom'}),request=deferred();f.provider.request.mockReturnValue(request.promise);
  const result=f.sign('Sign in',account);expect(f.button('continue').textContent).toBe('Continue in Phantom');
  f.button('continue').click();expect(f.button('reopen').hidden).toBe(true);
  f.button('reopen').dispatchEvent(new Event('click'));expect(f.openHref).not.toHaveBeenCalled();
  request.resolve(validSignature);await result;
 });
 it('uses a generic button when the wallet name is unavailable',async()=>{
  const f=fixture({connectorId:'injected',wallet:'',link:null}),result=f.sign('Sign in',account);
  expect(f.button('continue').textContent).toBe('Sign in with wallet');f.button('continue').click();await result;
 });
 it('does not expose an executable stored URL as the reopen action',async()=>{
  const f=fixture({link:{name:'Wallet',href:'javascript://alert(1)'}}),request=deferred();f.provider.request.mockReturnValue(request.promise);
  const result=f.sign('Sign in',account);f.button('continue').click();expect(f.button('reopen').hidden).toBe(true);
  request.resolve(validSignature);await result;
 });
 it('rechecks account and network when the prepared dialog is tapped',async()=>{
  const f=fixture(),result=f.sign('Sign in',account);f.modal.getAccount.mockReturnValue({...account,caipAddress:'eip155:8453:0x1234'});
  f.button('continue').click();await expect(result).rejects.toThrow('network changed');expect(f.provider.request).not.toHaveBeenCalled();
 });
 it('rechecks account before reopening a pending request',async()=>{
  const f=fixture(),request=deferred();f.provider.request.mockReturnValue(request.promise);
  const result=f.sign('Sign in',account);f.button('continue').click();f.modal.getAccount.mockReturnValue({...account,address:'0x5678'});
  f.button('reopen').click();await expect(result).rejects.toThrow('wallet changed');expect(f.openHref).not.toHaveBeenCalled();
  request.resolve(validSignature);await Promise.resolve();
 });
 it('supports a Solana provider from the same fresh-tap flow',async()=>{
  const f=fixture({connectorId:'phantom',wallet:'Phantom'}),sol={...account,namespace:'solana',address:'SolanaAddress',caipAddress:'solana:mainnet:SolanaAddress'};
  f.modal.getAccount.mockReturnValue(sol);const result=f.sign('Sign in',sol);
  expect(f.provider.signMessage).not.toHaveBeenCalled();f.button('continue').click();
  expect(f.provider.signMessage).toHaveBeenCalledOnce();await expect(result).resolves.toBe(Buffer.alloc(64,7).toString('base64'));
 });
 it('cancels without requesting a signature and notifies only once after dismissal',async()=>{
  const f=fixture(),result=f.sign('Sign in',account),close=f.button('close');
  close.click();close.dispatchEvent(new Event('click'));await expect(result).rejects.toThrow('Sign-in cancelled.');
  expect(f.publishClose).toHaveBeenCalledOnce();expect(f.provider.request).not.toHaveBeenCalled();expect(f.dialog()).toBeUndefined();
 });
 it('ignores a late signature after the user cancels the pending request',async()=>{
  const f=fixture(),request=deferred();f.provider.request.mockReturnValue(request.promise);
  const result=f.sign('Sign in',account),resolved=vi.fn(),failed=vi.fn();result.then(resolved,failed);
  f.button('continue').click();f.button('close').click();await expect(result).rejects.toThrow('cancelled');
  request.resolve(validSignature);await Promise.resolve();await Promise.resolve();
  expect(resolved).not.toHaveBeenCalled();expect(failed).toHaveBeenCalledOnce();expect(f.publishClose).toHaveBeenCalledOnce();
 });
 it('cleans up a rejected wallet request without reporting a user dismissal',async()=>{
  const f=fixture();f.provider.request.mockRejectedValue(Error('User rejected the request'));
  const result=f.sign('Sign in',account);f.button('continue').click();await expect(result).rejects.toThrow('rejected');
  expect(f.dialog()).toBeUndefined();expect(f.publishClose).not.toHaveBeenCalled();
 });
 it('waits for the existing picker’s completed fade before showing the confirmation',async()=>{
  const closing=deferred(),f=fixture({closing:closing.promise}),result=f.sign('Sign in',account);
  expect(f.dialog()).toBeUndefined();closing.resolve();for(let turn=0;turn<10&&!f.dialog();turn++)await Promise.resolve();
  expect(f.dialog().open).toBe(true);f.button('continue').click();await result;
 });
 it('keeps close notification behind the completed fade',async()=>{
  vi.useFakeTimers();const f=fixture({reduced:false}),result=f.sign('Sign in',account);result.catch(()=>{});
  f.button('close').click();expect(f.publishClose).not.toHaveBeenCalled();expect(f.dialog().open).toBe(true);
  await vi.advanceTimersByTimeAsync(180);await expect(result).rejects.toThrow('cancelled');expect(f.publishClose).toHaveBeenCalledOnce();expect(f.dialog()).toBeUndefined();
 });
});

function closeFixture({safeAllowed=true,reduced=true}={}){
 const shell=new Element('dialog');shell.open=true;
 const ModalController={state:{open:true}},publishClose=vi.fn(),PublicStateController={set:vi.fn()};
 const modal={close:vi.fn(async()=>{ModalController.state.open=false;})};
 const ModalUtil={safeClose:vi.fn(async()=>{if(safeAllowed)ModalController.state.open=false;})};
 const context=vm.createContext({shell,closing:null,ModalController,PublicStateController,ModalUtil,modal,publishClose,setTimeout,matchMedia:()=>({matches:reduced})});
 vm.runInContext(closeSource,context);return {shell,publishClose,modal,ModalUtil,close:context.closePicker,dismiss:context.dismissShell};
}
describe('explicit wallet picker dismissal',()=>{
 it('notifies when an explicit close has actually completed',async()=>{const f=closeFixture();await f.close({user:true});expect(f.shell.open).toBe(false);expect(f.publishClose).toHaveBeenCalledOnce();});
 it('does not notify on a programmatic close or SDK auto-close',async()=>{const f=closeFixture();f.dismiss();await f.close();expect(f.publishClose).not.toHaveBeenCalled();});
 it('does not notify when safe close keeps the SDK open',async()=>{const f=closeFixture({safeAllowed:false});await f.close({safe:true,user:true});expect(f.shell.open).toBe(true);expect(f.publishClose).not.toHaveBeenCalled();});
 it('does not notify twice for repeated close events',async()=>{const f=closeFixture();await Promise.all([f.close({user:true}),f.close({user:true})]);expect(f.publishClose).toHaveBeenCalledOnce();await f.close({user:true});expect(f.publishClose).toHaveBeenCalledOnce();});
 it('waits for the fade before notifying',async()=>{vi.useFakeTimers();const f=closeFixture({reduced:false}),closed=f.close({user:true});expect(f.publishClose).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(180);await closed;expect(f.publishClose).toHaveBeenCalledOnce();});
});
