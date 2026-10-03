// Original UPIC market score. Every dense field has an observed-event lifetime.
uniform vec4 uControl; // running, event age, intensity, event seed
uniform vec4 uMarket;  // volume, motion, balance, pressure
uniform vec4 uContext; // turnover, volume ratio, finite Pd voice, receive age
uniform vec4 uMeasured; // price, market cap, liquidity, observed trade rate
uniform vec4 uHistoryA, uHistoryB; // eight normalized observed prices; -1 means missing
uniform vec4 uFlowA, uFlowB; // matching normalized historical volume
out vec4 fragColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uControl.w)*43758.5453);}
float observed(int i){return i<4?uHistoryA[i]:uHistoryB[i-4];}
float flow(int i){return i<4?uFlowA[i]:uFlowB[i-4];}
void main(){
 vec2 uv=vUV.st,px=uv*uTDOutputInfo.res.zw;
 float gate= step(.5,uControl.x)*(1.-step(.18,uControl.y))*(1.-step(1.5,uContext.w));
 float ink=0.;
 if(gate>.5){
  float surge=clamp(log(max(1.,uContext.y))/log(10.),0.,1.);
  float energy=clamp(.5*uControl.z+.2*uMarket.x+.15*uMarket.w+.1*surge+.05*uContext.x,0.,1.);
  vec2 grid=vec2(180.,98.),cell=floor(uv*grid),f=fract(uv*grid);
  float choice=mod(floor(uControl.w),3.);
  float datum=mod(cell.y,4.)<1.?uMeasured.x:mod(cell.y,4.)<2.?uMeasured.y:mod(cell.y,4.)<3.?uMeasured.z:uMeasured.w;
  float payload=abs(datum)*(.01+mod(cell.y,7.));
  float bit=step(.5,fract(payload/pow(2.,mod(cell.x,20.))));
  int rowSample=int(clamp(floor(uv.y*8.),0.,7.));
  float selected=step(hash(cell),.13+.38*energy+.07*max(0.,flow(rowSample)));
  float raster=selected*step(f.x,mix(.25,.84,bit))*step(f.y,.2);
  float bars=step(hash(vec2(cell.x,floor(uv.y*8.))),.2+.45*energy)*step(fract(uv.x*240.),.27+.37*bit)*step(fract(uv.y*8.),.68);
  float along=uv.x*7.;int segment=int(min(6.,floor(along)));
  float p0=observed(segment),p1=observed(segment+1);
  float known=step(0.,p0)*step(0.,p1),wave=.18+.64*mix(p0,p1,fract(along));
  float contour=known*step(abs(fract(uv.y*32.)-.5),.08)*step(abs(uv.y-wave),.04+.15*uMarket.y)*step(hash(cell),.25+.45*energy);
  ink=choice<1.?raster:choice<2.?mix(raster,bars,step(.48,uv.y)):max(raster*.4,contour);
  // Registration crosshairs are small local marks, never a full-field inversion.
  vec2 c=abs(uv-vec2(.2+.6*uMarket.z,.28+.4*uMarket.w));
  ink=max(ink,max(step(c.x,.001)*step(c.y,.025),step(c.y,.0015)*step(c.x,.02)));
  // A Pd onset annotates an existing market burst; it cannot create one.
  if(uContext.z>=0.){float lane=(mod(uContext.z,5.)+.5)/5.;ink=max(ink,step(abs(uv.x-lane),.007)*step(abs(uv.y-.92),.002));}
  ink*=step(.025,uv.x)*step(uv.x,.975)*step(.04,uv.y)*step(uv.y,.96);
 }
 fragColor=TDOutputSwizzle(vec4(vec3(1.-clamp(ink,0.,1.)),1.));
}
