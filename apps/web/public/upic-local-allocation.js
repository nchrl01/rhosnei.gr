const validDimension=value=>Number.isInteger(value)&&value>0;
const cellKey=(row,column)=>row+','+column;
const compareText=(a,b)=>a<b?-1:a>b?1:0;
function hash(text){
 let value=2166136261;
 for(const character of text)value=Math.imul(value^character.charCodeAt(0),16777619);
 return (value>>>0)/4294967296;
}

// Allocate wallets before applying cell-dependent edge shrink and brightness.
// Existing slots remain fixed whenever possible; a regrid preserves local
// neighbourhoods by partitioning wallet anchors and cell sites together.
export function assignHoldersToCells(cells,holders,previous,columns,rows,coinKey){
 const original=holders.slice();
 if(!cells.length||cells.length!==holders.length||!validDimension(columns)||!validDimension(rows)
  ||!previous||previous.coinKey!==coinKey||!validDimension(previous.columns)||!validDimension(previous.rows)
  ||!Array.isArray(previous.cells))return original;

 const oldById=new Map();
 for(const cell of previous.cells){
  if(!cell||typeof cell.id!=='string'||!cell.id||!Number.isInteger(cell.row)||!Number.isInteger(cell.column)
   ||cell.row<0||cell.column<0||cell.row>=previous.rows||cell.column>=previous.columns||oldById.has(cell.id))continue;
  oldById.set(cell.id,cell);
 }
 if(!oldById.size)return original;

 const sites=cells.map((cell,index)=>({index,row:cell.row,column:cell.column,
  x:(cell.column+.5)/columns,y:(cell.row+.5)/rows}));
 if(sites.some(site=>!Number.isInteger(site.row)||!Number.isInteger(site.column)
  ||site.row<0||site.column<0||site.row>=rows||site.column>=columns))return original;

 const allocation=new Array(holders.length);
 if(columns===previous.columns&&rows===previous.rows){
  const siteByCell=new Map(sites.map(site=>[cellKey(site.row,site.column),site.index]));
  const reserved=new Set(),newcomers=[];
  let canKeepSlots=siteByCell.size===sites.length;
  for(const holder of holders){
   const old=oldById.get(holder.id);
   if(!old){newcomers.push(holder);continue;}
   const index=siteByCell.get(cellKey(old.row,old.column));
   if(index===undefined||reserved.has(index)){canKeepSlots=false;break;}
   reserved.add(index);allocation[index]=holder;
  }
  if(canKeepSlots){
   let next=0;
   for(let index=0;index<allocation.length;index++)if(!reserved.has(index))allocation[index]=newcomers[next++];
   return allocation;
  }
 }

 const anchors=holders.map((holder,index)=>{
  const old=oldById.get(holder.id),id=String(holder.id??index);
  return {holder,index,id,
   x:old?(old.column+.5)/previous.columns:hash(coinKey+':holder-position:x:'+id),
   y:old?(old.row+.5)/previous.rows:hash(coinKey+':holder-position:y:'+id)};
 });
 function partition(wallets,targets){
  if(targets.length===1){allocation[targets[0].index]=wallets[0].holder;return;}
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const target of targets){
   minX=Math.min(minX,target.x);maxX=Math.max(maxX,target.x);
   minY=Math.min(minY,target.y);maxY=Math.max(maxY,target.y);
  }
  const axis=maxX-minX>=maxY-minY?'x':'y',other=axis==='x'?'y':'x';
  wallets.sort((a,b)=>a[axis]-b[axis]||a[other]-b[other]||compareText(a.id,b.id)||a.index-b.index);
  targets.sort((a,b)=>a[axis]-b[axis]||a[other]-b[other]||a.row-b.row||a.column-b.column||a.index-b.index);
  const middle=Math.floor(targets.length/2);
  partition(wallets.slice(0,middle),targets.slice(0,middle));
  partition(wallets.slice(middle),targets.slice(middle));
 }
 partition(anchors,sites);
 return allocation;
}
