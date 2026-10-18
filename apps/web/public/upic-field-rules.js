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
  const marketCap=finite(inputs.marketCap)&&inputs.marketCap>0?inputs.marketCap:1e6;
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
  const zoomProgress=smoothstep(Math.log10(marketCap/3000)/Math.log10(1e10/3000));
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
  const edgeShrink=(.02+.46*(1-capDepth**2))*(1-.35*midCapOpening)*(1-fieldRelease);
  const edgePower=1+3*(1-capDepth)**2;
  const emergence=clamp(Math.log10(marketCap)/Math.log10(50e6),0,1);
  const fieldSpan=.02+.98*emergence**4+.9*midCapOpening*(1-emergence);
  const liquidityDepth=clamp(Math.log10(1+liquidity/1000)/4,0,1);
  const balances=normalizeHolderBalances(inputs.holderBalances);
  // Balances and liquidity are USD. A fourth-root response softens size differences
  // from holding / liquidity, without sample-mean normalization.
  // 1% -> 8px, 4% -> about 11px; cap at 20px. Layout applies raster floors,
  // edge shrink and the minimum clear gap after this calculation.
  const liquidityShares=balances.map(h=>liquidity>0?h.balance/liquidity:null);
  const markDiameters=balances.length
    ?liquidityShares.map(share=>share===null?0:Math.min(20,8*Math.pow(share/.01,.25)))
    :[liquidity>0?1:0];
  const baseMarkSize=markDiameters.reduce((sum,v)=>sum+v,0)/markDiameters.length;
  const footprintScale=1;
  const holderStatus=liquidity===0?'No liquidity — ratio unavailable; minimum-size dots'
    :balances.length?balances.length+(inputs.holderSource==='simulated'?' simulated USD holdings':' supplied USD holdings')+' · softened dot sizes from % of liquidity'
    :'No USD holdings supplied — minimum equal marks';
  return {canvasSize,dotBudget,zoomScale,gapPx,edgeShrink,edgePower,fieldSpan,fieldRelease,baseMarkSize,markDiameters,footprintScale,
    holderCount:balances.length,holderStatus,liquidityShares,
    capDepth,liquidityDepth,balances};
}

function smoothstep(value){const t=clamp(value,0,1);return t*t*(3-2*t);}
function hash(text){let value=2166136261;for(const c of text)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;}

/** One positive USD holding per cell. Market cap sets viewing scale;
 * holding / liquidity sets size. No holder is repeated or collision-culled.
 */
export function buildMarkLayout(inputs,settings={},width=512,height=512){
  const rules=deriveFieldRules(inputs),zoom=rules.zoomScale;
  const shape=settings.mode==='monogrid'?'square':settings.mark||'auto';
  const directional=shape==='plus'||shape==='cross'||(shape==='auto'&&inputs.change!==0);
  const minimum=directional?3:1;
  const rasterSize=size=>Math.max(minimum,2*Math.floor(Math.max(0,size-1)/2)+1);
  const count=rules.balances.length;
  if(!count)return {marks:[],rules:{...rules,allocatedDots:0}};
  const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns);
  const fitPitch=Math.floor(Math.min((width-1)/columns,(height-1)/rows));
  const desiredGap=Math.ceil(rules.gapPx*zoom);
  const referenceScale=Math.min(width,height)/512;
  // Intrinsic size comes only from holding / liquidity. Apply the same
  // camera zoom to marks and cell spacing, with no cap-driven growth phase.
  const sizes=rules.markDiameters.map(size=>size*referenceScale*zoom);
  const largest=Math.max(...sizes);
  // Regular cell pitch follows liquidity spacing, independently of holder sizes.
  const desiredPitch=Math.ceil(16*referenceScale*zoom+desiredGap);
  const pitch=Math.min(fitPitch,desiredPitch);
  // At dense populations scale the gap into the cell, never delete a holder.
  const gap=Math.min(desiredGap,Math.max(0,pitch-3));
  // Fit mark bounds inside each cell, preserving a clear gap.
  const maxDiameter=2*Math.floor(Math.max(0,pitch-gap-1)/2)+1;
  const sizeScale=largest>0?Math.min(1,maxDiameter/largest):1;
  const startX=Math.floor((width-(columns-1)*pitch)/2)+.5;
  const startY=Math.floor((height-(rows-1)*pitch)/2)+.5;
  const cells=[];
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const dx=column-(columns-1)/2,dy=row-(rows-1)/2;
    const priority=hash(inputs.coinKey+':cell:'+row+':'+column);
    cells.push({x:startX+column*pitch,y:startY+row*pitch,row,column,priority,rank:dx*dx+dy*dy});
  }
  cells.sort((a,b)=>a.rank-b.rank||a.priority-b.priority);cells.length=count;
  const order=rules.balances.map((holder,i)=>({id:holder.id,size:sizes[i]}))
    .sort((a,b)=>hash(inputs.coinKey+':'+a.id)-hash(inputs.coinKey+':'+b.id)||a.id.localeCompare(b.id));
  const marks=cells.map((cell,i)=>{
    const holder=order[i],normalDiameter=rasterSize(holder.size);
    const diameter=Math.min(maxDiameter,rasterSize(holder.size*sizeScale));
    return {...cell,diameter,normalDiameter,id:holder.id};
  });
  return {marks,rules:{...rules,cellPitch:pitch,cellDiameterLimit:maxDiameter,layoutGap:gap,sizeScale,allocatedDots:count}};
}
