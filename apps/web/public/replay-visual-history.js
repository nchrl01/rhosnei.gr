// Central, recorded player frames. Nothing is persisted on a visitor's device.
const endpoint='https://upic-insightx.nchrl01.workers.dev/visual-history';
export function createReplayVisualHistory(host){
 const image=document.createElement('img');image.className='replay-recorded-frame';image.alt='Recorded UPIC visual';image.hidden=true;image.draggable=false;host.append(image);
 const label=document.createElement('span');label.className='replay-visual-source';label.hidden=true;host.append(label);
 let frames=[],controller,generation=0,current='',replaying=false,failed=new Set();
 image.onerror=()=>{failed.add(current);current='';image.hidden=true;host.classList.remove('has-recorded-frame');label.textContent='Chart reconstruction';};
 return {
  async setMarket(market){
   const version=++generation;controller?.abort();controller=new AbortController();frames=[];current='';failed=new Set();image.hidden=true;host.classList.remove('has-recorded-frame');
   if(!market?.baseToken?.address||market.source==='ccxt'&&!market.nativeAsset)return;
   try{
    const url=new URL(endpoint);url.search=new URLSearchParams({network:market.nativeAsset?.chain||market.chainId,address:market.nativeAsset?.address||market.baseToken.address});
    const response=await fetch(url,{signal:controller.signal,cache:'no-store'});if(!response.ok)return;
    const data=await response.json();if(version!==generation||!Array.isArray(data.frames))return;
    frames=data.frames.filter(f=>Number.isSafeInteger(f.capturedAt)&&f.capturedAt>0&&f.capturedAt<=Date.now()+1000).sort((a,b)=>a.capturedAt-b.capturedAt);
   }catch{}
  },
  frame(m,cursor){
   replaying=Boolean(m.replay);label.hidden=!replaying;
   const at=Number(cursor??m.replay?.at),saved=replaying?frames.findLast(f=>f.capturedAt<=at&&at-f.capturedAt<60000):null;
   // A still records one moment, not every instant until the next capture.
   // Never carry a newer frame backwards or stretch sparse coverage over gaps.
   const id=saved?String(saved.capturedAt):'';
   if(!saved||failed.has(id)){
    current='';image.hidden=true;host.classList.remove('has-recorded-frame');
    label.textContent=m.replay?.source==='observed'?'Recorded market inputs':'Chart reconstruction';return;
   }
   label.textContent='Recorded frame · '+new Date(saved.capturedAt).toLocaleTimeString();
   if(current!==id){current=id;image.hidden=true;host.classList.remove('has-recorded-frame');
    image.onload=()=>{if(current===id&&replaying){image.hidden=false;host.classList.add('has-recorded-frame');}};
    const url=new URL(endpoint+'/image');url.search=new URLSearchParams({network:saved.chain,address:saved.address,at:id});image.src=url;
   }
  },
  close(){generation++;controller?.abort();image.remove();label.remove();host.classList.remove('has-recorded-frame');},
 };
}
