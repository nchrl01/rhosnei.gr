import React,{useEffect,useMemo,useRef,useState} from 'react';
import {keccak256,stringToHex} from 'viem';
import {type ArtworkInput,type MarketFrame,ENGINE_VERSION,CHAINS} from '@upic/domain';
import {api,errorText} from './api';
import {useArtworkPlayback} from './useArtworkPlayback';

interface Discovery {chain:MarketFrame['chain'];token:string;name:string;symbol:string;frame:MarketFrame}
const amount=(value:unknown)=>value===null||(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0);
function validDiscovery(value:any):value is Discovery {
 return !!value&&CHAINS.some(chain=>chain.id===value.chain)&&typeof value.token==='string'&&typeof value.name==='string'&&typeof value.symbol==='string'&&value.frame?.chain===value.chain&&value.frame?.token===value.token&&Number.isFinite(value.frame.at)&&value.frame.at>0&&typeof value.frame.source==='string'&&typeof value.frame.stale==='boolean'&&typeof value.frame.simulated==='boolean'&&['priceUsd','marketCapUsd','liquidityUsd','volumeUsd'].every(key=>amount(value.frame[key]));
}
const chainName=(id:string)=>CHAINS.find(chain=>chain.id===id)?.name??id;

/** Discovery remains a cached, non-minting audition; continuous feeds belong to collections. */
export function ExplorePreview({initialQuery=''}:{initialQuery?:string}){
 const [query,setQuery]=useState(initialQuery),[rows,setRows]=useState<Discovery[]>([]),[chosen,setChosen]=useState<Discovery>(),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false),[failed,setFailed]=useState(false);
 const request=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);
 async function search(){
  const text=query.trim();if(text.length<2||busy)return;
  const owner=++request.current;setBusy(true);setNote('');setFailed(false);setChosen(undefined);setRows([]);
  try{
   const response=await api<unknown>('/v1/discover?q='+encodeURIComponent(text));
   if(!mounted.current||owner!==request.current)return;
   if(!Array.isArray(response))throw Error('The search service returned an unreadable result.');
   const results=[...new Map(response.filter(validDiscovery).map(row=>[row.chain+':'+row.token,row])).values()];
   setRows(results);setSearched(true);setNote(results.length?`${results.length} ${results.length===1?'result':'results'}. Choose a token to audition its cached observation.`:'No supported market data was found. Try the full contract address, a token symbol, or another network’s token.');
  }catch(cause){if(mounted.current&&owner===request.current){setSearched(true);setFailed(true);setNote('Search could not finish: '+errorText(cause)+' You can try again.');}}
  finally{if(mounted.current&&owner===request.current)setBusy(false);}
 }
 return <section className="explore-preview">
  <h2>Try an artwork</h2>
  <p>Search for a token, choose a result, then play a 20-second sample. This preview does not mint or connect your wallet.</p>
  <form onSubmit={event=>{event.preventDefault();void search();}}>
   <label htmlFor="preview-token-search">Token name or contract address</label>
   <div className="player-controls"><input id="preview-token-search" aria-describedby="preview-search-hint" value={query} maxLength={120} onChange={event=>setQuery(event.target.value)} placeholder="For example: ETH or a full contract address" autoComplete="off" spellCheck={false}/><button disabled={busy||query.trim().length<2}>{busy?'Searching…':'Search'}</button></div>
  </form>
  <p id="preview-search-hint" className="player-hint">Search uses observations cached for up to five minutes. Provider coverage varies by token and network.</p>
  <details><summary>Which networks can I preview?</summary><p>{CHAINS.map(chain=>chain.name).join(' · ')}.</p><p>A preview does not mean a token is ready for collection creation. That requires the separate verification and testnet steps shown in Explore.</p></details>
  {(note||busy)&&<p role={failed?'alert':'status'}>{busy?'Looking for market observations…':note}</p>}
  <div className="grid preview-results" aria-label="Token search results">{rows.map(row=><button className="card" key={row.chain+':'+row.token} aria-pressed={chosen?.chain===row.chain&&chosen?.token===row.token} onClick={()=>setChosen(row)}><strong>{row.name} · {row.symbol}</strong><span>{chainName(row.chain)}</span><span className="contract-address">{row.token}</span><span>Preview this token →</span></button>)}</div>
  {searched&&!busy&&!failed&&!rows.length&&<p className="player-hint">No artwork is generated from missing data.</p>}
  {chosen&&<Preview key={chosen.chain+':'+chosen.token} row={chosen} close={()=>setChosen(undefined)}/>}
 </section>;
}
function Preview({row,close}:{row:Discovery;close:()=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),[volume,setVolume]=useState(.5);
 const input=useMemo<ArtworkInput>(()=>({seed:keccak256(stringToHex('preview:'+row.chain+':'+row.token)),stage:2,engineVersion:ENGINE_VERSION,seconds:20,frames:[row.frame]}),[row]);
 const playback=useArtworkPlayback(canvas,input,()=>({input}),volume);
 const unavailable=row.frame.stale||row.frame.volumeUsd===null;
 return <div className="player-panel">
  <div className="player-meta"><h3>{row.name} <span>· {row.symbol}</span></h3><span className="status-pill">Cached preview</span><button onClick={close} aria-label="Close token preview">Close preview</button></div>
  <canvas width={720} height={720} ref={canvas} className="artwork" aria-label={'Generated preview for '+row.name}/>
  <div className="player-controls"><button onClick={()=>{if(playback.playing||playback.preparing)playback.pause();else void playback.play();}}>{playback.preparing?'Cancel preparation':playback.playing?'Pause':'Play 20-second preview'}</button><label>Volume <input aria-label="Preview volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><span>{Math.round(volume*100)}%</span></label></div>
  <p role="status" className="player-hint">{playback.preparing?'Preparing the Game Boy phrase…':playback.playing?'Playing a fixed observation. The preview stops after 20 seconds.':playback.completed?'Preview finished. Play it again, or choose another token.':'Ready to audition. Sound starts only when you press Play.'}</p>
  {playback.error&&<p role="alert">Preview could not start: {playback.error} Try Play again.</p>}
  {unavailable&&<p className="player-hint">{row.frame.stale?'This observation is marked stale. Music may remain silent until a fresh observation becomes available.':'Trading volume is missing from this observation. Some musical layers may stay silent.'}</p>}
  <details><summary>How is this different from an edition?</summary><p>This is a sample at stage 2 (Pulse), using a preview seed and {ENGINE_VERSION}. It is not a minted edition and does not subscribe to a continuous trade feed.</p><p>Minted editions keep their own seed and unlock layers as their collection evolves. Their preserved media stays available independently of the current player.</p><p>Observation received: {new Date(row.frame.at).toLocaleString()}. {row.frame.simulated?'Marked as simulated test data.':''}</p></details>
 </div>;
}
