// Shared rules for this local study. Balances are either supplied snapshots
// or an explicitly labeled simulation, never random size variation inside
// the renderer. All sizes are raster pixels.
export const MAX_HOLDER_BALANCES=10000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const decimal=/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

export function normalizeHolderBalances(value){
  if(!Array.isArray(value)||value.length>MAX_HOLDER_BALANCES)return [];
  const result=[],ids=new Set();
  for(let i=0;i<value.length;i++){
    const record=value[i],balance=typeof record==='number'?record:record?.balance;
    const id=typeof record?.id==='string'?record.id.trim():String(i+1);
    if(!finite(balance)||balance<0||!id||id.length>512||ids.has(id))return [];
    ids.add(id);
    if(balance>0)result.push({id,balance});
  }
  return result;
}

export function parseHolderBalances(text){
  const source=String(text??'').trim();
  if(!source)return {balances:[],error:''};
  try{
    let rows;
    if(source.startsWith('[')){
      const values=JSON.parse(source);
      if(!Array.isArray(values))throw Error('Use a JSON array of balances or {id, balance} records.');
      rows=values.map((v,i)=>typeof v==='number'?{id:String(i+1),balance:v}:v);
    }else{
      let lines=source.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const hasHeader=/^(?:wallet|address|id)[,\t ]+balance$/i.test(lines[0]);
      if(hasHeader)lines=lines.slice(1);
      const numericList=!hasHeader&&lines.every(line=>line.split(/[\s,;]+/).every(v=>decimal.test(v)));
      if(numericList)rows=lines.join(' ').split(/[\s,;]+/).map((v,i)=>({id:String(i+1),balance:Number(v)}));
      else rows=lines.map((line,i)=>{
        const parts=line.split(/[,\t]/).map(s=>s.trim());
        if(parts.length!==2||!parts[0]||!decimal.test(parts[1]))throw Error('Line '+(i+1)+': use wallet,balance, or paste numbers without thousands separators.');
        return {id:parts[0],balance:Number(parts[1])};
      });
    }
    if(rows.length>MAX_HOLDER_BALANCES)throw Error('This local study accepts up to '+MAX_HOLDER_BALANCES+' balances. Nothing was applied.');
    const ids=new Set();
    rows=rows.map((row,i)=>{
      if(!row||typeof row!=='object')throw Error('Record '+(i+1)+': supply an id and a numeric balance.');
      const id=String(row.id??row.address??row.wallet??i+1).trim();
      const balance=typeof row.balance==='string'&&decimal.test(row.balance.trim())?Number(row.balance):row.balance;
      if(!finite(balance)||balance<0)throw Error('Record '+(i+1)+': balances must be finite, nonnegative numbers.');
      if(!id||id.length>512)throw Error('Record '+(i+1)+': use a nonempty holder identifier of up to 512 characters.');
      if(ids.has(id))throw Error('Duplicate holder identifier: '+id+'. Combine that holder’s balance into one row.');
      ids.add(id);return {id,balance};
    });
    return {balances:normalizeHolderBalances(rows),error:''};
  }catch(error){return {balances:[],error:error instanceof SyntaxError?'The JSON could not be read. Use an array of balances or {id, balance} records.':error.message};}
}

