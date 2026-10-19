import {BlockchainInfo,Block,TxHistoryPage,ScriptUtxos} from './vendor/chronik-proto.js';
// Official Chronik protocol: https://chronik.e.cash/docs/
// eCash redenomination: one XEC is 100 satoshis. Token atoms are never XEC.
const hex=value=>Array.from(value,b=>b.toString(16).padStart(2,'0')).join('');
export async function loadEcashNative(read,now=Date.now()){
 const origin='https://chronik.e.cash',get=async(path,type)=>type.decode(await read(origin+path,{nativeBinary:true}));
 const tip=await get('/blockchain-info',BlockchainInfo);if(!Number.isSafeInteger(tip.tipHeight)||tip.tipHeight<=0)throw Error('invalid-ecash-tip');
 const info=(await get('/block/'+tip.tipHeight,Block)).blockInfo,indexTipAt=Number(info?.timestamp)*1000;
 if(!info||info.height!==tip.tipHeight||hex(info.hash)!==hex(tip.tipHash))throw Error('native-chain-mismatch');
 if(!Number.isSafeInteger(indexTipAt)||indexTipAt>now+300000||now-indexTipAt>=6*3600000)throw Error('native-index-delayed');
 const page=await get('/block-txs/'+tip.tipHeight+'?page=0&page_size=25',TxHistoryPage),selected=new Map();
 scan:for(const tx of page.txs){for(const output of tx.outputs){const script=hex(output.outputScript),m=/^76a914([0-9a-f]{40})88ac$/.exec(script)||/^a914([0-9a-f]{40})87$/.exec(script);if(m){selected.set(script,{type:script.startsWith('76')?'p2pkh':'p2sh',hash:m[1]});if(selected.size===3)break scan;}}}
 const records=[];for(const [script,{type,hash}] of selected){const data=await get('/script/'+type+'/'+hash+'/utxos',ScriptUtxos);if(hex(data.script)!==script)throw Error('invalid-ecash-script');let amount=0n;const seen=new Set();for(const u of data.utxos){const id=hex(u.outpoint?.txid||[])+':'+u.outpoint?.outIdx;if(!u.outpoint||seen.has(id)||u.sats<0n)throw Error('invalid-ecash-utxo');seen.add(id);amount+=u.sats;}const tokenBalance=Number(amount)/100;if(!Number.isFinite(tokenBalance))throw Error('invalid-native-balance');if(tokenBalance>0)records.push({id:'ecash-script:'+type+':'+hash,tokenBalance});}
 if(!records.length)throw Error('empty-native-account-sample');
 return {records,source:'Official eCash Chronik current unspent outputs',scope:'recent-output-ownership-scripts-current-utxos-including-mempool-excludes-token-atoms',coverage:'ownership-script-sample',sourceAt:null,indexTipAt,totalHolders:null,complete:false,supply:null,referencePrice:null,referenceMarketCap:null};
}
