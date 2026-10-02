// Kiko Kostadinov's viewport grid: 4px inset, 8/12/16/24 columns,
// whole viewport rows, with content boundaries using the same row unit.
export function installGrid(){
 const root=document.documentElement;
 const selector='main>header,.trending-header,#coin-form,#market-functions,.instrument-top,.readings,.chart-panel,.feed-state,.session';
 let frame=null;
 function fit(){
  frame=null;
  const style=getComputedStyle(root),margin=parseFloat(style.getPropertyValue('--grid-margin'))||4,columns=parseInt(style.getPropertyValue('--grid-columns'))||8;
  const width=root.clientWidth-margin*2,height=root.clientHeight-margin*2-2;
  const rows=Math.max(1,Math.ceil(height/(width/columns))),cellHeight=height/rows;
  root.style.setProperty('--grid-cell-height',cellHeight+'px');
  const blocks=[...document.querySelectorAll(selector)].filter(node=>node.getClientRects().length);
  for(const node of blocks)node.style.removeProperty('--block-height');
  const heights=blocks.map(node=>Math.max(1,Math.ceil((node.getBoundingClientRect().height-.01)/cellHeight))*cellHeight);
  blocks.forEach((node,index)=>node.style.setProperty('--block-height',heights[index]+'px'));
 }
 const schedule=()=>{if(frame===null)frame=requestAnimationFrame(fit);};
 window.addEventListener('resize',schedule);
 document.fonts?.ready.then(schedule);
 // Results and network/pool controls may expand after the initial viewport fit.
 const observer=new MutationObserver(schedule);
 for(const id of ['trending-list','market-selectors']){
  const node=document.getElementById(id);
  observer.observe(node,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});
 }
 fit();
}
