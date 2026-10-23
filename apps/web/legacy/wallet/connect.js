import {PublicStateController,ChainController,ConnectorController,ModalController,RouterController,ModalUtil,CoreHelperUtil,StorageUtil} from '@reown/appkit-controllers';
import {createAppKit} from '@reown/appkit';
import {EthersAdapter} from '@reown/appkit-adapter-ethers';
import {SolanaAdapter} from '@reown/appkit-adapter-solana';
import {mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana} from '@reown/appkit/networks';
let modal,opening,shell,closing,picker;
const accountListeners=new Set();
const closeListeners=new Set();
function publishAccount(account){for(const listener of accountListeners)listener(account);}
function publishClose(){for(const listener of closeListeners)listener();}
export async function connect(projectId,onAccount,options={}){
 if(!projectId)throw Error('Wallet connections are being configured.');
 if(onAccount)accountListeners.add(onAccount);
 if(!modal){
  modal=createAppKit({adapters:[new EthersAdapter(),new SolanaAdapter()],networks:[mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana],projectId,enableEmbedded:true,featuredWalletIds:['a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393','c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'],metadata:{name:'UPIC',description:'Audiovisual instrument and NFT marketplace',url:location.origin,icons:[new URL('upic-logo-transparent.svg',document.baseURI).href]},themeMode:'dark',themeVariables:{'--w3m-accent':'#ffffff','--w3m-font-family':'Unifont, "Noto Sans", sans-serif','--w3m-font-size-master':'10px','--w3m-border-radius-master':'0px','--w3m-qr-color':'#ffffff'},features:{connectorTypeOrder:['featured','injected','walletConnect','recent','external','recommended'],analytics:false,email:false,socials:false,swaps:false,onramp:false}});
  modal.subscribeAccount(publishAccount);
  shell=document.createElement('dialog');shell.className='upic-wallet-dialog';shell.setAttribute('aria-label','Sign in');
  const logo=document.createElement('img');
  logo.src=new URL('upic-logo-transparent.svg',document.baseURI).href;logo.alt='UPIC';logo.className='upic-wallet-logo';
  shell.append(logo);document.body.append(shell);
  let backdropPress=false;
  const outside=event=>{const rect=shell.getBoundingClientRect();return event.target===shell&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
  shell.addEventListener('pointerdown',event=>{backdropPress=matchMedia('(min-width:761px)').matches&&outside(event);});
  shell.addEventListener('click',event=>{if(backdropPress&&outside(event))void closePicker({user:true});backdropPress=false;});
  shell.addEventListener('cancel',event=>{event.preventDefault();void closePicker({user:true});});
  shell.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void closePicker({user:true,safe:true});}},{capture:true});
  // Embedded AppKit deliberately leaves PublicState.open unchanged on close.
  // Follow the actual modal state so back/network changes also dismiss our shell.
  ModalController.subscribeKey('open',open=>{if(!open)dismissShell();});
  // Account details already live on the profile page. SDK action completion
  // can return here internally; it must not display a second account panel.
  RouterController.subscribeKey('view',view=>{if(view==='Account'&&shell.open){dismissShell();ModalController.close();}});
 }
 onAccount?.(modal.getAccount());
 if(!options?.silent)await openPicker(options?.view);
 return {
  close:closePicker,getAccount:()=>modal.getAccount(),getState:()=>modal.getState(),
  subscribeAccount:listener=>modal.subscribeAccount(listener),subscribeState:listener=>modal.subscribeState(listener),
  subscribeClose(listener){closeListeners.add(listener);return()=>closeListeners.delete(listener);},
  getDetails:walletDetails,
  subscribeDetails(listener){
   const update=()=>listener(walletDetails());
   const offs=[ChainController.subscribeChainProp('accountState',update),ChainController.subscribeKey('activeChain',update),ChainController.subscribeKey('activeCaipNetwork',update),ConnectorController.subscribeKey('activeConnectorIds',update)];
   update();return()=>offs.forEach(off=>off());
  },
  openAction:openPicker,disconnect:()=>modal.disconnect()
 };
}
function walletDetails(){
 const namespace=ChainController.state.activeChain,account=ChainController.getAccountData(namespace),network=ChainController.state.activeCaipNetwork;
 const id=namespace&&ConnectorController.getConnectorId(namespace),connector=id&&ConnectorController.getConnectorById(id);
 return {connected:Boolean(account?.caipAddress),address:account?.caipAddress?.split(':').slice(2).join(':'),namespace,balance:account?.balance??null,symbol:account?.balanceSymbol||network?.nativeCurrency?.symbol||'',network:network?.name||'',wallet:connector?.name||'',walletIcon:connector?modal.getConnectorImage(connector)||null:null};
}
async function openPicker(view){
 if(closing)await closing;
 if(opening)return opening;
 opening=(async()=>{
  if(!picker){
   // close() loads the SDK UI without opening it. Its first render resets a
   // restored account, so finish that render before choosing the action route.
   await modal.close();
   picker=document.createElement('w3m-modal');picker.className='appkit-modal';shell.append(picker);
   await picker.updateComplete;
   // Use the SDK's single title/back/close row, keeping our fade on dismissal.
   picker.addEventListener('click',event=>{
    if(event.composedPath().some(node=>node?.dataset?.testid==='w3m-header-close')){
     event.stopPropagation();void closePicker({safe:true,user:true});
    }
   },{capture:true});
  }
  await modal.open({view:view||'Connect'});
  if(!ModalController.state.open||RouterController.state.view==='Account'){ModalController.close();dismissShell();return;}
  const signingIn=!view||view==='Connect';
  shell.classList.toggle('is-wallet-action',!signingIn);
  shell.setAttribute('aria-label',signingIn?'Sign in':'Wallet action');
  const header=picker.shadowRoot?.querySelector('w3m-header');await header?.updateComplete;
  const close=header?.shadowRoot?.querySelector('[data-testid="w3m-header-close"]');await close?.updateComplete;
  close?.shadowRoot?.querySelector('button')?.setAttribute('aria-label',signingIn?'Close sign in':'Close wallet action');
  if(!shell.open){shell.classList.remove('is-closing');shell.showModal();}
 })();
 try{await opening;}finally{opening=null;}
}

