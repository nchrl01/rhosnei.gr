// Image tone shared with the local Earthbound study.
export const colourGLSL=`
uniform vec4 uArtworkBackground;
uniform float uImageCells;

vec3 coinInk(vec2 uv){
 vec2 cell=min(floor(clamp(uv,0.,1.)*uImageCells),vec2(uImageCells-1.));
 vec2 imageUV=(cell+.5)/uImageCells;
 vec4 image=texture2D(uIdentityImage,vec2(imageUV.x,1.-imageUV.y));
 vec3 difference=abs(image.rgb-uArtworkBackground.rgb);
 float separation=max(difference.r,max(difference.g,difference.b));
 float foreground=mix(1.,smoothstep(.06,.38,separation),uArtworkBackground.a);
 // Ordered dithering changes tone inside the image grid, never mark occupancy.
 float threshold=Bayer4(cell);
 foreground=clamp(floor(foreground*3.+threshold)/3.,0.,1.);
 float peak=max(image.r,max(image.g,image.b));
 vec3 hue=peak>.06?image.rgb/peak:vec3(1.);
 // Lift deep colours enough to read on black, retaining their hue.
 vec3 colour=mix(vec3(.3),mix(vec3(1.),hue,.65),foreground);
 // Introduce only the two primary colours at the $50M milestone.
 // Sample image positions without its background-darkening or tone mask.
 float distanceA=dot(image.rgb-uArtworkColorA,image.rgb-uArtworkColorA);
 float distanceB=dot(image.rgb-uArtworkColorB,image.rgb-uArtworkColorB);
 vec3 primary=mix(uArtworkColorA,uArtworkColorB,step(distanceB,distanceA));
 // Keep dark primary ink visible on the black canvas without changing holder brightness.
 float primaryPeak=max(primary.r,max(primary.g,primary.b));
 // Lift palette luminance without flattening holder-driven size or faintness.
 vec3 visiblePrimary=primaryPeak>.001?primary/primaryPeak*max(.4,sqrt(primaryPeak)):vec3(.4);
 return mix(vec3(1.),visiblePrimary,image.a*uArtworkColor);
}
`;
export function artworkBackground(source){
 const pixels=source.originalPixels||source.pixels,w=source.width,h=source.height;
 const bins=new Map();
 // Border mode avoids averaging unrelated colours into a false background.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(x>1&&x<w-2&&y>1&&y<h-2)continue;
  const i=(y*w+x)*4,alpha=pixels[i+3]/255;
  const key=alpha<.1?'transparent':[(pixels[i]>>4),(pixels[i+1]>>4),(pixels[i+2]>>4)].join(',');
  const bin=bins.get(key)||{count:0,r:0,g:0,b:0,a:0};
  bin.count++;bin.r+=pixels[i];bin.g+=pixels[i+1];bin.b+=pixels[i+2];bin.a+=alpha;bins.set(key,bin);
 }
 const dominant=[...bins.values()].sort((a,b)=>b.count-a.count)[0];
 return dominant?[dominant.r/dominant.count/255,dominant.g/dominant.count/255,dominant.b/dominant.count/255,dominant.a/dominant.count]:[1,1,1,1];
}
