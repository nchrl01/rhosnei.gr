import type {Deployment} from '@upic/domain';
export const API=import.meta.env.VITE_API_URL||(import.meta.env.DEV?'http://localhost:8787':'/api');
export async function api<T>(path:string,body?:unknown):Promise<T>{const r=await fetch(API+path,{credentials:'include',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
export type Config={deployment:Deployment;gateway:string;appURL:string};
export const errorText=(e:unknown)=>e instanceof Error?e.message:'Operation failed';
