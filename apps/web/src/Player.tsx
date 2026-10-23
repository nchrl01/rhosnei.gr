import React,{useEffect,useMemo,useRef,useState} from 'react';
import {type Edition,type Collection,type ArtworkInput,type MarketFrame,type Candle,type Trade,ENGINE_VERSION,STAGES} from '@upic/domain';
import {API,api,errorText,type Config} from './api';
import {useArtworkPlayback,type PlaybackPlan} from './useArtworkPlayback';

const decimal=(value:unknown):value is string=>typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
const nullableDecimal=(value:unknown)=>value===null||decimal(value);
const validFrame=(value:any):value is MarketFrame=>!!value&&Number.isFinite(value.at)&&value.at>0&&typeof value.chain==='string'&&typeof value.token==='string'&&typeof value.source==='string'&&['priceUsd','marketCapUsd','liquidityUsd','volumeUsd'].every(key=>nullableDecimal(value[key]))&&typeof value.stale==='boolean'&&typeof value.simulated==='boolean';
const validTrade=(value:any):value is Trade=>!!value&&typeof value.id==='string'&&Number.isFinite(value.at)&&value.at>0&&decimal(value.priceUsd)&&decimal(value.volumeUsd)&&(value.side==='buy'||value.side==='sell')&&typeof value.tx==='string';
const validCandle=(value:any):value is Candle=>!!value&&value.complete===true&&Number.isFinite(value.time)&&value.time>0&&['open','high','low','close'].every(key=>decimal(value[key]))&&nullableDecimal(value.volume);
const feedMessage=(state:string)=>({
 'playback-capacity':'Live feed is busy. The last received observation is still available; try Play again shortly.',
 'snapshot-delayed':'Market snapshots are delayed. No missing activity is being invented.',
 'playback-delayed':'Trade updates are delayed. The last received observation is still available.'
}[state]||'The live provider is temporarily unavailable. Playback will use the observations already received.');

