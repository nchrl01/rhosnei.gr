// Retry only transport failures and transient HTTP responses. Validation and
// authorization failures are returned unchanged to the caller and still fail.
export async function captureFetch(url,init={}, {fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=3,timeoutMs=20000}={}){
 if(!Number.isInteger(attempts)||attempts<1||attempts>3)throw Error('Invalid capture retry budget');
 for(let attempt=0;attempt<attempts;attempt++){
  let response;
  try{response=await fetcher(url,{...init,signal:AbortSignal.timeout(timeoutMs)});}
  catch(error){
   if(attempt===attempts-1)throw error;
   await wait(1000*2**attempt);continue;
  }
  if((![408,425,429].includes(response.status)&&response.status<500)||attempt===attempts-1)return response;
  const header=response.headers.get('retry-after'),seconds=header&&/^\d+$/.test(header)?Number(header):0;
  const delay=Math.min(10000,Math.max(1000*2**attempt,seconds*1000));
  await response.body?.cancel();await wait(delay);
 }
}
