// Use the same network artwork as the marketplace, with native coin logos where available.
const networkMarks=Object.fromEntries(['ethereum','base','solana','arbitrum','polygon','optimism','avalanche','robinhood','abstract','animechain','ape_chain','arc','bera_chain','blast','flow','gunzilla','hyperevm','hyperliquid','ink','megaeth','monad','ronin','sei','shape','somnia','soneium','stablechain','unichain','zora'].map(icon=>[({ape_chain:'apechain',bera_chain:'berachain',sei:'sei-network',stablechain:'stable',zora:'zora-network'})[icon]||icon,'images/networks/'+icon+'.svg']));
networkMarks.bsc='images/networks/bsc.png';
export function searchNetworks(rows){
 const represented=new Set(rows.flatMap(coin=>[coin.chain,...(coin.nativeChains||[]),...(coin.platforms||[]).map(platform=>platform.chain)]).filter(Boolean));
 const native=new Map();for(const coin of rows)if(coin.contractStatus==='native')for(const chain of coin.nativeChains||[coin.nativeChain||coin.chain])if(!native.has(chain)&&/^https?:\/\//.test(coin.image||''))native.set(chain,coin);
 const preferred=Object.keys(networkMarks),names={bsc:'BNB Chain',apechain:'ApeChain',berachain:'Berachain','sei-network':'Sei','zora-network':'Zora',hyperevm:'HyperEVM'};
 return [...represented].map(chain=>({chain,name:names[chain]||native.get(chain)?.name||chain.replace(/[-_]/g,' ').replace(/\b\w/g,char=>char.toUpperCase()),image:networkMarks[chain]||native.get(chain)?.image})).filter(item=>item.image).sort((a,b)=>{const ai=preferred.indexOf(a.chain),bi=preferred.indexOf(b.chain);return(ai<0?999:ai)-(bi<0?999:bi)||a.name.localeCompare(b.name);});
}
