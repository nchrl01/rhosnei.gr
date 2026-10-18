// Conservative square bounds protect circles, crosses and plus signs while
// their centres move between grid cells. Settled sizes belong to the layout.
export function protectMovingMarks(marks,gap=2){
 const clearance=Number.isFinite(gap)?Math.max(0,gap):2;
 const active=[];
 let largestDiameter=0;
 for(const mark of marks){
  if(!Number.isFinite(mark.x)||!Number.isFinite(mark.y)||!Number.isFinite(mark.diameter)||mark.diameter<=0)continue;
  // Keep the unmodified diameter for this pass so processing order cannot
  // change which visible marks participate in collision protection.
  const entry={mark,x:mark.x,y:mark.y,diameter:mark.diameter};
  active.push(entry);largestDiameter=Math.max(largestDiameter,entry.diameter);
 }
 if(active.length<2)return marks;
 const bucketSize=Math.max(2,largestDiameter+clearance),buckets=new Map();
 const key=(x,y)=>x+','+y;
 for(const entry of active){
  entry.bx=Math.floor(entry.x/bucketSize);entry.by=Math.floor(entry.y/bucketSize);
  const bucketKey=key(entry.bx,entry.by);
  let bucket=buckets.get(bucketKey);
  if(!bucket){
   bucket={entries:[],minX:entry.x,maxX:entry.x,minY:entry.y,maxY:entry.y};
   buckets.set(bucketKey,bucket);
  }
  bucket.entries.push(entry);
  bucket.minX=Math.min(bucket.minX,entry.x);bucket.maxX=Math.max(bucket.maxX,entry.x);
  bucket.minY=Math.min(bucket.minY,entry.y);bucket.maxY=Math.max(bucket.maxY,entry.y);
 }
 for(const entry of active){
  let nearest=Infinity;
  // More distant buckets cannot contain overlapping square bounds because
  // their minimum separation already exceeds the largest candidate diameter.
  for(let by=entry.by-1;by<=entry.by+1;by++){
   for(let bx=entry.bx-1;bx<=entry.bx+1;bx++){
    const bucket=buckets.get(key(bx,by));
    if(!bucket)continue;
    if(bucket.entries.length>16){
     // Bound work even when many trajectories converge. A dense own bucket
     // temporarily disappears; another bucket's bounds underestimate distance
     // to its nearest centre, which can only shrink a mark more conservatively.
     if(bx===entry.bx&&by===entry.by){nearest=0;continue;}
     const dx=Math.max(0,bucket.minX-entry.x,entry.x-bucket.maxX);
     const dy=Math.max(0,bucket.minY-entry.y,entry.y-bucket.maxY);
     nearest=Math.min(nearest,Math.max(dx,dy));
    }else{
     for(const other of bucket.entries){
      if(other===entry)continue;
      nearest=Math.min(nearest,Math.max(Math.abs(entry.x-other.x),Math.abs(entry.y-other.y)));
     }
    }
   }
  }
  entry.mark.diameter=Math.min(entry.diameter,Math.max(0,nearest-clearance));
 }
 return marks;
}
