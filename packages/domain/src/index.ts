export type Hex = `0x${string}`;
export type Address = Hex;
export type Decimal = string;
export const CHAINS = [
  {id:'ethereum',name:'Ethereum',chainId:1,okx:'1',kind:'evm',verified:true},
  {id:'bsc',name:'BSC',chainId:56,okx:'56',kind:'evm',verified:true},
  {id:'base',name:'Base',chainId:8453,okx:'8453',kind:'evm',verified:true},
  {id:'arbitrum',name:'Arbitrum',chainId:42161,okx:'42161',kind:'evm',verified:true},
  {id:'solana',name:'Solana',chainId:null,okx:'501',kind:'solana',verified:false},
  {id:'tron',name:'Tron',chainId:null,okx:'195',kind:'tron',verified:false},
  {id:'monad',name:'Monad',chainId:143,okx:'143',kind:'evm',verified:false},
  {id:'hyperevm',name:'HyperEVM',chainId:999,okx:'999',kind:'evm',verified:false},
  {id:'xlayer',name:'X Layer',chainId:196,okx:'196',kind:'evm',verified:false},
  {id:'robinhood',name:'Robinhood',chainId:4663,okx:'4663',kind:'evm',verified:false}
] as const;
export type ChainId = typeof CHAINS[number]['id'];
export const THRESHOLDS = [100_000n,500_000n,1_000_000n,2_000_000n,5_000_000n,10_000_000n,25_000_000n,50_000_000n];
export const STAGES = ['Origin','Genesis','Pulse','Rhythm','Harmony','Expansion','Ascension','Transcendence','Final Form'];
export const USD_SCALE = 100_000_000n;
export const ENGINE_VERSION = 'upic-nft-gb-v7';
export const MINT_PRICE = 50_000_000_000_000_000n;
export const TESTNET = {id:46630,name:'Robinhood Testnet',rpc:'https://rpc.testnet.chain.robinhood.com',explorer:'https://explorer.testnet.chain.robinhood.com'};
export const LOCAL_CHAIN_ID = 31337;
export function chainFor(id:string) {const c=CHAINS.find(c=>c.id===id);if(!c)throw Error('unsupported-chain');return c;}
export function canonicalToken(chain:ChainId,input:string):string {
  const kind=chainFor(chain).kind;
  if(kind==='evm'){if(!/^0x[0-9a-fA-F]{40}$/.test(input))throw Error('invalid-token');return input.toLowerCase();}
  if(kind==='solana'&&!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input))throw Error('invalid-token');
  if(kind==='tron'&&!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(input))throw Error('invalid-token');
  return input;
}
export function units(value:Decimal,decimals=8):bigint {
  if(!Number.isInteger(decimals)||decimals<0||decimals>36||!/^\d+(\.\d+)?$/.test(value))throw Error('invalid-decimal');
  const [whole='0',fraction='']=value.split('.');
  if(fraction.length>decimals&&/[^0]/.test(fraction.slice(decimals)))throw Error('decimal-precision');
  return BigInt(whole)*10n**BigInt(decimals)+BigInt(fraction.slice(0,decimals).padEnd(decimals,'0')||'0');
}
export function decimal(value:bigint,decimals=8):Decimal {
  if(value<0n)throw Error('negative-decimal');const base=10n**BigInt(decimals);
  const f=(value%base).toString().padStart(decimals,'0').replace(/0+$/,'');return (value/base).toString()+(f?'.'+f:'');
}
export function stageFor(capUsd8:bigint){return THRESHOLDS.filter(t=>capUsd8>=t*USD_SCALE).length;}
export function primarySplit(value:bigint){const buyback=value/2n,initiator=value/4n;return {buyback,initiator,protocol:value-buyback-initiator};}
export function secondarySplit(value:bigint){const fee=value*450n/10000n,initiator=value*125n/10000n,protocol=value*125n/10000n;return {seller:value-fee,initiator,protocol,buyback:fee-initiator-protocol};}
export interface MarketFrame {chain:ChainId;token:string;at:number;priceUsd:Decimal|null;marketCapUsd:Decimal|null;liquidityUsd:Decimal|null;volumeUsd:Decimal|null;source:string;stale:boolean;simulated:boolean;trades?:Trade[]}
export interface Trade {id:string;at:number;priceUsd:Decimal;volumeUsd:Decimal;side:'buy'|'sell';tx:string}
export interface Candle {time:number;open:Decimal;high:Decimal;low:Decimal;close:Decimal;volume:Decimal;complete:boolean}
export interface Evidence {
  version:1;policy:'evm-twap-v1';assetKey:Hex;chain:ChainId;token:Address;pool:Address;protocol:'v2'|'v3';
  block:{number:string;hash:Hex;timestamp:number};firstBlock:{number:string;hash:Hex;timestamp:number};
  priceUsd8:string;priceUsd18:string;supply:string;supplyDecimals:number;capUsd8:string;liquidityUsd8:string;
  reads:RpcWitness[];coverage:{from:number;to:number;completeLifetime:false};rpcAgreement:true;
}
export interface RpcWitness {method:string;params:unknown[];result:unknown}
export interface ArtworkInput {seed:Hex;stage:number;engineVersion:typeof ENGINE_VERSION;frames:MarketFrame[];seconds:20}
export interface Deployment {chainId:number;factory:Address;vault:Address;marketplace:Address;buyback:Address;upic:Address;router:Address;startBlock:number;engineVersion:string;mode:'local'|'testnet'}
export interface Collection {address:Address;asset_key:Hex;chain:ChainId;token:string;name:string;symbol:string;initiator:Address;stage:number;minted:number;verified_cap:string|null;history_from:number|null}
export interface Edition {collection:Address;edition:number;owner:Address;seed:Hex;stage:number;metadata_uri:string;image:string;animation_url:string;media_stage:number;transfer_nonce:string}
export interface Job {id:string;kind:'verify'|'attest'|'render'|'publish'|'index';payload:Record<string,unknown>;attempts:number;lease_token:string}
export function assertArtwork(input:ArtworkInput){
  if(!/^0x[0-9a-f]{64}$/i.test(input.seed)||!Number.isInteger(input.stage)||input.stage<0||input.stage>8||input.engineVersion!==ENGINE_VERSION||input.seconds!==20||input.frames.length>1000)throw Error('invalid-artwork');
  if(!input.frames.length)throw Error('missing-artwork-input');
}
