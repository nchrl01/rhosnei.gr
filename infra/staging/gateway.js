// Private staging gateway. One hostname, protected by Cloudflare Access, that serves the built
// web app and forwards same-origin calls to private Workers through service bindings:
//   /api/*  -> platform API (apps/api, staging env)       binding API   (optional)
//   /x/*    -> data worker (cloudflare/insightx, staging)  binding DATA
// The backing Workers have workers_dev disabled, so they have no public URL of their own.
// Defense in depth: when ACCESS_TEAM_DOMAIN and ACCESS_AUD are set, every request must carry a
// valid Cloudflare Access JWT, so a misconfigured or deleted Access policy fails closed.

const NOINDEX={'X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer'};
const CAPTURE_PATHS=/^\/(coin-captures|visual-history)(\/image)?$/;
let certs={at:0,keys:new Map()};

const b64url=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));
const decode=part=>JSON.parse(new TextDecoder().decode(b64url(part)));

async function accessKeys(team,kid){
 // Refresh hourly, or at most once a minute when a token names an unknown (rotated) key.
 const fresh=Date.now()-certs.at<3600000&&certs.keys.size,rotated=kid&&!certs.keys.has(kid)&&Date.now()-certs.at>60000;
 if(fresh&&!rotated)return certs.keys;
 const response=await fetch(`https://${team}/cdn-cgi/access/certs`,{cf:{cacheTtl:3600}});
 if(!response.ok)throw Error('access-certs-unavailable');
 const {keys=[]}=await response.json(),map=new Map();
 for(const jwk of keys)map.set(jwk.kid,await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']));
 certs={at:Date.now(),keys:map};return map;
}

export async function verifyAccess(request,env){
 if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)return env.REQUIRE_ACCESS!=='true';
 const token=request.headers.get('Cf-Access-Jwt-Assertion')||/(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('Cookie')||'')?.[1];
 if(!token)return false;
 const [h,p,s]=token.split('.');if(!h||!p||!s)return false;
 try{
  const header=decode(h),payload=decode(p),key=(await accessKeys(env.ACCESS_TEAM_DOMAIN,header.kid)).get(header.kid);
  if(!key||header.alg!=='RS256')return false;
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(s),new TextEncoder().encode(h+'.'+p));
  const aud=Array.isArray(payload.aud)?payload.aud:[payload.aud],now=Date.now()/1000;
  return valid&&aud.includes(env.ACCESS_AUD)&&payload.iss===`https://${env.ACCESS_TEAM_DOMAIN}`&&payload.exp>now&&(payload.nbf??0)<=now+60;
 }catch{return false;}
}

function withHeaders(response,extra=NOINDEX){const out=new Response(response.body,response);for(const [k,v] of Object.entries(extra))out.headers.set(k,v);return out;}
function forward(binding,request,prefix){
 const url=new URL(request.url);url.pathname=url.pathname.slice(prefix.length)||'/';
 return binding.fetch(new Request(url,request));
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{'Content-Type':'text/plain',...NOINDEX}});
  if(!await verifyAccess(request,env))return new Response('Forbidden',{status:403,headers:NOINDEX});
  if(url.pathname==='/config/deployment.json'){
   if(!env.DEPLOYMENT_JSON)return Response.json({error:'not-deployed'},{status:404,headers:NOINDEX});
   return new Response(env.DEPLOYMENT_JSON,{headers:{'Content-Type':'application/json','Cache-Control':'no-store',...NOINDEX}});
  }
  if(url.pathname==='/api'||url.pathname.startsWith('/api/')){
   if(!env.API)return Response.json({error:'platform-api-not-deployed'},{status:503,headers:NOINDEX});
   return withHeaders(await forward(env.API,request,'/api'));
  }
  if(url.pathname.startsWith('/x/')){
   const inner=url.pathname.slice(2);
   // Shared live captures are produced hourly by the production pipeline; staging reads them
   // instead of running a second capture fleet.
   if(env.CAPTURE_SOURCE&&request.method==='GET'&&CAPTURE_PATHS.test(inner)){
    const upstream=await fetch(env.CAPTURE_SOURCE.replace(/\/$/,'')+inner+url.search,{headers:{Accept:request.headers.get('Accept')||'*/*'}});
    return withHeaders(upstream,{...NOINDEX,'Access-Control-Allow-Origin':url.origin});
   }
   return withHeaders(await forward(env.DATA,request,'/x'));
  }
  return withHeaders(await env.ASSETS.fetch(request));
 }
};
