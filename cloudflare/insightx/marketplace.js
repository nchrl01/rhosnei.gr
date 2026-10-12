// Only explicitly supported public discovery routes are exposed here.
const chains=new Set(['ethereum','base','solana','bsc','arbitrum','matic','optimism','avalanche']);
export async function marketplace(request,env,headers){
 const url=new URL(request.url),reply=(body,status=200)=>Response.json(body,{status,headers:{...headers,'Cache-Control':'no-store'}});
 if(request.method!=='GET')return reply({error:'Method not allowed'},405);
 if(url.pathname==='/marketplace/config')return reply({configured:!!env.OPENSEA_API_KEY,projectId:env.REOWN_PROJECT_ID||'',trading:false});
 if(!env.OPENSEA_API_KEY)return reply({error:'Marketplace connection is being configured.'},503);
 const chain=url.searchParams.get('chain'),slug=url.searchParams.get('collection');
 if(chain&&!chains.has(chain))return reply({error:'This network is not available.'},400);
 if(slug&&!/^[a-zA-Z0-9_-]{1,200}$/.test(slug))return reply({error:'Invalid collection'},400);
 let path;
 if(url.pathname==='/marketplace/collections')path=slug?'/collections/'+encodeURIComponent(slug):'/collections';
 else if(url.pathname==='/marketplace/nfts'&&slug)path='/collection/'+encodeURIComponent(slug)+'/nfts';
 else return reply({error:'Not found'},404);
 const upstream=new URL('https://api.opensea.io/api/v2'+path);
 if(!slug||url.pathname.endsWith('/nfts')){upstream.searchParams.set('limit','24');const next=url.searchParams.get('next');if(next&&next.length<=2048)upstream.searchParams.set('next',next);}
 if(chain&&!slug)upstream.searchParams.set('chain',chain);
 const key=new Request(upstream.href),cache=caches.default;
 try{
  const cached=await cache.match(key);if(cached){const response=new Response(cached.body,cached);for(const [k,v]of Object.entries(headers))response.headers.set(k,v);return response;}
  const result=await fetch(upstream,{headers:{'x-api-key':env.OPENSEA_API_KEY,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!result.ok)return reply({error:result.status===429?'Marketplace is busy. Please try again shortly.':'Collections are temporarily unavailable.'},result.status===429?429:502);
  const body=await result.json(),stored=Response.json(body,{headers:{'Cache-Control':'public,max-age=60'}});
  await cache.put(key,stored.clone());for(const[k,v]of Object.entries(headers))stored.headers.set(k,v);return stored;
 }catch{return reply({error:'Marketplace is temporarily unavailable.'},503);}
}
