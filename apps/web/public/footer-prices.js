const outputs=[...document.querySelectorAll('[data-spot]')];
const interval=120000,format=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
let timer,controller,lastAttempt=0;
function paint(node,quote){if(!(quote?.price>0))return;node.textContent=format.format(quote.price);node.title='Coinbase spot · '+new Date(quote.at).toLocaleTimeString();node.dataset.stale=String(Date.now()-quote.at>interval*2);}
for(const node of outputs){try{paint(node,JSON.parse(localStorage.getItem('av-footer-'+node.dataset.spot)));}catch{}}
async function refresh(){
 clearTimeout(timer);if(document.hidden||!outputs.length)return;
 const delay=interval-(Date.now()-lastAttempt);if(delay>0){timer=setTimeout(refresh,delay);return;}
 lastAttempt=Date.now();controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),8000);
 await Promise.allSettled(outputs.map(async node=>{
  try{const response=await fetch('https://api.coinbase.com/v2/prices/'+node.dataset.spot+'-USD/spot',{signal:controller.signal,credentials:'omit'});if(!response.ok)throw Error(response.status);const body=await response.json(),price=Number(body.data?.amount);if(!(price>0))throw Error('Invalid price');const quote={price,at:Date.now()};paint(node,quote);try{localStorage.setItem('av-footer-'+node.dataset.spot,JSON.stringify(quote));}catch{}}
  catch{node.dataset.stale='true';node.title='Price temporarily unavailable · last received value shown when available';}
 }));clearTimeout(timeout);controller=null;if(!document.hidden)timer=setTimeout(refresh,interval);
}
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden)controller?.abort();else refresh();});
refresh();
