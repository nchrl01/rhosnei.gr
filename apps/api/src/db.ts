import type {Env} from './env';
export class DB {
 constructor(private env:Env){}
 async call<T>(path:string,body?:unknown,method?:string):Promise<T>{
  const response=await fetch(this.env.POSTGREST_URL.replace(/\/$/,'')+'/'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Authorization:'Bearer '+this.env.POSTGREST_TOKEN,apikey:this.env.POSTGREST_TOKEN,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('database-'+response.status);const text=await response.text();return text?JSON.parse(text) as T:undefined as T;
 }
 list<T>(table:string,query:Record<string,string>={}){return this.call<T[]>(table+'?'+new URLSearchParams(query));}
 rpc<T>(name:string,body:unknown){return this.call<T>('rpc/'+name,body);}
 async one<T>(table:string,query:Record<string,string>){return (await this.list<T>(table,{...query,limit:'1'}))[0];}
 async enqueue(kind:string,key:string,payload:unknown){return this.rpc('upic_job_enqueue',{p_kind:kind,p_key:key,p_payload:payload});}
}
