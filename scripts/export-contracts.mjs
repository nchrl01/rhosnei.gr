import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('packages/sdk/generated',{recursive:true});
for(const name of ['UPICFactory','UPICCollection','UPICMarketplace','RevenueVault','BuybackExecutor','TestUPIC','TestExchange']){
 const artifact=JSON.parse(await readFile('contracts/out/'+name+'.sol/'+name+'.json','utf8'));await writeFile('packages/sdk/generated/'+name+'.json',JSON.stringify(artifact.abi,null,2)+'\n');
}
