import {getWalletAccount,subscribeWalletAccount,openWalletConnection} from './wallet-session.js?v=317';
// Owner details remain illustrative; wallet connection gates the tokenization preview only.
export function createNftOwnerPreview(panel,visual,{onTestMint=()=>false,isEligible=()=>true}={}){
 if(!panel||!visual)return {setMarket(){},close(){}};
 let market=null,pendingWallet=false,openingWallet=false;
 const action=document.createElement('button');action.type='button';action.className='tokenize-coin';action.textContent='Preview collection';action.disabled=true;panel.append(action);
 const dialog=document.createElement('dialog');dialog.id='tokenize-coin-dialog';dialog.setAttribute('aria-labelledby','tokenize-coin-title');
 dialog.innerHTML='<form method="dialog"><button aria-label="Close tokenization">×</button></form><p class="tokenize-preview-label">NFT COLLECTION · TEST PREVIEW</p><h2 id="tokenize-coin-title">Tokenize this coin</h2><p>Turn this coin into an evolving audiovisual NFT collection.</p><p data-tokenize-coin></p><p class="tokenize-address" data-tokenize-address></p><p>Real minting is not available yet. This preview sends no transaction.</p><p data-tokenize-status role="status"></p>';
 document.querySelector('main').append(dialog);
 const walletStatus=document.createElement('p');walletStatus.className='tokenize-wallet-status';walletStatus.setAttribute('role','status');walletStatus.hidden=true;panel.append(walletStatus);
 function showPreview(){
  if(!market||!isEligible(market))return;
  dialog.querySelector('h2').textContent='Tokenize '+(market.baseToken?.symbol||market.baseToken?.name||'this coin');
  dialog.querySelector('[data-tokenize-coin]').textContent=(market.baseToken?.name||market.baseToken?.symbol||'Coin')+' · '+market.chainId;
  dialog.querySelector('[data-tokenize-address]').textContent=market.baseToken?.address||'';
  dialog.querySelector('[data-tokenize-status]').textContent='';if(!dialog.open)dialog.showModal();
 }
 function continueAfterConnection(){if(pendingWallet&&!openingWallet&&getWalletAccount()){pendingWallet=false;walletStatus.hidden=true;showPreview();}}
 const unsubscribe=subscribeWalletAccount(account=>{
  if(account)continueAfterConnection();
  else if(dialog.open)dialog.close();
 });
 async function begin(){
  if(!market||!isEligible(market)||openingWallet)return;
  if(getWalletAccount()){showPreview();return;}
  pendingWallet=true;openingWallet=true;action.disabled=true;action.setAttribute('aria-busy','true');
  walletStatus.hidden=false;walletStatus.textContent='Connect your wallet to continue.';
  try{await openWalletConnection();}
  catch(error){pendingWallet=false;walletStatus.textContent=error.message||'Could not open wallet connection. Please try again.';}
  finally{openingWallet=false;action.disabled=!market||!isEligible(market);action.removeAttribute('aria-busy');continueAfterConnection();}
 }
 action.addEventListener('click',begin);
 const mobile=matchMedia('(max-width:760px)'),anchor=document.createComment('NFT owner preview position');
 panel.parentNode.insertBefore(anchor,panel);
 function arrange(){
  const player=document.querySelector('.instrument');
  if(mobile.matches&&player)player.append(panel);
  else anchor.parentNode?.insertBefore(panel,anchor.nextSibling);
 }
 function setMarket(pair){
  market=pair;pendingWallet=false;walletStatus.hidden=true;if(dialog.open)dialog.close();
  action.disabled=!pair||!isEligible(pair);action.title=action.disabled?'Choose an on-chain coin to tokenize':'Preview an audiovisual NFT collection';
  panel.hidden=!pair;
  if(pair){
   const token=pair.baseToken?.symbol||pair.baseToken?.name||'Coin';
   panel.querySelector('[data-owner-edition]').textContent=token+' · Minting is not available yet.';
  }
  arrange();
 }
 mobile.addEventListener('change',arrange);arrange();
 return {setMarket,close(){unsubscribe();mobile.removeEventListener('change',arrange);dialog.remove();action.remove();walletStatus.remove();anchor.remove();}};
}
