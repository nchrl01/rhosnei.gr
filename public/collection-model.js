export const MILESTONES=[1,2,5,10,25,50];
export const CHAPTERS=['Origin','Counterpoint','Motion','Polyphony','Expansion','Total field'];
export const PRICE_WEI=50000000000000000n;
export const VERSION=1;
export function identity(chain,address){
 if(!chain||!address)throw Error('A network and token address are required.');
 return chain+':'+(/^0x[0-9a-f]{40}$/i.test(address)?address.toLowerCase():address);
}
export function seedOf(text){let seed=2166136261;for(const char of text){seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);}return seed>>>0;}
export function random(seed){return ()=>{seed=(seed+0x6D2B79F5)>>>0;let n=Math.imul(seed^(seed>>>15),1|seed);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};}
export function positive(value){return typeof value==='number'&&Number.isFinite(value)&&value>0;}
export function createCollection(market,originator,now=Date.now()){
 if(!positive(market.marketCap))throw Error('A reported market cap is required; FDV cannot substitute for it.');
 const id=identity(market.chainId,market.baseToken.address);
 return {version:VERSION,id,seed:seedOf(id),name:market.baseToken.name,symbol:market.baseToken.symbol,chain:market.chainId,address:market.baseToken.address,pool:market.pairAddress,baseline:market.marketCap,latest:market.marketCap,peak:market.marketCap,createdAt:now,observedAt:now,originator,minted:0,unlocks:[{multiple:1,at:now}]};
}
export function observe(collection,cap,now=Date.now()){
 if(!positive(cap))return collection;
 const next={...collection,latest:cap,peak:Math.max(collection.peak,cap),observedAt:now,unlocks:[...collection.unlocks]};
 for(const multiple of MILESTONES)if(next.peak/next.baseline>=multiple&&!next.unlocks.some(item=>item.multiple===multiple))next.unlocks.push({multiple,at:now});
 return next;
}
export function validCollection(c){return c?.version===VERSION&&c.id===identity(c.chain,c.address)&&c.seed===seedOf(c.id)&&positive(c.baseline)&&positive(c.latest)&&positive(c.peak)&&Number.isInteger(c.minted)&&c.minted>=0&&c.minted<=100&&Array.isArray(c.unlocks)&&c.unlocks.length>0&&c.unlocks.every(u=>MILESTONES.includes(u.multiple));}
export function chapterOf(c){return Math.max(...c.unlocks.map(u=>MILESTONES.indexOf(u.multiple)));}
export function simulateMint(c){if(c.minted>=100)throw Error('All 100 preview editions are allocated.');return {...c,minted:c.minted+1};}
export function primarySplit(count){const total=BigInt(count)*PRICE_WEI;return {total,burn:total/2n,originator:total/4n,protocol:total/4n};}
export function score(seed,chapter){
 const rng=random(seed),root=48+Math.floor(rng()*12),minor=rng()>.5,scale=minor?[0,2,3,5,7,8,10]:[0,2,4,5,7,9,11];
 const motif=Array.from({length:16},()=>Math.floor(rng()*7)),tempo=66+(seed%17);
 const notes=[];
 for(let layer=0;layer<=chapter;layer++)for(let step=0;step<32;step++){
  const stride=layer===0?4:layer===1?2:1;if(step%stride)continue;
  const degree=(motif[(step+layer*3)%16]+layer*2)%7;
  notes.push({beat:step*.5+(layer%2)*.25,midi:root+scale[degree]+(layer===0?0:12*(1+layer%2)),duration:layer===0?1.5:layer===1?.65:.22,layer,velocity:.07/(1+layer*.5)});
 }
 return {root,minor,tempo,beats:16,notes};
}
