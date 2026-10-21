#!/usr/bin/env node
// Idempotently protects the staging hostname with Cloudflare Access (Zero Trust free plan: up to 50 users).
// Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, STAGING_HOST (e.g. pv-gate.<sub>.workers.dev),
//      ACCESS_EMAILS (comma-separated testers), optional ACCESS_EMAIL_DOMAIN, optional CF_ACCESS_CLIENT_ID
//      (an existing service token's client id, allowed for CI smoke tests and Playwright).
// Writes team=<auth domain> and aud=<application audience> to $GITHUB_OUTPUT when present.
import {appendFileSync} from 'node:fs';

const {CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,STAGING_HOST:host}=process.env;
if(!token||!account||!host)throw Error('CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and STAGING_HOST are required');
const emails=(process.env.ACCESS_EMAILS||'').split(',').map(e=>e.trim()).filter(Boolean);
const domain=(process.env.ACCESS_EMAIL_DOMAIN||'').trim();
if(!emails.length&&!domain)throw Error('Set ACCESS_EMAILS (or ACCESS_EMAIL_DOMAIN) so at least one person can open staging');

async function cf(path,init={}){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...init.headers}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.success===false)throw Error(`${init.method||'GET'} ${path} failed: ${response.status} ${JSON.stringify(body.errors||body).slice(0,400)}`);
 return body.result;
}

const organization=await cf('/access/organizations').catch(error=>{throw Error('Zero Trust is not enabled on this account yet. Open Cloudflare dashboard → Zero Trust once and pick the Free plan. ('+error.message+')');});
const team=organization.auth_domain;

const include=[...emails.map(email=>({email:{email}})),...(domain?[{email_domain:{domain}}]:[])];
const policies=[{name:'testers',decision:'allow',include,precedence:1}];
if(process.env.CF_ACCESS_CLIENT_ID){
 const tokens=await cf('/access/service_tokens');
 const ci=tokens.find(t=>t.client_id===process.env.CF_ACCESS_CLIENT_ID);
 if(!ci)throw Error('CF_ACCESS_CLIENT_ID does not match a service token in this account');
 policies.push({name:'ci',decision:'non_identity',include:[{service_token:{token_id:ci.id}}],precedence:2});
}

const apps=await cf('/access/apps');
const existing=apps.find(a=>a.domain===host||(a.self_hosted_domains||[]).includes(host));
const body={name:'pv',domain:host,type:'self_hosted',session_duration:'24h',app_launcher_visible:false,auto_redirect_to_identity:false,skip_interstitial:true,http_only_cookie_attribute:true,same_site_cookie_attribute:'lax',policies};
const app=existing?await cf('/access/apps/'+existing.id,{method:'PUT',body:JSON.stringify(body)}):await cf('/access/apps',{method:'POST',body:JSON.stringify(body)});
console.log(`${existing?'Updated':'Created'} Access application for ${host}: ${include.length} identity rule(s)${policies.length>1?' + CI service token':''}`);
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`team=${team}\naud=${app.aud}\n`);
else console.log(JSON.stringify({team,aud:app.aud}));
