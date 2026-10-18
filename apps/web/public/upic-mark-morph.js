// Circle, + and × share one signed-distance boundary. Mixing distances moves
// that boundary instead of fading two overlapping marks into one another.
// Diameters remain holder-driven: neither path imposes a minimum mark size.
export const MARK_MORPH_GLSL=`
uniform vec3 uMarkShapeWeights;

float markBoxDistance(vec2 p,vec2 extent){
  vec2 q=abs(p)-extent;
  return length(max(q,vec2(0.)))+min(max(q.x,q.y),0.);
}

float morphMark(vec2 rasterPoint,vec2 centre,float diameter){
  if(diameter<=0.)return 0.;
  float halfSize=diameter*.5;
  vec2 origin=floor(centre-vec2(halfSize)+.5);
  vec2 p=rasterPoint-origin+vec2(.5-halfSize);
  float bounds=markBoxDistance(p,vec2(halfSize));
  float halfStroke=min(diameter,max(1.,floor(diameter*.23+.5)))*.5;
  float circle=length(p)-halfSize;
  float plus=min(markBoxDistance(p,vec2(halfSize,halfStroke)),
                 markBoxDistance(p,vec2(halfStroke,halfSize)));
  float cross=max(min(abs(p.x-p.y),abs(p.x+p.y))*.7071067811865476-halfStroke,bounds);
  vec3 weights=max(uMarkShapeWeights,vec3(0.));
  float total=weights.x+weights.y+weights.z;
  weights=total>0.?weights/total:vec3(1.,0.,0.);
  float distance=dot(vec3(circle,plus,cross),weights);
  return step(max(distance,bounds),0.);
}`;

function boxDistance(px,py,hx,hy){
  const qx=Math.abs(px)-hx,qy=Math.abs(py)-hy;
  return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);
}

// px/py are the pixel centre relative to the mark centre, after applying the
// same snapped origin as the shader: dx + .5 - diameter / 2 (and likewise y).
export function morphMarkInside(px,py,diameter,weights){
  if(!(diameter>0))return false;
  const halfSize=diameter*.5,halfStroke=Math.min(diameter,Math.max(1,Math.floor(diameter*.23+.5)))*.5;
  const ax=Math.abs(px),ay=Math.abs(py);
  if(ax>halfSize||ay>halfSize)return false;
  // Most frames are settled: avoid signed-distance work for every image pixel.
  if(weights?.[0]===1&&weights[1]===0&&weights[2]===0)return px*px+py*py<=halfSize*halfSize;
  if(weights?.[1]===1&&weights[0]===0&&weights[2]===0)return Math.min(ax,ay)<=halfStroke;
  if(weights?.[2]===1&&weights[0]===0&&weights[1]===0)return Math.abs(ax-ay)*.7071067811865476<=halfStroke;
  const bounds=boxDistance(px,py,halfSize,halfSize);
  const circle=Math.hypot(px,py)-halfSize;
  const plus=Math.min(boxDistance(px,py,halfSize,halfStroke),boxDistance(px,py,halfStroke,halfSize));
  const cross=Math.max(Math.min(Math.abs(px-py),Math.abs(px+py))*.7071067811865476-halfStroke,bounds);
  let a=Math.max(0,weights?.[0]??1),b=Math.max(0,weights?.[1]??0),c=Math.max(0,weights?.[2]??0);
  const total=a+b+c;
  if(total>0){a/=total;b/=total;c/=total;}
  else{a=1;b=0;c=0;}
  return circle*a+plus*b+cross*c<=0;
}
