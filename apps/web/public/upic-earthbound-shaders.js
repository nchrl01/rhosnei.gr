import {colourGLSL} from './upic-artwork-detail.js?v=earthbound-7';
import {EARTHBOUND_GLSL} from './upic-earthbound-core.js?v=earthbound-7';
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
${colourGLSL}
${EARTHBOUND_GLSL}
void main(){
  // Mark bounds are packed using their actual holder-driven diameters.
  // Artwork changes colour/brightness inside those reserved bounds;
  // it never pushes marks into the required empty gaps.
  vec2 origin=floor(uResolution*.5);
  vec2 rasterPoint=floor(gl_FragCoord.xy);
  vec2 pixelId=floor(vMarkId+.5);
  vec2 squarePoint=vMarkCenter-origin;
  float feed=earthboundFeed(squarePoint/uResolution.y,.5);
  // Pattern changes brightness, never deletes allocated holder dots.
  float bw=mix(.65,1.,step(.5,feed+Bayer8(pixelId)-.5));
  float survival=step(fract(sin(pixelId.x*73.17+pixelId.y*193.41+7.3)*43758.5453),uPixelPresence);
  bw*=survival*earthboundMark(rasterPoint,vMarkCenter,vMarkSize*sqrt(uPixelPresence),1.);
  gl_FragColor=vec4(bw*uInkColor*coinInk(vMarkCenter/uResolution),1.);
}`;