export function Player({edition,collection,config}:{edition:Edition;collection:Collection|undefined;config:Config}){
 const canvas=useRef<HTMLCanvasElement>(null),socket=useRef<WebSocket|undefined>(undefined),observations=useRef<MarketFrame[]>([]),frameRef=useRef<MarketFrame|undefined>(undefined);
 const [frame,setFrame]=useState<MarketFrame>(),[feedStatus,setFeedStatus]=useState('Connecting to the collection feed…'),[bars,setBars]=useState<Candle[]>([]);
 const [mode,setMode]=useState<'live'|'history'>('live'),[position,setPosition]=useState(0),[volume,setVolume]=useState(.5),[historyBusy,setHistoryBusy]=useState(false),[notice,setNotice]=useState('');
 const modeRef=useRef(mode),positionRef=useRef(position),barsRef=useRef(bars),historyRequest=useRef(0);
 modeRef.current=mode;positionRef.current=position;barsRef.current=bars;
 const stage=collection?.stage??edition.stage;
 const empty=useMemo<MarketFrame>(()=>({chain:collection?.chain??'ethereum',token:collection?.token??'',at:0,priceUsd:null,marketCapUsd:null,liquidityUsd:null,volumeUsd:null,source:'no-observation',stale:true,simulated:false}),[collection?.chain,collection?.token]);
 const makeInput=(frames:MarketFrame[]):ArtworkInput=>({seed:edition.seed,stage,engineVersion:ENGINE_VERSION,seconds:20,frames});
 const historyInput=(start:number)=>{
  const selected=barsRef.current.slice(start,start+4),anchor=selected[0]?.time??0;
  // Candle prices and volume are observed; only their playback spacing is compressed.
  // Historical market cap, liquidity and holders are unavailable and remain absent.
  return makeInput(selected.length?selected.map((bar,index)=>({chain:empty.chain,token:empty.token,at:anchor+index*5000,priceUsd:bar.close,marketCapUsd:null,liquidityUsd:null,volumeUsd:bar.volume??null,source:'historical-candle-reconstruction',stale:false,simulated:false})):[empty]);
 };
 const idle=useMemo(()=>mode==='history'?historyInput(position):makeInput([frame??empty]),[mode,position,bars,frame,empty,stage,edition.seed]);
 const playback=useArtworkPlayback(canvas,idle,():PlaybackPlan=>{
  if(modeRef.current==='history'){
   const start=positionRef.current,count=Math.min(4,barsRef.current.length-start);
   return {input:historyInput(start),seconds:Math.max(1,count)*5,onProgress:seconds=>{
    const next=Math.min(start+Math.floor(seconds/5),start+count-1);
    if(next>=0&&next!==positionRef.current){positionRef.current=next;setPosition(next);}
   },onEnd:()=>{
    const next=start+count;
    if(next<barsRef.current.length){positionRef.current=next;setPosition(next);return true;}
    modeRef.current='live';setMode('live');setNotice('History finished. Continuing with the collection feed; new observations enter at the next phrase.');return true;
   }};
  }
  const latest=frameRef.current;
  const recent=latest?observations.current.filter(row=>row.at>=latest.at-15000).slice(-4):[];
  const frames=(recent.length?recent:[latest??empty]).map(row=>({...row,stale:row.stale||Date.now()-row.at>30000}));
  return {input:makeInput(frames),onEnd:()=>true};
 },volume);
 const playbackState=useRef({active:false,historical:false});playbackState.current={active:playback.playing||playback.preparing,historical:mode==='history'};
 useEffect(()=>{
  observations.current=[];frameRef.current=undefined;setFrame(undefined);
  if(!collection){setFeedStatus('Collection feed is unavailable. Preserved media is available below.');return;}
  let disposed=false,retry:number|undefined,attempt=0;
  const receive=(next:MarketFrame)=>{
   frameRef.current=next;setFrame(next);
   observations.current=[...observations.current.filter(row=>row.at!==next.at),next].sort((a,b)=>a.at-b.at).slice(-12);
  };
  const connect=()=>{
   if(disposed)return;
   setFeedStatus(attempt?'Reconnecting to the collection feed…':'Connecting to the collection feed…');
   let ws:WebSocket;
   try{const url=new URL(API,location.origin);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/v1/stream/'+encodeURIComponent(collection.asset_key);url.search='';url.hash='';ws=new WebSocket(url);socket.current=ws;}
   catch{setFeedStatus('The collection feed could not connect.');retry=window.setTimeout(connect,Math.min(30000,2000*2**Math.min(attempt++,4)));return;}
   ws.onopen=()=>{if(disposed)return;attempt=0;setFeedStatus('Connected · waiting for a market observation');ws.send(JSON.stringify({type:playbackState.current.active&&!playbackState.current.historical?'play':'pause'}));};
   ws.onmessage=event=>{
    if(disposed||typeof event.data!=='string')return;
    let message:any;try{message=JSON.parse(event.data);}catch{return;}
    if(message?.type==='frame'&&validFrame(message.frame)&&message.frame.chain===collection.chain&&message.frame.token.toLowerCase()===collection.token.toLowerCase()){
     const next={...message.frame,trades:Array.isArray(message.frame.trades)?message.frame.trades.filter(validTrade):undefined};receive(next);setFeedStatus(next.stale?'Cached observation · waiting for fresh data':'Live market snapshots');
    }else if(message?.type==='status'&&typeof message.state==='string'){setFeedStatus(feedMessage(message.state));}
    else if(message?.type==='trades'&&Array.isArray(message.trades)){
     const fresh:Trade[]=message.trades.filter(validTrade),now=Date.now();
     const previous=frameRef.current,unique=new Map<string,Trade>();
     for(const trade of [...(previous?.trades??[]),...fresh])if(trade.at>=now-30000&&trade.at<=now+5000)unique.set(trade.id,trade);
     const trades=[...unique.values()].sort((a,b)=>a.at-b.at),latest=trades.at(-1);
     if(previous||latest)receive({...(previous??empty),chain:collection.chain,token:collection.token,at:latest?.at??previous!.at,priceUsd:latest?.priceUsd??previous!.priceUsd,trades,source:latest?'live-trades':previous!.source,stale:latest?false:previous!.stale});
     setFeedStatus(message.incomplete?'Live trades · provider reported a gap':'Live trades · updates arrive about every five seconds');
    }
   };
   ws.onerror=()=>{if(!disposed)setFeedStatus('Connection interrupted. Reconnecting automatically…');};
   ws.onclose=()=>{if(disposed)return;if(socket.current===ws)socket.current=undefined;setFeedStatus('Connection interrupted. Reconnecting automatically…');retry=window.setTimeout(connect,Math.min(30000,2000*2**Math.min(attempt++,4)));};
  };
  connect();
  // The coordinator accepts play/pause JSON only; a raw ping would close the connection.
  return()=>{disposed=true;window.clearTimeout(retry);socket.current?.close();socket.current=undefined;historyRequest.current++;};
 },[collection?.asset_key,empty]);
 useEffect(()=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:(playback.playing||playback.preparing)&&mode==='live'?'play':'pause'}));},[playback.playing,playback.preparing,mode]);
 async function historyMode(){
  if(!collection||historyBusy)return;
  const request=++historyRequest.current;setHistoryBusy(true);setNotice('');
  try{
   const response=await api<unknown>('/v1/history/'+encodeURIComponent(collection.asset_key));
   if(request!==historyRequest.current)return;
   const rows=Array.isArray(response)?[...new Map(response.filter(validCandle).map(bar=>[bar.time,bar])).values()].sort((a,b)=>a.time-b.time):[];
   if(!rows.length){setNotice('No completed historical candles are available for this collection yet. Try again later or continue with the live feed.');return;}
   playback.pause();barsRef.current=rows;setBars(rows);positionRef.current=0;setPosition(0);modeRef.current='history';setMode('history');
   setNotice('History is ready. Choose a point, then press Play history. Each candle plays for five seconds; playback continues into the live feed at the end.');
  }catch(cause){if(request===historyRequest.current)setNotice('History could not load: '+errorText(cause));}
  finally{if(request===historyRequest.current)setHistoryBusy(false);}
 }
 const returnLive=()=>{playback.pause();modeRef.current='live';setMode('live');setNotice('Live feed selected. Press Play to use the newest available observations.');};
 const seek=(next:number)=>{playback.pause();positionRef.current=next;setPosition(next);setNotice('Playback point selected. Press Play history to continue from here.');};
 const currentBar=bars[position],observedAt=frame?.at?new Date(frame.at).toLocaleString():null;
 const media=(uri:string)=>uri.startsWith('ipfs://')?config.gateway.replace(/\/$/,'')+'/ipfs/'+uri.slice(7):/^https?:\/\//.test(uri)?uri:'';
 return <div className="player-panel">
  <div className="player-meta"><span className="status-pill">{mode==='history'?'History reconstruction':'Collection feed'}</span><span>{STAGES[stage]} · {ENGINE_VERSION}</span></div>
  <canvas ref={canvas} width={720} height={720} className="artwork" aria-label="Edition artwork generated from the selected market observations"/>
  <div className="player-controls">
   <button onClick={()=>{if(playback.playing||playback.preparing)playback.pause();else void playback.play();}}>{playback.preparing?'Cancel preparation':playback.playing?'Pause':mode==='history'?'Play history':'Play sound and artwork'}</button>
   <label>Volume <input aria-label="Artwork volume" type="range" min="0" max="1" step=".01" value={volume} onChange={event=>setVolume(Number(event.target.value))}/><span>{Math.round(volume*100)}%</span></label>
  </div>
  <p className="player-hint" role="status">{playback.preparing?'Preparing the next Game Boy phrase…':mode==='history'?'Historical candles · five seconds per candle':feedStatus}</p>
  {playback.error&&<p role="alert">Playback could not start: {playback.error} Try Play again.</p>}
  <div className="player-controls"><button disabled={!collection||historyBusy} onClick={()=>void historyMode()}>{historyBusy?'Loading history…':'Choose historical playback'}</button>{mode==='history'&&<button onClick={returnLive}>Return to collection feed</button>}</div>
  {mode==='history'&&<div className="player-timeline"><label htmlFor="edition-history-position">Historical candle {position+1} of {bars.length}</label><input id="edition-history-position" type="range" min="0" max={Math.max(0,bars.length-1)} value={position} onChange={event=>seek(Number(event.target.value))}/><p>{currentBar&&new Date(currentBar.time).toLocaleString()}</p></div>}
  {notice&&<p role="status" className="player-hint">{notice}</p>}
  <details><summary>What am I hearing and seeing?</summary>
   <p>This is a new performance with this edition’s original seed, its current unlocked stage, and the current engine. It does not replace the preserved artwork or change the edition.</p>
   <p>{mode==='history'?'History uses recorded candle prices and volume at an accelerated pace. Historical market cap, liquidity, holders and individual trades are not supplied; those controls stay neutral.':'The collection feed is sampled into 20-second phrases. Each new phrase uses the latest observations received; missing or stale activity makes the music sparse or silent.'}</p>
   <p>Stage unlocks still apply: early editions may have fewer layers. The artwork can keep a quiet visual presence when there is no fresh trading activity.</p>
   {observedAt&&<p>Last received observation: {observedAt}. {frame?.simulated?'This observation is marked as simulated test data.':''}</p>}
   {media(edition.animation_url)&&<p><a href={media(edition.animation_url)} target="_blank" rel="noreferrer">Open preserved audiovisual media ↗</a> to experience the archived version.</p>}
  </details>
 </div>;
}
