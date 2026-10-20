import {createAppKit} from '@reown/appkit';
import {EthersAdapter} from '@reown/appkit-adapter-ethers';
import {SolanaAdapter} from '@reown/appkit-adapter-solana';
import {mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana} from '@reown/appkit/networks';
let modal,opening;
const accountListeners=new Set();
function publishAccount(account){for(const listener of accountListeners)listener(account);}
export async function connect(projectId,onAccount){
 if(!projectId)throw Error('Wallet connections are being configured.');
 if(onAccount)accountListeners.add(onAccount);
 if(!modal){
  modal=createAppKit({adapters:[new EthersAdapter(),new SolanaAdapter()],networks:[mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana],projectId,metadata:{name:'AV',description:'Audiovisual instrument and NFT marketplace',url:location.origin,icons:[new URL('upic-logo-transparent.svg',document.baseURI).href]},themeMode:'dark',themeVariables:{'--w3m-accent':'#ffffff','--w3m-font-family':'NDS12, Unifont, "Noto Sans", sans-serif','--w3m-font-size-master':'10px','--w3m-border-radius-master':'0px','--w3m-qr-color':'#ffffff'},features:{analytics:false,email:false,socials:false,swaps:false,onramp:false}});
  modal.subscribeAccount(publishAccount);
 }
 onAccount?.(modal.getAccount());
 if(!opening)opening=modal.open().finally(()=>{opening=null;});
 await opening;return modal;
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
