// Infer quiet source-image space once per decode. This is a tonal annotation,
// never an alpha edit, particle mask or market-data/geometry input.
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const none=()=>({kind:'none',confidence:0,coverage:0,empty:null});

export function artworkBackgroundTone(rgba,width,height){
 const count=width*height;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<4||!rgba||rgba.length<count*4)return none();
 let transparent=0,visible=0;
 for(let n=0;n<count;n++){const alpha=rgba[n*4+3];if(alpha<=8)transparent++;if(alpha>=64)visible++;}
 if(visible<count*.005)return none();
 // PNG transparency is explicit evidence. Hidden RGB (often white or black)
 // must not become visible ink. Preserve the source silhouette and its fringe.
 if(transparent>=count*.02){
  const empty=new Uint8Array(count);let total=0;
  for(let n=0;n<count;n++){const amount=1-smooth((rgba[n*4+3]-4)/44);empty[n]=Math.round(amount*255);total+=amount;}
  return {kind:'alpha',confidence:1,coverage:total/count,empty};
 }

 // An opaque image needs several independent signs of a flat logo backdrop.
 // Reject photographs/complex palettes before trying to interpret their edges.
 const histogram=new Uint32Array(4096),edgeBins=new Map(),edges=[];
 const band=Math.max(1,Math.round(Math.min(width,height)*.025));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const n=y*width+x,i=n*4;if(rgba[i+3]<240)continue;
  histogram[(rgba[i]>>4)*256+(rgba[i+1]>>4)*16+(rgba[i+2]>>4)]++;
  if(x>=band&&x<width-band&&y>=band&&y<height-band)continue;
  const key=(rgba[i]>>5)*64+(rgba[i+1]>>5)*8+(rgba[i+2]>>5);
  const bin=edgeBins.get(key)||{count:0,r:0,g:0,b:0};
  bin.count++;bin.r+=rgba[i];bin.g+=rgba[i+1];bin.b+=rgba[i+2];edgeBins.set(key,bin);edges.push(n);
 }
 const weights=[...histogram].filter(Boolean).sort((a,b)=>b-a);
 const opaque=weights.reduce((sum,value)=>sum+value,0);
 if(opaque<count*.96||weights.slice(0,16).reduce((sum,value)=>sum+value,0)<opaque*.92||weights.filter(value=>value>=opaque*.002).length>24)return none();
 const dominant=[...edgeBins.values()].sort((a,b)=>b.count-a.count)[0];
 if(!dominant||edges.length<16)return none();
 const colour=[dominant.r,dominant.g,dominant.b].map(value=>value/dominant.count);
 const distance=n=>{const i=n*4;return Math.max(Math.abs(rgba[i]-colour[0]),Math.abs(rgba[i+1]-colour[1]),Math.abs(rgba[i+2]-colour[2]));};
 const matches=n=>rgba[n*4+3]>=240&&distance(n)<=20;
 const sideTotal=[0,0,0,0],sideMatches=[0,0,0,0];let edgeMatches=0;
 for(const n of edges){
  const x=n%width,y=Math.floor(n/width),match=matches(n);if(match)edgeMatches++;
  for(const [side,onSide] of [[0,x<band],[1,x>=width-band],[2,y<band],[3,y>=height-band]])if(onSide){sideTotal[side]++;if(match)sideMatches[side]++;}
 }
 const confidence=edgeMatches/edges.length;
 if(confidence<.86||sideTotal.some((total,side)=>!total||sideMatches[side]/total<.72))return none();
 const corners=[0,width-1,(height-1)*width,count-1];
 if(corners.filter(matches).length<3)return none();

 // Flood only the matching area connected to the image boundary. A white eye,
 // highlight or lettering inside a coloured subject is not background.
 const empty=new Uint8Array(count),visited=new Uint8Array(count),queue=new Uint32Array(count);
 let head=0,tail=0;
 const add=n=>{if(!visited[n]&&matches(n)){visited[n]=1;queue[tail++]=n;}};
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
 for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 while(head<tail){
  const n=queue[head++],x=n%width,y=Math.floor(n/width);
  empty[n]=Math.round((1-smooth(distance(n)/28))*255);
  if(x) add(n-1);if(x+1<width)add(n+1);if(y)add(n-width);if(y+1<height)add(n+width);
 }
 const coverage=tail/count;
 // A blank tile or an extremely small inferred edge is not useful evidence.
 if(coverage<.08||coverage>.97)return none();
 let distinct=0;
 for(let n=0;n<count;n++)if(!visited[n]&&rgba[n*4+3]>=240&&distance(n)>=48)distinct++;
 if(distinct<count*.015)return none();
 return {kind:'flat-border',confidence,coverage,empty};
}