function dismissShell(){
 if(shell?.open)shell.close();
 shell?.classList.remove('is-closing');
 PublicStateController.set({open:false});
}

async function closePicker({safe=false,user=false}={}){
 if(closing)return closing;
 const wasOpen=Boolean(shell?.open);
 closing=(async()=>{
  if(shell?.open&&!matchMedia('(prefers-reduced-motion: reduce)').matches){shell.classList.add('is-closing');await new Promise(resolve=>setTimeout(resolve,180));}
  if(safe)await ModalUtil.safeClose();else await modal.close();
  if(!ModalController.state.open){dismissShell();if(user&&wasOpen)publishClose();}else shell?.classList.remove('is-closing');
 })();
 try{await closing;}finally{closing=null;}
}

// Prepare the dialog before the tap: a request dispatched after a network
// fetch or while the wallet app is foregrounded may lose its mobile handoff.
async function requestMobileProfileSignature(requestSignature,sameAccount,namespace){
 if(closing)await closing;
 const connectorId=ConnectorController.getConnectorId(namespace);
 const connector=connectorId&&ConnectorController.getConnectorById(connectorId);
 // A link left by a previous WalletConnect session must not open a different
 // wallet when the current provider is injected in a wallet's own browser.
 const link=String(connectorId||'').toLowerCase()==='walletconnect'?StorageUtil.getWalletConnectDeepLink():null;
 const walletName=(link?.name||connector?.name||'').trim();
 const href=typeof link?.href==='string'&&/^(https:\/\/|[a-z][a-z\d+.-]*:\/\/)/i.test(link.href)&&!/^(javascript|data|file|blob|vbscript):/i.test(link.href)?link.href:null;
 const dialog=document.createElement('dialog');dialog.className='upic-wallet-dialog upic-signature-dialog';dialog.setAttribute('aria-label','Finish signing in');
 const header=document.createElement('div');header.className='upic-signature-header';
 const title=document.createElement('h2');title.textContent='Finish signing in';
 const close=document.createElement('button');close.type='button';close.className='upic-signature-close';close.setAttribute('aria-label','Cancel sign in');close.textContent='×';
 const explanation=document.createElement('p');explanation.className='upic-signature-explanation';explanation.textContent='Confirm the sign-in message in your wallet to open your profile.';
 const status=document.createElement('p');status.className='upic-signature-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;
 const proceed=document.createElement('button');proceed.type='button';proceed.className='upic-signature-continue';proceed.textContent=walletName?'Continue in '+walletName:'Sign in with wallet';
 const reopen=document.createElement('button');reopen.type='button';reopen.className='upic-signature-reopen';reopen.textContent='Open wallet';reopen.hidden=true;
 header.append(title,close);dialog.append(header,explanation,status,proceed,reopen);document.body.append(dialog);
 return new Promise((resolve,reject)=>{
  let pending=false,finished=false;
  const finish=async(error,value,user=false)=>{
   if(finished)return;finished=true;
   proceed.disabled=true;reopen.disabled=true;close.disabled=true;
   if(dialog.open&&!matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.classList.add('is-closing');await new Promise(done=>setTimeout(done,180));}
   dialog.close();dialog.remove();
   if(user)publishClose();
   if(error)reject(error);else resolve(value);
  };
  const cancel=()=>void finish(Error('Sign-in cancelled.'),undefined,true);
  close.addEventListener('click',cancel);
  dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}},{capture:true});
  proceed.addEventListener('click',()=>{
   if(pending||finished)return;
   // Never send a background iOS request and hope the wallet opens later.
   // A new visible tap is required; visibility changes do not send requests.
   if(document.visibilityState==='hidden'||!document.hasFocus()){
    status.hidden=false;status.textContent='Return here and tap Continue to finish signing in.';return;
   }
   try{
    sameAccount();pending=true;proceed.disabled=true;proceed.textContent='Waiting for approval';
    status.hidden=false;status.textContent='Approve the message in your wallet, then return here.';reopen.hidden=!href;
    // No await before this call: the provider sees the original user tap.
    const request=requestSignature();
    Promise.resolve(request).then(value=>finish(null,value),error=>finish(error));
   }catch(error){void finish(error);}
  });
  reopen.addEventListener('click',()=>{
   if(!pending||finished||!href||document.visibilityState==='hidden')return;
   try{sameAccount();CoreHelperUtil.openHref(href,'_self');}catch(error){void finish(error);}
  });
  dialog.showModal();
 });
}

