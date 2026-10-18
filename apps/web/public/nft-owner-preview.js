// Illustrative UI only. Never reads a wallet or claims an NFT was minted.
export function createNftOwnerPreview(panel,visual){
 if(!panel||!visual)return {setMarket(){},close(){}};
 const mobile=matchMedia('(max-width:760px)'),anchor=document.createComment('NFT owner preview position');
 panel.parentNode.insertBefore(anchor,panel);
 function arrange(){
  const player=document.querySelector('.instrument');
  if(mobile.matches&&player)player.append(panel);
  else anchor.parentNode?.insertBefore(panel,anchor.nextSibling);
 }
 function setMarket(pair){
  panel.hidden=!pair;
  if(pair){
   const token=pair.baseToken?.symbol||pair.baseToken?.name||'Coin';
   panel.querySelector('[data-owner-edition]').textContent=token+' · Example edition #001 / 100';
  }
  arrange();
 }
 mobile.addEventListener('change',arrange);arrange();
 return {setMarket,close(){mobile.removeEventListener('change',arrange);anchor.remove();}};
}
