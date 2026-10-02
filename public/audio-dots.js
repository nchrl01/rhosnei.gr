// Draw the measured post-master audio, never chart geometry or invented trades.
export function createAudioDots(canvas,{getAudio=()=>null,getState=()=>({})}={}){
 const c=canvas.getContext('2d'),desktop=matchMedia('(min-width:1050px)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let w=0,h=0,last=0,energy=0,bass=0,mid=0,high=0,phase=0,tap=null,wave,spectrum;
 const dots=Array.from({length:1700},(_,i)=>{const r=Math.sqrt((i+.5)/1700),theta=i*2.399963;return {x:r*Math.cos(theta),y:r*Math.sin(theta),r,theta};});
 function size(){const b=canvas.getBoundingClientRect();w=b.width;h=b.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);}
 new ResizeObserver(size).observe(canvas);
 function frame(now){
  requestAnimationFrame(frame);if(document.hidden||!desktop.matches||!w||!h)return;
  if(now-last<(reduced.matches?200:1000/30))return;const dt=Math.min(.1,(now-last)/1000||.033);last=now;
  const state=getState(),audio=getAudio(),active=state.playing&&audio?.context.state==='running';
  if(audio&&audio!==tap){tap=audio;wave=new Float32Array(tap.fftSize);spectrum=new Uint8Array(tap.frequencyBinCount);}
  let rms=0,b=0,m=0,t=0;
  if(active){tap.getFloatTimeDomainData(wave);tap.getByteFrequencyData(spectrum);rms=Math.sqrt(wave.reduce((sum,n)=>sum+n*n,0)/wave.length);const hz=tap.context.sampleRate/tap.fftSize;let bn=0,mn=0,tn=0;for(let i=1;i<spectrum.length;i++){const f=i*hz,n=spectrum[i]/255;if(f<250){b+=n;bn++;}else if(f<2500){m+=n;mn++;}else if(f<9000){t+=n;tn++;}}b/=bn||1;m/=mn||1;t/=tn||1;}
  const smooth=1-Math.exp(-dt/.15);energy+=(Math.min(1,rms*5)-energy)*smooth;bass+=(b-bass)*smooth;mid+=(m-mid)*smooth;high+=(t-high)*smooth;
  if(active&&!reduced.matches)phase+=dt*(.2+energy*1.3);
  c.clearRect(0,0,w,h);const radius=Math.min(w*.34,h*.36,250),cx=w*.5,cy=h*.48;
  // A dotted fluid lens: stable seeded locations, spectral layers and soft depth.
  for(const d of dots){
   const ripple=Math.sin(d.theta*3+phase*2+d.r*9)*energy*.14+Math.sin(d.theta*5-phase+d.r*5)*mid*.08;
   const stretch=1+bass*.18,angle=d.theta+phase*.12*(1-d.r);
   const x=cx+Math.cos(angle)*d.r*radius*(1+ripple)*stretch,y=cy+Math.sin(angle)*d.r*radius*(.66+ripple)+Math.sin(d.x*5+phase)*mid*radius*.11;
   const fade=(1-d.r**3)*(.16+energy*.62),glow=energy>.025&&Math.sin(d.theta+phase)>0;
   c.fillStyle=glow?`rgba(230,0,205,${fade})`:`rgba(17,17,17,${fade})`;c.beginPath();c.arc(x,y,(.65+d.r*.4+high*.55)*(1+energy*.35),0,Math.PI*2);c.fill();
  }
  canvas.dataset.active=String(Boolean(active));canvas.dataset.energy=energy.toFixed(3);
 }
 requestAnimationFrame(frame);
}
