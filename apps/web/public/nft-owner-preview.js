// The former owner panel contained only a sample collection, not owner data.
// Keep sourced coin background, but do not present an invented collectible.
export function createNftOwnerPreview(panel){
 if(panel){
  const summary=panel.querySelector('.coin-ai-summary'),player=document.querySelector('.instrument');
  if(summary&&player){summary.classList.add('coin-background');player.append(summary);}
  panel.remove();
 }
 return {setMarket(){},close(){}};
}
