// Official same-network wrapped counterparts. These references are display-only:
// they never replace native identity, holder observations, prices or captures.
export const NATIVE_WRAPPED_CONTRACTS=Object.freeze({
 binancecoin:Object.freeze({nativeChain:'bsc',chain:'bsc',symbol:'WBNB',address:'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',source:'https://www.bnbchain.org/en/blog/what-is-wbnb',verifiedAt:'2026-10-23'}),
 near:Object.freeze({nativeChain:'near',chain:'near',symbol:'wNEAR',address:'wrap.near',source:'https://github.com/near/core-contracts/tree/master/w-near',verifiedAt:'2026-10-23'})
});
export function nativeWrappedContract(asset){
 const reference=asset&&NATIVE_WRAPPED_CONTRACTS[asset.id];
 return reference&&asset.chain===reference.nativeChain&&(asset.address==='native'||asset.address==='native:'+asset.id)?reference:null;
}