export function deriveFieldRules(inputs={}){
  const marketCap=Math.min(1e9,finite(inputs.marketCap)&&inputs.marketCap>0?inputs.marketCap:1);
  const liquidity=finite(inputs.liquidity)&&inputs.liquidity>=0?inputs.liquidity:0;
  // Calibration: liquidity $0..$10M for spacing, $1..$50M for gradual field
  // opening. Dot sizes use USD holdings as a share of liquidity.
  // These bounded ranges are separate from the permanent mapping directions.
  const capDepth=clamp((Math.log10(marketCap)-2)/7,0,1);
  // Lower liquidity tightens a regular grid; higher liquidity widens it.
  const gapPx=1+15*smoothstep(Math.log10(1+liquidity/1000)/4);
  // Keep the surface/image frame fixed. A separate spatial envelope gathers
  // low-cap marks near the centre without scaling image coordinates.
  const canvasSize=2048;
  const zoomProgress=smoothstep(Math.log10(marketCap/3000)/Math.log10(1e9/3000));
  const zoomScale=4-3*zoomProgress;
  const densityAnchors=[[1,1],[3000,32],[1e6,256],[1e7,1024],[5e7,2048],[1e9,4096],[1e10,10000]];
  let dotBudget=10000;
  for(let i=1;i<densityAnchors.length;i++){
    const [lo,a]=densityAnchors[i-1],[hi,b]=densityAnchors[i];
    if(marketCap<=hi){
      const t=clamp(Math.log(marketCap/lo)/Math.log(hi/lo),0,1);
      dotBudget=Math.max(1,Math.round(a*(b/a)**t));break;
    }
  }
  const fieldRelease=smoothstep(Math.log10(marketCap/1e7)/Math.log10(5));
  const midCapOpening=smoothstep(Math.log10(marketCap/1e4)/2);
  const openingAnchors=[[1,.002],[3000,.08],[20000,.22],[100000,.5],[1000000,1]];
  let fieldSpan=1;
  for(let i=1;i<openingAnchors.length;i++){
    const [lo,a]=openingAnchors[i-1],[hi,b]=openingAnchors[i];
    if(marketCap<=hi){
      const t=smoothstep(Math.log(Math.max(1,marketCap)/lo)/Math.log(hi/lo));
      fieldSpan=a+(b-a)*t;break;
    }
  }
  const edgeShrink=1-fieldSpan;
  const edgePower=1+3*(1-capDepth)**2;
  const emergence=clamp(Math.log10(marketCap)/Math.log10(50e6),0,1);
  // Field opening is monotonic and finishes at $1M.
  const liquidityDepth=clamp(Math.log10(1+liquidity/1000)/4,0,1);
  const balances=normalizeHolderBalances(inputs.holderBalances);
  // Balances and liquidity are USD. A fourth-root response softens size differences
  // from holding / liquidity, without sample-mean normalization.
  // 1% -> 8px, 4% -> about 11px; cap at 20px. Layout applies raster floors,
  // edge shrink and the minimum clear gap after this calculation.
  const liquidityShares=balances.map(h=>liquidity>0?h.balance/liquidity:null);
  // Absolute USD ceiling prevents tiny bags from looking dominant in thin liquidity.
  const markBrightness=liquidityShares.map((share,i)=>{
    const ratioBrightness=share===null?.01:Math.min(1,Math.max(.01,Math.sqrt(share/.01)));
    const dollarBrightness=Math.min(1,Math.max(.01,Math.pow(balances[i].balance/1e6,.25)));
    return Math.min(ratioBrightness,dollarBrightness);
  });
  const markDiameters=balances.length
    ?liquidityShares.map(share=>share===null?0:Math.min(20,8*Math.pow(share/.01,.25)))
    :[liquidity>0?1:0];
  const baseMarkSize=markDiameters.reduce((sum,v)=>sum+v,0)/markDiameters.length;
  const footprintScale=1;
  const holderStatus=liquidity===0?'No liquidity — ratio unavailable; minimum-size dots'
    :balances.length?balances.length+(inputs.holderSource==='simulated'?' simulated USD holdings':' supplied USD holdings')+' · softened dot sizes from % of liquidity'
    :'No USD holdings supplied — minimum equal marks';
  return {canvasSize,dotBudget,zoomScale,gapPx,edgeShrink,edgePower,fieldSpan,fieldRelease,baseMarkSize,markDiameters,markBrightness,footprintScale,
    holderCount:balances.length,holderStatus,liquidityShares,
    capDepth,liquidityDepth,balances};
}

function smoothstep(value){const t=clamp(value,0,1);return t*t*(3-2*t);}
function hash(text){let value=2166136261;for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;}

