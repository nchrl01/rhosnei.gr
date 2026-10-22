import {PublicStateController,ChainController,ConnectorController,ModalController,RouterController} from '@reown/appkit-controllers';
import {createAppKit} from '@reown/appkit';
import {EthersAdapter} from '@reown/appkit-adapter-ethers';
import {SolanaAdapter} from '@reown/appkit-adapter-solana';
import {mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana} from '@reown/appkit/networks';
let modal,opening,shell,closing,picker;
const accountListeners=new Set();
function publishAccount(account){for(const listener of accountListeners)listener(account);}
export async function connect(projectId,onAccount,options={}){
 if(!projectId)throw Error('Wallet connections are being configured.');
 if(onAccount)accountListeners.add(onAccount);
 if(!modal){
  modal=createAppKit({adapters:[new EthersAdapter(),new SolanaAdapter()],networks:[mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana],projectId,enableEmbedded:true,featuredWalletIds:['a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393','c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'],metadata:{name:'UPIC',description:'Audiovisual instrument and NFT marketplace',url:location.origin,icons:[new URL('upic-logo-transparent.svg',document.baseURI).href]},themeMode:'dark',themeVariables:{'--w3m-accent':'#ffffff','--w3m-font-family':'Unifont, "Noto Sans", sans-serif','--w3m-font-size-master':'10px','--w3m-border-radius-master':'0px','--w3m-qr-color':'#ffffff'},features:{connectorTypeOrder:['featured','injected','walletConnect','recent','external','recommended'],analytics:false,email:false,socials:false,swaps:false,onramp:false}});
  modal.subscribeAccount(publishAccount);
  shell=document.createElement('dialog');shell.className='upic-wallet-dialog';shell.setAttribute('aria-label','Sign in');
  const heading=document.createElement('header'),close=document.createElement('button'),logo=document.createElement('img');
  close.type='button';close.textContent='×';close.setAttribute('aria-label','Close sign in');heading.append(close);
  logo.src=new URL('upic-logo-transparent.svg',document.baseURI).href;logo.alt='UPIC';logo.className='upic-wallet-logo';
  shell.append(heading,logo);document.body.append(shell);
  close.addEventListener('click',()=>void closePicker());
  let backdropPress=false;
  const outside=event=>{const rect=shell.getBoundingClientRect();return event.target===shell&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
  shell.addEventListener('pointerdown',event=>{backdropPress=matchMedia('(min-width:761px)').matches&&outside(event);});
  shell.addEventListener('click',event=>{if(backdropPress&&outside(event))void closePicker();backdropPress=false;});
  shell.addEventListener('cancel',event=>{event.preventDefault();void closePicker();});
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
  }
  await modal.open({view:view||'Connect'});
  if(!ModalController.state.open||RouterController.state.view==='Account'){ModalController.close();dismissShell();return;}
  const signingIn=!view||view==='Connect';
  shell.classList.toggle('is-wallet-action',!signingIn);
  shell.setAttribute('aria-label',signingIn?'Sign in':'Wallet action');
  shell.querySelector('header button').setAttribute('aria-label',signingIn?'Close sign in':'Close wallet action');
  if(!shell.open){shell.classList.remove('is-closing');shell.showModal();}
 })();
 try{await opening;}finally{opening=null;}
}

function dismissShell(){
 if(shell?.open)shell.close();
 shell?.classList.remove('is-closing');
 PublicStateController.set({open:false});
}

async function closePicker(){
 if(closing)return closing;
 closing=(async()=>{
  if(shell?.open&&!matchMedia('(prefers-reduced-motion: reduce)').matches){shell.classList.add('is-closing');await new Promise(resolve=>setTimeout(resolve,180));}
  await modal.close();dismissShell();
 })();
 try{await closing;}finally{closing=null;}
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
 let signature;
 if(namespace==='eip155'){
  if(typeof provider?.request!=='function')throw Error('This wallet cannot sign in. Try another wallet.');
  const hex='0x'+Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  signature=await provider.request({method:'personal_sign',params:[hex,expected.address]});
  if(typeof signature!=='string'||!/^0x[0-9a-f]+$/i.test(signature))throw Error('The wallet returned an invalid signature.');
 }else{
  if(typeof provider?.signMessage!=='function')throw Error('This wallet cannot sign in. Try another wallet.');
  const result=await provider.signMessage(bytes);
  const raw=result?.signature??result;
  const signed=ArrayBuffer.isView(raw)?new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength):raw instanceof ArrayBuffer?new Uint8Array(raw):null;
  if(signed?.length!==64)throw Error('The wallet returned an invalid signature.');
  signature=btoa(String.fromCharCode(...signed));
 }
 sameAccount();
 return signature;
}