// This is called only after the user explicitly chooses to sign in.
export async function signProfileMessage(message,expected){
 if(typeof message!=='string'||!message.trim()||message.length>8192)throw Error('Invalid sign-in message.');
 const namespace=expected?.namespace;
 if(namespace!=='eip155'&&namespace!=='solana')throw Error('Choose an Ethereum or Solana wallet to sign in.');
 const chainOf=value=>String(String(value?.caipAddress||'').split(':')[1]||value?.chainId||'');
 const expectedChain=chainOf(expected);
 const sameAccount=()=>{
  const current=modal?.getAccount();
  const currentNamespace=current?.namespace||String(current?.caipAddress||'').split(':')[0];
  const address=current?.address;
  const matches=namespace==='eip155'?address?.toLowerCase()===expected.address?.toLowerCase():address===expected.address;
  if(!current?.isConnected||currentNamespace!==namespace||!address||!matches)throw Error('Your wallet changed. Please sign in again.');
  if(!expectedChain||chainOf(current)!==expectedChain)throw Error('Your wallet network changed. Please sign in again.');
  return current;
 };
 sameAccount();
 const provider=modal.getProvider(namespace);
 const bytes=new TextEncoder().encode(message);
 if(namespace==='eip155'?typeof provider?.request!=='function':typeof provider?.signMessage!=='function')throw Error('This wallet cannot sign in. Try another wallet.');
 const hex=namespace==='eip155'?'0x'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join(''):null;
 const requestSignature=async()=>{
  sameAccount();let signature;
  if(namespace==='eip155'){
   signature=await provider.request({method:'personal_sign',params:[hex,expected.address]});
   if(typeof signature!=='string'||!/^0x[0-9a-f]+$/i.test(signature))throw Error('The wallet returned an invalid signature.');
  }else{
   const result=await provider.signMessage(bytes);
   const raw=result?.signature??result;
   const signed=ArrayBuffer.isView(raw)?new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength):raw instanceof ArrayBuffer?new Uint8Array(raw):null;
   if(signed?.length!==64)throw Error('The wallet returned an invalid signature.');
   signature=btoa(String.fromCharCode(...signed));
  }
  sameAccount();return signature;
 };
 return CoreHelperUtil.isMobile()?requestMobileProfileSignature(requestSignature,sameAccount,namespace):requestSignature();
}
