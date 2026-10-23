// Shared clock for the market-driven Game Boy host. It has no melody model
// or audio generators; frozen observations define transport position only.
export const scoreTempo=music=>Math.max(20,Math.min(200,Number(music?.tempo)||100));
export function createCompositionTimeline(segments,playbackRate=1){
 // Accelerated charts keep a musical subdivision instead of squeezing a
 // hundred attacks into each beat. Power-of-two folding preserves meter.
 const rate=Math.max(.1,Number(playbackRate)||1);
 let beat=0;
 const rows=segments.map((segment,i)=>{const start=segment.start,end=Math.max(start+1,segments[i+1]?.start??segment.end),sourceTempo=scoreTempo(segment.music),fold=2**Math.max(0,Math.ceil(Math.log2(sourceTempo*rate/200))),tempo=sourceTempo/fold,row={...segment,start,end,tempo,audibleTempo:tempo*rate,beat,endBeat:beat+(end-start)*tempo/60000};beat=row.endBeat;return row;});
 const find=(value,field)=>{let lo=0,hi=rows.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(rows[mid][field]<=value)lo=mid;else hi=mid-1;}return rows[lo];};
 return {rows,beatAt(at){const row=find(at,'start');return row?row.beat+(at-row.start)*row.tempo/60000:0;},atBeat(value){const row=find(value,'beat');return row?row.start+(value-row.beat)*60000/row.tempo:0;},contextAtBeat(value){return find(value,'beat');}};
}
