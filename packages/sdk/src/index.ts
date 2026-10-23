import {encodeAbiParameters,keccak256,stringToHex,parseAbi,type Address,type Hex} from 'viem';
import {ENGINE_VERSION} from '@upic/domain';
export * from '@upic/domain';
export const factoryAbi=parseAbi([
 'function collections(bytes32) view returns (address)',
 'function creationFee() view returns (uint256)','function basePrice() view returns (uint256)','function paused() view returns (bool)',
 'function create((uint256 sourceChain,address token,address initiator,uint8 stage,uint256 cap,bytes32 evidenceHash,string evidenceURI,string genesisURI,string name,string symbol,uint256 nonce,uint256 deadline) a,bytes signature) returns (address)',
 'event CollectionCreated(bytes32 indexed assetKey,address indexed collection,address indexed initiator,uint256 sourceChain,address token)'
]);
export const nftAbi=parseAbi([
 'function mint((address recipient,uint8 edition,uint8 stage,string uri,uint256 nonce,uint256 deadline) a,bytes signature) payable',
 'function ownerOf(uint256) view returns (address)','function tokenURI(uint256) view returns (string)',
 'function seedOf(uint256) view returns (bytes32)','function stage() view returns (uint8)',
 'function minted() view returns (uint256)','function initiator() view returns (address)',
 'function currentPrice() view returns (uint256)','function priceAt(uint256) view returns (uint256)','function basePrice() view returns (uint256)','function cadence() view returns (uint8)','function lastSignalEpoch() view returns (uint256)','function hibernationSnapshot() view returns (string)',
 'function signalEpoch(uint8 next,string snapshotURI)',
 'function royaltyInfo(uint256,uint256) view returns (address,uint256)',
 'function highestVerifiedCap() view returns (uint256)','function mediaStage(uint256) view returns (uint8)','function archives(uint256,uint8) view returns (string)',
 'function assetKey() view returns (bytes32)','function transferNonce(uint256) view returns (uint256)',
 'function approve(address,uint256)','function getApproved(uint256) view returns (address)',
 'function safeTransferFrom(address,address,uint256)',
 'function evolve(uint8 next,uint256 cap,bytes32 evidenceHash,string evidenceURI,uint256 nonce,uint256 deadline,bytes signature)',
 'function publishMetadata(uint256[] ids,uint8 mediaStage,string[] uris)',
 'event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)',
 'event Evolution(uint8 indexed stage,uint256 cap,bytes32 evidenceHash,string evidenceURI)',
 'event MediaPublished(uint256 indexed tokenId,uint8 stage,string uri)',
 'event CadenceChanged(uint8 cadence,uint256 epoch,string snapshotURI)'
]);
export const tokenAbi=parseAbi(['function approve(address,uint256) returns (bool)','function allowance(address,address) view returns (uint256)','function symbol() view returns (string)','function lastFaucet(address) view returns (uint256)','function balanceOf(address) view returns (uint256)','function totalSupply() view returns (uint256)','function decimals() view returns (uint8)','function faucet(address,uint256)','function burn(uint256)']);
export const vaultAbi=parseAbi(['function claimable(address) view returns (uint256)','function buybackReserve() view returns (uint256)','function claim(address payable to)','function executeBuyback(uint256 amount,uint256 minOut,uint256 deadline)',
 'function maintenance(address) view returns (uint256)','function maintenancePool() view returns (uint256)','function lastUpkeepEpoch(address) view returns (uint256)','function maxUpkeepPerEpoch() view returns (uint256)',
 'function fundMaintenance(address collection) payable','function debitUpkeep(address collection,uint256 amount) returns (uint256,uint256)']);
/** EIP-712 domain names. Neutral on purpose: they are readable from deployed bytecode. */
export const DOMAINS={factory:'Factory',collection:'Collection',marketplace:'Market'} as const;
/** Revenue split in basis points, mirrored from RevenueVault for display. */
export const SPLITS={primary:{initiator:3000,protocol:2500,maintenance:2500,buyback:2000},sale:{initiator:200,maintenance:200,buyback:100,protocol:100,total:600},poolShare:1000} as const;
export const marketAbi=parseAbi([
 'function purchase((address seller,address collection,uint256 tokenId,uint256 price,uint256 expiry,uint256 nonce,uint256 ownershipNonce) order,bytes signature) payable',
 'function cancel(uint256 nonce)','function used(address,uint256) view returns (bool)',
 'event Sale(address indexed collection,uint256 indexed tokenId,address indexed seller,address buyer,uint256 price,uint256 nonce)','event Cancelled(address indexed seller,uint256 nonce)'
]);
export const creationTypes={Create:[{name:'sourceChain',type:'uint256'},{name:'token',type:'address'},{name:'initiator',type:'address'},{name:'stage',type:'uint8'},{name:'cap',type:'uint256'},{name:'evidenceHash',type:'bytes32'},{name:'evidenceURI',type:'string'},{name:'genesisURI',type:'string'},{name:'name',type:'string'},{name:'symbol',type:'string'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]} as const;
export const mintTypes={Mint:[{name:'recipient',type:'address'},{name:'edition',type:'uint8'},{name:'stage',type:'uint8'},{name:'uri',type:'string'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]} as const;
export const evolutionTypes={Evolution:[{name:'next',type:'uint8'},{name:'cap',type:'uint256'},{name:'evidenceHash',type:'bytes32'},{name:'evidenceURI',type:'string'},{name:'nonce',type:'uint256'},{name:'deadline',type:'uint256'}]} as const;
export const orderTypes={Order:[{name:'seller',type:'address'},{name:'collection',type:'address'},{name:'tokenId',type:'uint256'},{name:'price',type:'uint256'},{name:'expiry',type:'uint256'},{name:'nonce',type:'uint256'},{name:'ownershipNonce',type:'uint256'}]} as const;
export function assetKey(sourceChain:number,token:Address){return keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'}],[BigInt(sourceChain),token]));}
export function seedFor(chainId:number,factory:Address,key:Hex,edition:number){return keccak256(encodeAbiParameters([{type:'string'},{type:'uint256'},{type:'address'},{type:'bytes32'},{type:'uint256'}],['upic-nft-v1',BigInt(chainId),factory,key,BigInt(edition)]));}
export const domain=(name:string,chainId:number,verifyingContract:Address)=>({name,version:'1',chainId,verifyingContract});
export const engineHash=keccak256(stringToHex(ENGINE_VERSION));
