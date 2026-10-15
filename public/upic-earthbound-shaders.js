import {pixelIdentityGLSL} from './pixel-identity.js?v=276';
import {EARTHBOUND_GLSL} from './upic-earthbound-core.js?v=earthbound-4';
const guideGLSL=pixelIdentityGLSL.replace(/\btexture\(/g,'texture2D(').replace('float side=.82*min(viewSize.x,viewSize.y);','vec2 side=uImageSize;');
export const markVertex=`
precision highp float;
attribute vec2 position;
attribute vec2 aMarkCenter;
attribute float aMarkSize;
attribute vec2 aMarkId;
uniform vec2 uResolution;
varying vec2 vMarkCenter;
varying float vMarkSize;
varying vec2 vMarkId;
void main(){
  vMarkCenter=aMarkCenter;vMarkSize=aMarkSize;vMarkId=aMarkId;
  gl_Position=vec4(position/uResolution*2.-1.,0.,1.);
}`;
export const fragment=`
precision highp float;
uniform sampler2D uIdentityImage;
uniform vec2 uImageSize;
uniform vec2 uResolution;
uniform vec2 uCanvasScale;
uniform float uIdentity;
uniform float uIdentityMotion;
uniform float uTime;
uniform float uSeed;
uniform float uArtworkColor;
uniform float uPixelPresence;
uniform float uInkColor;
uniform vec3 uArtworkColorA;
uniform vec3 uArtworkColorB;
varying vec2 vMarkCenter;
varying float vMarkSize;
varying vec2 vMarkId;
float Bayer2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}
#define Bayer4(a) (Bayer2(.5*(a))*.25+Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*.25+Bayer2(a))
${guideGLSL}
${EARTHBOUND_GLSL}
void main(){
  // Mark bounds are packed using their actual holder-driven diameters.
  // Artwork changes pattern sampling/occupancy inside those reserved bounds;
  // it never pushes marks into the required empty gaps.
  vec2 origin=floor(uResolution*.5);
  vec2 rasterPoint=floor(gl_FragCoord.xy);
  vec2 pixelId=floor(vMarkId+.5);
  vec2 squarePoint=vMarkCenter-origin;
  vec4 imageGuide=vec4(0.);
  float imagePalette=-1.;
  if(uIdentity>0.||uArtworkColor>0.)imageGuide=identityGuide(squarePoint,imagePalette);
  vec2 samplePoint=squarePoint+imageGuide.ba*uIdentity*.045*uImageSize;
  float feed=.5;
  if(uFieldMode>.5)feed=earthboundFeed(samplePoint/uResolution.y,feed);
  // These occupancy and Bayer formulas are the current UPIC renderer's.
  float imageOccupancy=.04+.88*imageGuide.r;
  feed=mix(feed,imageOccupancy+clamp(feed-.5,-.5,.5)*.16,uIdentity);
  float bw=step(.5,feed+Bayer8(pixelId)-.5);
  float survival=step(fract(sin(pixelId.x*73.17+pixelId.y*193.41+7.3)*43758.5453),uPixelPresence);
  bw*=survival*earthboundMark(rasterPoint,vMarkCenter,vMarkSize*sqrt(uPixelPresence),imageGuide.g);
  float h=fract(sin(dot(pixelId,vec2(127.1,311.7)))*43758.5453);
  float colorIndex=imagePalette<0.?step(.5,h):imagePalette;
  vec3 artworkInk=mix(uArtworkColorA,uArtworkColorB,colorIndex);
  gl_FragColor=vec4(bw*uInkColor*mix(vec3(1.),artworkInk,uArtworkColor),1.);
}`;

