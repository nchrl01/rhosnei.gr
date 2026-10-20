// Decide which tones describe the subject once, when artwork is decoded.
// A uniform border is evidence of a background; a busy border is not.
export function artworkForeground(rgba,width,height){
 const histogram=new Float64Array(256),edges=[],bins=new Map(),count=width*height;
 let weight=0,transparent=0;
 const band=Math.max(1,Math.floor(Math.min(width,height)*.025));
 const luminance=i=>rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const index=y*width+x,i=index*4,alpha=rgba[i+3]/255;
  if(alpha<.05)transparent++;
  if(alpha<=0)continue;
  histogram[Math.round(luminance(i))]+=alpha;weight+=alpha;
  if(alpha<.5)continue;
  const boundary=x<band||y<band||x>=width-band||y>=height-band||
   rgba[(index-1)*4+3]<128||rgba[(index+1)*4+3]<128||
   rgba[(index-width)*4+3]<128||rgba[(index+width)*4+3]<128;
  if(!boundary)continue;
  const key=(rgba[i]>>5)*64+(rgba[i+1]>>5)*8+(rgba[i+2]>>5);
  let bin=bins.get(key);if(!bin){bin={weight:0,r:0,g:0,b:0};bins.set(key,bin);}
  bin.weight+=alpha;bin.r+=rgba[i]*alpha;bin.g+=rgba[i+1]*alpha;bin.b+=rgba[i+2]*alpha;
  edges.push(i);
 }
 if(!weight)return {polarity:'alpha',confidence:1,background:null};
 const percentile=fraction=>{let sum=0;for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=weight*fraction)return i;}return 255;};
 const low=percentile(.005),high=percentile(.995),range=high-low;
 const hasTransparency=transparent>count*.02;
 // White and coloured symbols with transparent surroundings must not vanish
 // just because their visible pixels contain no dark tones.
 if(hasTransparency&&range<24)return {polarity:'alpha',confidence:1,background:null};
 let dominant=null;for(const bin of bins.values())if(!dominant||bin.weight>dominant.weight)dominant=bin;
 if(dominant&&edges.length>=8&&range>=24){
  const rgb=[dominant.r,dominant.g,dominant.b].map(value=>value/dominant.weight);
  let matched=0,total=0,sum=0;
  for(const i of edges){
   const alpha=rgba[i+3]/255;total+=alpha;
   if(Math.hypot(rgba[i]-rgb[0],rgba[i+1]-rgb[1],rgba[i+2]-rgb[2])<=45){
    matched+=alpha;sum+=luminance(i)*alpha;
   }
  }
  const confidence=total?matched/total:0,background=matched?sum/matched:0;
  if(confidence>=.7){
   const position=(background-low)/range;
   if(position<=.3)return {polarity:'light',confidence,background:rgb};
   if(position>=.7)return {polarity:'dark',confidence,background:rgb};
  }
 }
 // Preserve a transparent silhouette, or the established tonal treatment for
 // opaque photographs/complex artwork whose background cannot be inferred.
 return {polarity:hasTransparency?'alpha':'dark',confidence:0,background:null};
}
