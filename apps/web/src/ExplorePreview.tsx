import React,{useEffect,useRef,useState} from 'react';
import {keccak256,stringToHex} from 'viem';
import {type ArtworkInput,type MarketFrame,ENGINE_VERSION,CHAINS} from '@upic/domain';
import {draw,schedule} from '@upic/engine';
import {api,errorText} from './api';
interface Discovery {chain:MarketFrame['chain'];token:string;name:string;symbol:string;frame:MarketFrame}
// A cached observation drives a local preview; there is no live trade subscription.
export function ExplorePreview(){
 const [query,setQuery]=useState(''),[rows,setRows]=useState<Discovery[]>([]),[chosen,setChosen]=useState<Discovery>(),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 async function search(){setBusy(true);try{setRows(await api<Discovery[]>('/v1/discover?q='+encodeURIComponent(query.trim())));setNote('');}catch(e){setNote(errorText(e));}finally{setBusy(false);}}
 return <section><h2>Try an artwork</h2><p>Search uses a shared five-minute cache. The preview loops on your device; continuous feeds are reserved for minted collections.</p><p>{CHAINS.map(c=>c.name).join(' · ')}. Results depend on provider coverage.</p><form onSubmit={e=>{e.preventDefault();void search();}}><input aria-label="Token name or address" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} placeholder="Token name or contract address"/><button disabled={busy||query.trim().length<2}>Search</button></form><p role="status">{note}</p><div className="grid">{rows.map(r=><button className="card" key={r.chain+':'+r.token} onClick={()=>setChosen(r)}><strong>{r.name} · {r.symbol}</strong><span>{r.chain} · {r.token}</span></button>)}</div>{chosen&&<Preview key={chosen.chain+chosen.token} row={chosen}/>}</section>;
}
function Preview({row}:{row:Discovery}){
 const canvas=useRef<HTMLCanvasElement>(null),audio=useRef<AudioContext|undefined>(undefined),stop=useRef<(()=>void)|undefined>(undefined);
 const [playing,setPlaying]=useState(false),[error,setError]=useState('');
 const input=useRef<ArtworkInput>({seed:keccak256(stringToHex('preview:'+row.chain+':'+row.token)),stage:2,engineVersion:ENGINE_VERSION,seconds:20,frames:[row.frame]});
 useEffect(()=>{let animation=0;const start=performance.now();function frame(){if(canvas.current)draw(canvas.current,input.current,(performance.now()-start)/1000%20);animation=requestAnimationFrame(frame);}frame();return()=>cancelAnimationFrame(animation);},[]);
 useEffect(()=>()=>{stop.current?.();void audio.current?.close();},[]);
 async function toggle(){if(playing){stop.current?.();setPlaying(false);return;}audio.current??=new AudioContext();await audio.current.resume();stop.current=await schedule(audio.current,input.current,'',audio.current.currentTime+.03);setPlaying(true);window.setTimeout(()=>setPlaying(false),20000);}
 return <div><h3>{row.name}</h3><canvas width={720} height={720} ref={canvas} className="artwork"/><p>Demonstration · sample stage 2 · cached market input · preview seed differs from the minted NFT.</p><button onClick={()=>toggle().catch(e=>setError(errorText(e)))}>{playing?'Pause':'Play 20-second preview'}</button><p>{error}</p></div>;
}
