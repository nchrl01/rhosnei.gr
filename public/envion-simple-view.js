import {ENVION_CONTROLS,envionFrame} from './envion-market.js?v=40';
import {CHANCE_LABELS} from './envion-performance.js?v=40';
const text=(tag,className,value)=>{const node=document.createElement(tag);node.className=className||'';if(value!=null)node.textContent=value;return node;};
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const numberFormat=new Intl.NumberFormat('en-US',{maximumSignificantDigits:4});
const fmt=v=>v==null?'—':typeof v==='number'?numberFormat.format(v):String(v);
const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
const file=path=>path?.split('/').pop()||'—';
const GROUPS=[
 {id:'timing',name:'Timing',input:'Market activity → when and how fast samples play',indices:[26,35,72,633,540,651,578,593,483,484],summary:v=>`${fmt(v(35))} envelope stretch · ${fmt(v(72))}× playback`},
 {id:'layers',name:'Sound layers',input:'Activity and movement → grains, tape and modulation',indices:[735,737,740,747,799,822,837,846,857,860,879,880,884,926,751,770,777,784,791,826,867,876,881,471,472,160,760,761,762,763,764,765,766],summary:v=>`Grains ${state(v(751))} · tape ${state(v(876))}`},
 {id:'filter',name:'Filter',input:'Movement and pressure → tone and filter routing',indices:[350,351,353,354,355,356],summary:v=>`${fmt(v(350))} / ${fmt(v(351))} Hz · ${state(v(353)||v(354))}`},
 {id:'space',name:'Echo + reverb',input:'Volume → echo · liquidity → reverb',indices:[444,445,448,450,452,454,456,457,461,369,371,373,379,390,391],extra:['c53-18','c53-40','c53-23','c53-25','c53-28','c53-30','c53-34','c53-37'],summary:v=>`Echo ${percent(v(454))} · reverb ${percent(v(379))}`},
 {id:'stereo',name:'Stereo',input:'Buy / sell balance → position · movement → autopan',indices:[408,433,434,435,436,407,409,503,501],summary:v=>`Position ${fmt(v(408))} / 2 · autopan ${state(v(407)||v(503))}`},
];
function state(v){return v==null?'—':v?'on':'off';}
function percent(v){return v==null?'—':Math.round(v*100)+'%';}
// A read-only explanation of the existing engine. No controls are sent to Pd.
export function createEnvionSimpleView({visible=true}={}){
 const root=text('section','envion-simple');root.setAttribute('aria-label','ENVION signal flow');
 const flow=text('p','envion-simple-flow','Market → material + timing → layers + effects → stereo output');
 const source=text('section','envion-simple-source');source.append(text('h3','','Source material'));
 const sourceName=text('strong','','Waiting for the instrument'),sourceNote=text('small','','Bundled samples load automatically');
 source.append(sourceName,sourceNote);
 const materialDetails=text('details','envion-simple-material'),materialSummary=text('summary','','Selected files'),materialList=text('dl','');materialDetails.append(materialSummary,materialList);source.append(materialDetails);
 const market=text('details','envion-simple-market'),marketTitle=text('summary','','Market clock · waiting for data'),marketList=text('dl','');market.append(marketTitle,text('p','envion-simple-explanation','Signal strength is normalized from 0 to 1. Missing history is shown as —.'),marketList);
 const grid=text('div','envion-simple-grid'),received=new Map(),outputs=new Map(),triggers=new Map(),cards=[];
 const mappings=new Map(ENVION_CONTROLS.map(([id,name,input,formula])=>['c0-'+id,{name,input,formula}]));
 mappings.set('c0-26',{name:'Random-speed bus (unused)',input:'Retained source bus; no sound receiver in this version'});
 for(const [id,name] of Object.entries(CHANCE_LABELS))if(!mappings.has(id))mappings.set(id,{name,input:'Market-weighted chance'});
 for(const group of GROUPS){
  const card=text('details','envion-simple-card');card.dataset.group=group.id;
  const head=text('summary',''),name=text('span','envion-simple-name',group.name),reading=text('output','envion-simple-reading','—');head.append(name,reading);
  const explanation=text('p','envion-simple-explanation',group.input),list=text('dl','envion-simple-values');
  for(const id of [...group.indices.map(id=>'c0-'+id),...(group.extra||[])]){
   const mapping=mappings.get(id);if(!mapping)continue;
   const term=text('dt','',mapping.name),value=text('dd','','—');term.title=[mapping.input,mapping.formula].filter(Boolean).join(' · ');
   list.append(term,value);outputs.set('av-envion-value-'+id,value);
  }
  card.append(head,explanation,list);cards.push({group,reading});grid.append(card);
 }
 const output=text('section','envion-simple-output'),meter=text('meter','');meter.min=0;meter.max=1;meter.value=0;meter.setAttribute('aria-label','ENVION stereo signal level before master volume');
 const outputLabel=text('span','','Stereo output'),outputValue=text('output','','Silent');output.append(outputLabel,meter,outputValue);
 root.append(flow,market,source,grid,output);
 let running=false,latestPerformance=null,lastPaint=-Infinity,lastScopePaint=-Infinity,dirty=true,paintTimer=null;
 const marketOutputs=new Map(),materialOutputs=new Map();
 for(const label of ['Activity','Movement','Volume','Liquidity','Buy share']){const value=text('dd','','—');marketList.append(text('dt','',label),value);marketOutputs.set(label,value);}
 for(const label of ['Preset','Sample','Envelope bank','Tape','Reverb impulse']){const value=text('dd','','—');materialList.append(text('dt','',label),value);materialOutputs.set(label,value);}
 function refresh(force=false){
  if(!visible||!dirty)return;const now=performance.now();if(!force&&now-lastPaint<200){paintTimer??=setTimeout(()=>{paintTimer=null;refresh(true);},200-(now-lastPaint));return;}if(paintTimer){clearTimeout(paintTimer);paintTimer=null;}lastPaint=now;dirty=false;
  for(const [receiver,node] of outputs)setText(node,fmt(received.get(receiver)));
  for(const {group,reading} of cards)setText(reading,group.summary(id=>received.get('av-envion-value-c0-'+id)));
  if(!running){meter.value=0;setText(outputValue,'Paused');}
  if(!latestPerformance){setText(sourceName,'Waiting for the instrument');setText(sourceNote,'Bundled samples load automatically');setText(marketTitle,'Market clock · waiting for data');for(const node of [...marketOutputs.values(),...materialOutputs.values()])setText(node,'—');}
  if(latestPerformance){
   const {active,loading,details}=latestPerformance;
   setText(sourceName,active||'Default preset · bundled sample');
   setText(sourceNote,loading?'Loading next material…':details.plan?`Phrase ${details.plan.turn} · envelope row ${details.row+1} · density ${details.plan.density}`:'Bundled samples load automatically');
   if(details.market){const m=envionFrame(details.market,details.tempo);setText(marketTitle,`Market clock · ${fmt(m.tempo)} BPM`);for(const [label,key] of [['Activity','activity'],['Movement','motion'],['Volume','volume'],['Liquidity','liquidity'],['Buy share','balance']])setText(marketOutputs.get(label),m.availability[key]===false?'—':fmt(m[key]));}
   const material=details.plan?.material;
   for(const [label,value] of [['Preset',material?.preset?.name],['Sample',file(material?.sample)],['Envelope bank',file(material?.bank?.path)],['Tape',file(material?.tape)],['Reverb impulse',file(material?.ir)]])setText(materialOutputs.get(label),value||'—');
   setText(materialSummary,loading?'Next material · loading':'Selected files');
  }
 }
 return {element:root,
  receive(receiver,data){if(!outputs.has(receiver))return;const raw=data[0]==='set'?data[1]:data[0];let value;if(raw==null||raw==='bang'){const count=(triggers.get(receiver)||0)+1;triggers.set(receiver,count);value='Trigger '+count;}else value=finite(raw)??String(raw);if(received.get(receiver)!==value){received.set(receiver,value);dirty=true;}},
  refresh,
  setPerformance(active,loading,details={}){latestPerformance={active,loading,details};dirty=true;refresh();},
  setVisible(value){visible=!!value;if(!visible&&paintTimer){clearTimeout(paintTimer);paintTimer=null;}dirty=true;refresh(true);},
  setRunning(value){running=!!value;if(!running&&visible){meter.value=0;setText(outputValue,'Paused');}},
  setScopes(data){if(!visible||!running||performance.now()-lastScopePaint<100)return;const channels=data['c0-1114'];if(!channels)return;lastScopePaint=performance.now();let square=0,count=0;for(const channel of channels)for(const value of channel){square+=value*value;count++;}const rms=Math.sqrt(square/Math.max(1,count));meter.value=Math.min(1,rms);setText(outputValue,rms>1e-6?Math.round(20*Math.log10(rms))+' dBFS':'Silent');},
  destroy(){if(paintTimer)clearTimeout(paintTimer);},
  reset(){if(paintTimer){clearTimeout(paintTimer);paintTimer=null;}received.clear();triggers.clear();latestPerformance=null;lastPaint=-Infinity;dirty=true;if(!visible)return;setText(marketTitle,'Market clock · waiting for data');for(const node of [...marketOutputs.values(),...materialOutputs.values()])setText(node,'—');refresh(true);setText(sourceName,'Waiting for the instrument');setText(sourceNote,'Bundled samples load automatically');meter.value=0;setText(outputValue,running?'Silent':'Paused');},
 };
}
