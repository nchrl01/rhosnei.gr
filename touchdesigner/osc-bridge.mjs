// Encode one bounded OSC string message for TouchDesigner's OSC In DAT.
export function oscFrame(payload){
 const string=value=>{const s=Buffer.from(value+'\0');return Buffer.concat([s,Buffer.alloc((4-s.length%4)%4)]);};
 return Buffer.concat([string('/upic/frame'),string(',s'),string(JSON.stringify(payload))]);
}
export function validateVisualFrame(frame){
 if(!frame||frame.version!==1||!['observed swaps','historical candle proxy','market snapshots'].includes(frame.source))throw Error('Invalid visual frame');
 const normalized=['running','replay','intensity','activity','volume','motion','pressure','balance','fresh'];
 for(const k of normalized)if(typeof frame[k]!=='number'||!Number.isFinite(frame[k])||frame[k]<0||frame[k]>1)throw Error('Invalid '+k);
 for(const k of ['sequence','seed','voice','word'])if(!Number.isInteger(frame[k])||frame[k]<-1||frame[k]>Number.MAX_SAFE_INTEGER)throw Error('Invalid '+k);
 for(const k of ['price','marketCap','liquidity','tradeRate','change','volumeRatio','turnover','holders'])if(frame[k]!==null&&(typeof frame[k]!=='number'||!Number.isFinite(frame[k])))throw Error('Invalid '+k);
 if(!Array.isArray(frame.trace)||frame.trace.length>32||frame.trace.some(row=>!Array.isArray(row)||row.length!==2||row.some(n=>n!==null&&(typeof n!=='number'||!Number.isFinite(n)))))throw Error('Invalid trace');
 const allowed=['version',...normalized,'sequence','seed','voice','word','price','marketCap','liquidity','tradeRate','change','volumeRatio','turnover','holders','source','trace'];
 return Object.fromEntries(allowed.map(k=>[k,frame[k]]));
}
