// Inferred wallet groups shape the existing pixel field; no extra drawing layer.
// Positions are compositional, not geographic or evidence of wallet ownership.
const LIMIT=8;
const hash=text=>{let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
const unit=x=>Math.max(0,Math.min(1,x));
export function createHolderClusterField(){
 let previousSeed=null,source=null,targets=[],slots=[];
 const packed=new Float32Array(LIMIT*4);
 return {
  update(snapshot,seed,dt,{replay=false,reduced=false}={}){
   if(seed!==previousSeed||replay){previousSeed=seed;source=null;targets=[];slots=[];packed.fill(0);}
   if(!replay&&source!==snapshot?.clusters){
    source=snapshot?.clusters;
    targets=(source||[]).filter(g=>Number.isFinite(g.percentage)&&g.percentage>0&&g.wallets?.length)
     .sort((a,b)=>b.percentage-a.percentage).slice(0,LIMIT).map(g=>{
      const wallets=[...g.wallets].sort((a,b)=>(b.percentage||0)-(a.percentage||0)||a.address.localeCompare(b.address));
      const id=wallets[0].address,key=seed+':'+id,share=unit(g.percentage/100);
      const dominance=unit((wallets[0].percentage||0)/g.percentage);
      return {id,x:(hash(key+':x')-.5)*.8,y:(hash(key+':y')-.5)*.8,r:.045+.22*Math.sqrt(share),s:(.12+.42*Math.sqrt(share))*(.75+.25*dominance)};
     });
    // Keep existing groups in their slots across provider ordering changes.
    const ids=new Set(targets.map(t=>t.id));
    for(const slot of slots)if(!ids.has(slot.id))slot.target=0;
    for(const target of targets){
     const old=slots.find(s=>s.id===target.id);
     if(old)Object.assign(old,{...target,target:target.s,s:old.s});
     else if(slots.length<LIMIT)slots.push({...target,target:target.s,s:0});
    }
   }
   const weight=replay?0:unit(Number(snapshot?.weight)||0),ease=1-Math.exp(-Math.min(.1,Math.max(0,dt))/(reduced?.2:1.8));
   for(const slot of slots)slot.s+=(slot.target*weight-slot.s)*ease;
   slots=slots.filter(s=>s.target>0||s.s>.001);
   // Fill slots freed by outgoing groups without teleporting their centres.
   for(const t of targets)if(slots.length<LIMIT&&!slots.some(s=>s.id===t.id))slots.push({...t,target:t.s,s:0});
   packed.fill(0);slots.forEach((s,i)=>packed.set([s.x,s.y,s.r,s.s],i*4));
   return packed;
  }
 };
}
export function holderClusterFeed(x,y,aspect,groups){
 let sum=0;
 for(let i=0;i<(groups?.length||0);i+=4){
  if(groups[i+3]<=.001)continue;
  const dx=(x-groups[i])*aspect,dy=y-groups[i+1],r=Math.max(.001,groups[i+2]);
  const q=(dx*dx+dy*dy)/(r*r);
  sum+=groups[i+3]*(Math.exp(-q*1.8)-.2*Math.exp(-q*.35));
 }
 return Math.max(-.15,Math.min(.45,sum));
}
export const holderClusterGLSL=`
uniform vec4 uHolderGroups[8];
float holderClusterFeed(vec2 point,float aspect){
 float sum=0.0;
 for(int j=0;j<8;j++){
  vec4 g=uHolderGroups[j];
  if(g.w<=.001)continue;
  vec2 delta=(point-g.xy)*vec2(aspect,1.0);
  float q=dot(delta,delta)/max(.000001,g.z*g.z);
  sum+=g.w*(exp(-q*1.8)-.2*exp(-q*.35));
 }
 return clamp(sum,-.15,.45);
}`;
