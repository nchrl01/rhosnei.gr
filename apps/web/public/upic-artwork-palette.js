const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};

function perceptualColour(rgb){
 const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const [r,g,b]=linear;
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
 const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
 const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const colourDistance=(a,b)=>.45*(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
const paletteDistance=(r,g,b,rgb)=>.2126*(r-rgb[0])**2+.7152*(g-rgb[1])**2+.0722*(b-rgb[2])**2;

// Deterministic, area-weighted colours from the original RGBA, never the
// black/white dither. Discard blank neutral backgrounds only when the artwork
// has a meaningful chromatic population; monochrome artwork stays monochrome.
export function originalArtworkPalette(rgba,{includeNeutrals=false}={}){
 const histogram=new Float64Array(4096*4);let total=0;
 for(let i=0;i<rgba.length;i+=4){
  const alpha=rgba[i+3]/255;if(alpha<=0)continue;
  const bin=((rgba[i]>>4)*256+(rgba[i+1]>>4)*16+(rgba[i+2]>>4))*4;
  histogram[bin]+=alpha;histogram[bin+1]+=rgba[i]*alpha;
  histogram[bin+2]+=rgba[i+1]*alpha;histogram[bin+3]+=rgba[i+2]*alpha;total+=alpha;
 }
 if(!total)return [[1,1,1],[1,1,1]];
 const bins=[],chromatic=[];let colouredWeight=0;
 for(let i=0;i<histogram.length;i+=4){
  const weight=histogram[i];if(!weight)continue;
  const rgb=[histogram[i+1],histogram[i+2],histogram[i+3]].map(v=>v/weight/255);
  const item={rgb,weight,lab:perceptualColour(rgb)};bins.push(item);
  if(Math.max(...rgb)-Math.min(...rgb)>.10&&Math.max(...rgb)>.15){chromatic.push(item);colouredWeight+=weight;}
 }
 const candidates=!includeNeutrals&&colouredWeight>=total*.015?chromatic:bins;
 let first=candidates[0];for(const bin of candidates)if(bin.weight>first.weight)first=bin;
 let second=first,best=-1;
 for(const bin of candidates){
  const score=bin.weight*Math.sqrt(colourDistance(bin.lab,first.lab));
  if(score>best){second=bin;best=score;}
 }
 let colours=[first.rgb.slice(),second.rgb.slice()],centres=[first.lab,second.lab],weights=[0,0];
 for(let pass=0;pass<7;pass++){
  const sums=[[0,0,0],[0,0,0]];weights=[0,0];
  for(const bin of candidates){
   const side=colourDistance(bin.lab,centres[0])<=colourDistance(bin.lab,centres[1])?0:1;
   weights[side]+=bin.weight;
   for(let c=0;c<3;c++)sums[side][c]+=bin.rgb[c]*bin.weight;
  }
  for(let side=0;side<2;side++)if(weights[side])colours[side]=sums[side].map(v=>clamp(v/weights[side]));
  centres=colours.map(perceptualColour);
 }
 if(weights[1]>weights[0])colours.reverse();
 return colours;
}

