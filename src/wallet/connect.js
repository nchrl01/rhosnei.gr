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
  modal=createAppKit({adapters:[new EthersAdapter(),new SolanaAdapter()],networks:[mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana],projectId,metadata:{name:'AV',description:'Audiovisual instrument and NFT marketplace',url:location.origin,icons:[new URL('upic-logo-transparent.svg',document.baseURI).href]},themeMode:'dark',themeVariables:{'--w3m-accent':'#ffffff','--w3m-font-family':'Unifont, "Noto Sans", sans-serif','--w3m-font-size-master':'10px','--w3m-border-radius-master':'0px','--w3m-qr-color':'#ffffff'},features:{analytics:false,email:false,socials:false,swaps:false,onramp:false}});
  modal.subscribeAccount(publishAccount);
 }
 onAccount?.(modal.getAccount());
 if(!opening)opening=modal.open().finally(()=>{opening=null;});
 await opening;return modal;
}
