import {createAppKit} from '@reown/appkit';
import {EthersAdapter} from '@reown/appkit-adapter-ethers';
import {SolanaAdapter} from '@reown/appkit-adapter-solana';
import {mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana} from '@reown/appkit/networks';
let modal;
export async function connect(projectId,onAccount){
 if(!projectId)throw Error('Wallet connections are being configured.');
 if(!modal){
  modal=createAppKit({adapters:[new EthersAdapter(),new SolanaAdapter()],networks:[mainnet,base,arbitrum,polygon,optimism,avalanche,bsc,solana],projectId,metadata:{name:'AV',description:'Audiovisual instrument and NFT marketplace',url:location.origin,icons:[new URL('upic-logo-transparent.svg',document.baseURI).href]},themeMode:'dark',themeVariables:{'--w3m-accent':'#dedede','--w3m-font-family':'Unifont, monospace','--w3m-border-radius-master':'0px'},features:{analytics:false,email:false,socials:false,swaps:false,onramp:false}});
  modal.subscribeAccount(account=>onAccount?.(account));
 }
 await modal.open();return modal;
}
