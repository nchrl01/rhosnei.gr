import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import type {ArtworkInput} from '@upic/domain';
import {draw,schedule} from '@upic/engine';
import {errorText} from './api';

export interface PlaybackPlan {
 input:ArtworkInput;
 seconds?:number;
 onProgress?:(seconds:number)=>void;
 /** Return true to capture and play the next phrase. */
 onEnd?:()=>boolean;
}

/** Each captured phrase has its own muted-until-ready output and cancellation owner. */
export function useArtworkPlayback(canvas:RefObject<HTMLCanvasElement|null>,idle:ArtworkInput,plan:()=>PlaybackPlan,volume:number){
 const [playing,setPlaying]=useState(false),[preparing,setPreparing]=useState(false),[completed,setCompleted]=useState(false),[error,setError]=useState('');
 const context=useRef<AudioContext|undefined>(undefined),master=useRef<GainNode|undefined>(undefined),release=useRef<(()=>void)|undefined>(undefined),timer=useRef<number|undefined>(undefined),generation=useRef(0),mounted=useRef(true);
 const current=useRef<{plan:PlaybackPlan;start:number;seconds:number}|undefined>(undefined),last=useRef({input:idle,seconds:0});
 const latestPlan=useRef(plan);latestPlan.current=plan;
 const latestVolume=useRef(volume);latestVolume.current=volume;
 const clear=useCallback(()=>{
  generation.current++;window.clearTimeout(timer.current);timer.current=undefined;
  release.current?.();release.current=undefined;current.current=undefined;
 },[]);
 const pause=useCallback(()=>{clear();setPlaying(false);setPreparing(false);},[clear]);
 const play=useCallback(async()=>{
  clear();const owner=generation.current;
  setError('');setCompleted(false);setPreparing(true);setPlaying(false);
  try{
   context.current??=new AudioContext();const ctx=context.current;
   if(!master.current){master.current=ctx.createGain();master.current.gain.value=latestVolume.current;master.current.connect(ctx.destination);}
   await ctx.resume();if(!mounted.current||owner!==generation.current)return;
   const next=async():Promise<void>=>{
    if(!mounted.current||owner!==generation.current)return;
    const captured=latestPlan.current(),seconds=Math.max(.1,Math.min(20,captured.seconds??20));
    // Rendering can outlive a pause or seek. Its private output stays silent until ownership is checked.
    const output=ctx.createGain();output.gain.value=0;output.connect(master.current!);
    let stop:(()=>void)|undefined;
    try{const requestedStart=ctx.currentTime+.03;
     stop=await schedule(ctx,captured.input,import.meta.env.BASE_URL.replace(/\/$/,''),requestedStart,output,seconds);
     if(!mounted.current||owner!==generation.current){stop();output.disconnect();return;}
     const start=Math.max(requestedStart,ctx.currentTime);
     output.gain.setValueAtTime(1,ctx.currentTime);
     release.current=()=>{output.gain.value=0;stop?.();output.disconnect();};
     current.current={plan:captured,start,seconds};last.current={input:captured.input,seconds:0};
     setPreparing(false);setPlaying(true);
     const finish=()=>{
      if(!mounted.current||owner!==generation.current)return;
      const remaining=start+seconds-ctx.currentTime;
      if(remaining>.01){timer.current=window.setTimeout(finish,Math.max(100,remaining*1000));return;}
      captured.onProgress?.(seconds);last.current={input:captured.input,seconds};
      release.current?.();release.current=undefined;current.current=undefined;
      if(captured.onEnd?.()){setPreparing(true);void next().catch(fail);}else{setPlaying(false);setPreparing(false);setCompleted(true);}
     };
     timer.current=window.setTimeout(finish,seconds*1000+30);
    }catch(cause){stop?.();output.disconnect();throw cause;}
   };
   const fail=(cause:unknown)=>{if(mounted.current&&owner===generation.current){clear();setPlaying(false);setPreparing(false);setError(errorText(cause));}};
   await next();
  }catch(cause){if(mounted.current&&owner===generation.current){clear();setPlaying(false);setPreparing(false);setError(errorText(cause));}}
 },[clear]);
 useEffect(()=>{if(master.current&&context.current)master.current.gain.setTargetAtTime(volume,context.current.currentTime,.03);},[volume]);
 useEffect(()=>{if(!current.current)last.current={input:idle,seconds:0};},[idle]);
 useEffect(()=>{
  mounted.current=true;let animation=0;let drawnInput:ArtworkInput|undefined,drawnSeconds=-1;
  const render=()=>{
   const active=current.current;
   if(active&&context.current){const seconds=Math.max(0,Math.min(active.seconds,context.current.currentTime-active.start));last.current={input:active.plan.input,seconds};active.plan.onProgress?.(seconds);}
   if(canvas.current&&(drawnInput!==last.current.input||drawnSeconds!==last.current.seconds)){draw(canvas.current,last.current.input,last.current.seconds);drawnInput=last.current.input;drawnSeconds=last.current.seconds;}
   animation=requestAnimationFrame(render);
  };render();
  return()=>{mounted.current=false;cancelAnimationFrame(animation);clear();void context.current?.close();context.current=undefined;master.current=undefined;};
 },[canvas,clear]);
 return {playing,preparing,completed,error,play,pause};
}
