import {nativeCoin} from './native-coins.js?v=354';
const RELAY='https://upic-insightx.nchrl01.workers.dev/native-holders',MAX_AGE=6*3600000;
const empty=()=>({state:'unavailable',source:'Native address index',records:[],weight:0,holders:null,totalHolders:null,complete:false,native:true});
export function createNativeHolders({onChange=()=>{}}={}){
 let state=empty(),controller,timer,epoch=0;
 const snapshot=(now=Date.now())=>{const age=state.fetchedAt?now-state.fetchedAt:null,sourceAge=state.sourceAt==null?age:now-state.sourceAt,weight=age!==null&&age>=0&&age<MAX_AGE&&sourceAge>=-300000&&sourceAge<MAX_AGE?1:0;return {...state,age,weight,records:weight?state.records:[],state:state.records.length&&!weight?'expired':state.state};};
 function close(){epoch++;controller?.abort();clearTimeout(timer);state=empty();}
 function setMarket(pair){close();const asset=nativeCoin(pair?.baseToken?.symbol);if(!asset||pair.nativeAsset?.chain!==asset.chain)return;const version=epoch;state={...empty(),state:'loading',network:asset.chain};onChange();
  async function refresh(){
   if(version!==epoch)return;if(document.hidden){timer=setTimeout(refresh,30000);return;}controller=new AbortController();
   try{
    const url=new URL(RELAY);url.searchParams.set('network',asset.chain);
    const response=await fetch(url,{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)])});if(!response.ok)throw Error('native-relay-unavailable');const data=await response.json();if(version!==epoch)return;
    if(data.network!==asset.chain||data.address!=='native'||!Array.isArray(data.records))throw Error('native-identity-mismatch');
    const records=data.records.slice(0,100).filter(row=>typeof row.id==='string'&&row.id.length<=150&&Number.isFinite(row.tokenBalance)&&row.tokenBalance>0);
    const valid=records.length&&Number.isFinite(data.fetchedAt)&&data.fetchedAt<=Date.now()+1000&&Date.now()-data.fetchedAt<MAX_AGE&&(data.sourceAt==null||(Number.isSafeInteger(data.sourceAt)&&data.sourceAt<=Date.now()+300000&&Date.now()-data.sourceAt<MAX_AGE));
    state=valid?{...data,records,holders:null,totalHolders:null,native:true}:{...empty(),state:data.state||'unavailable',nextAt:data.nextAt};
   }catch{if(version!==epoch)return;state={...state,state:'delayed'};}
   if(version!==epoch)return;onChange();timer=setTimeout(refresh,Math.max(60000,Math.min(3600000,(Number(state.nextAt)||Date.now()+300000)-Date.now())));
  }void refresh();
 }
 return {snapshot,setMarket,close};
}