/** Regular Earthbound lattice: holdings change size/brightness, never positions. */
export function buildMarkLayout(inputs,settings={},width=512,height=512){
  const rules=deriveFieldRules(inputs),count=rules.balances.length;
  if(!count)return {marks:[],rules:{...rules,allocatedDots:0}};
  const zoom=rules.zoomScale,referenceScale=Math.min(width,height)/512;
  // Match the grid to the actual panel rather than centring a square inside it.
  const columns=Math.max(1,Math.min(count,Math.round(Math.sqrt(count*width/height)))),rows=Math.ceil(count/columns);
  const fieldWidth=width*rules.fieldSpan,fieldHeight=height*rules.fieldSpan;
  const pitchX=fieldWidth/columns,pitchY=fieldHeight/rows;
  const fitPitch=Math.min(pitchX,pitchY);
  const desiredGap=rules.gapPx*referenceScale*rules.fieldSpan;
  // Holder count sets a field-filling regular lattice, not a fixed pixel pitch.
  const pitch=fitPitch;
  // A lone holder has the whole field; all other holders share equal cells.
  const gap=count===1?0:Math.min(desiredGap,pitch*.25);
  const available=count===1?Math.min(fieldWidth,fieldHeight):Math.max(0,pitch-gap);
  const limit=available>=1?2*Math.floor((available-1)/2)+1:available;
  const startX=(width-(columns-1)*pitchX)/2;
  const startY=(height-(rows-1)*pitchY)/2;
  const cells=[];
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const dx=column-(columns-1)/2,dy=row-(rows-1)/2;
    cells.push({x:startX+column*pitchX,y:startY+row*pitchY,row,column,
      rank:dx*dx+dy*dy,priority:hash(inputs.coinKey+':cell:'+row+':'+column)});
  }
  cells.sort((a,b)=>a.rank-b.rank||a.priority-b.priority);cells.length=count;
  // Identity order is stable and independent of wealth: no whale strips.
  const holders=rules.balances.map((h,i)=>({...h,brightness:rules.markBrightness[i]}))
    .sort((a,b)=>hash(inputs.coinKey+':'+a.id)-hash(inputs.coinKey+':'+b.id)||a.id.localeCompare(b.id));
  // Address-derived edge contour: fixed in space, with no random flicker.
  // Only mark bounds/brightness taper; centres and clear gaps stay intact.
  const phase=n=>hash(inputs.coinKey+':edge:'+n)/4294967295*Math.PI*2;
  const phases=[phase(0),phase(1),phase(2),phase(3)];
  const edgeStrength=1-smoothstep(rules.fieldSpan);
  const marks=cells.map((cell,i)=>{
    const holder=holders[i];
    // Area ceiling scales with dollars: $1 is about one displayed pixel;
    // $1M unlocks the full field, subject to its cell and liquidity ratio.
    const dollarDiameter=Math.max(referenceScale,Math.min(width,height)*Math.sqrt(Math.min(1,holder.balance/1e6)));
    const raw=Math.min(limit*Math.sqrt(holder.brightness),dollarDiameter);
    // Keep small marks small even when their shape cannot resolve at this scale.
    const diameter=Math.min(limit,raw>=1?Math.max(1,2*Math.floor((raw-1)/2)+1):raw);
    const nx=(cell.x-width/2)/Math.max(1,fieldWidth/2);
    const ny=(cell.y-height/2)/Math.max(1,fieldHeight/2);
    const angle=Math.atan2(ny,nx),radius=Math.hypot(nx,ny);
    const boundary=.66+.14*Math.sin(3*angle+phases[0])
      +.10*Math.sin(5*angle+phases[1])+.06*Math.cos(7*angle+phases[2]);
    const unevenDistance=radius+.045*Math.sin(nx*11+ny*7+phases[3]);
    const edgeFade=count===1?1:1-smoothstep((unevenDistance-boundary+.14)/.32);
    const edgeScale=1-edgeStrength*(1-edgeFade);
    return {...cell,id:holder.id,diameter:diameter*edgeScale,normalDiameter:diameter,
      brightness:holder.brightness*edgeScale,edgeScale};
  });
  return {marks,rules:{...rules,layoutMode:'regular-holder-grid',cellPitch:pitch,cellDiameterLimit:limit,layoutGap:gap,sizeScale:1,allocatedDots:count}};
}
