// This marker resumes the UI after a mobile wallet handoff. It grants no access
// and contains no address, signature, challenge or session token.
const key='upic-profile-sign-in',parameter='upic_login',lifetime=10*60*1000;
const valid=value=>Number.isFinite(value)&&value>Date.now()-lifetime&&value<=Date.now()+30000;
function pageURL(){try{return new URL(globalThis.location.href);}catch{return null;}}
function replaceURL(url){try{globalThis.history?.replaceState(globalThis.history.state,'',url.href);}catch{}}
export function pendingProfileSignIn(){
 const url=pageURL(),fromURL=Number(url?.searchParams.get(parameter));
 let stored=0;try{stored=Number(globalThis.sessionStorage?.getItem(key));}catch{}
 if(valid(fromURL))return true;
 if(url?.searchParams.has(parameter)){url.searchParams.delete(parameter);replaceURL(url);}
 if(valid(stored))return true;
 try{globalThis.sessionStorage?.removeItem(key);}catch{}
 return false;
}
export function beginProfileSignIn(){
 const started=Date.now();
 try{globalThis.sessionStorage?.setItem(key,String(started));}catch{}
 // Phantom's mobile browse link copies this page URL into its own browser.
 const url=pageURL();if(url){url.searchParams.set(parameter,String(started));replaceURL(url);}
}
export function endProfileSignIn(){
 try{globalThis.sessionStorage?.removeItem(key);}catch{}
 const url=pageURL();if(url?.searchParams.has(parameter)){url.searchParams.delete(parameter);replaceURL(url);}
}
