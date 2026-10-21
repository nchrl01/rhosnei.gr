// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script} from "forge-std/Script.sol";
import {UPICFactory} from "../src/UPICFactory.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {UPICMarketplace} from "../src/UPICMarketplace.sol";
import {BuybackExecutor} from "../src/BuybackExecutor.sol";
import {TestUPIC} from "../src/mocks/TestUPIC.sol";
import {TestExchange} from "../src/mocks/TestExchange.sol";
interface IArbSys {function arbBlockNumber() external view returns(uint256);}

/// Deploys the full test protocol. Supported: 31337 (local), 46630 (Robinhood Chain testnet),
/// 421614 (Arbitrum Sepolia fallback; also an Arbitrum chain, so ArbSys works).
/// Optional env: TOKEN_NAME, TOKEN_SYMBOL, CREATION_FEE (wei of token), BASE_PRICE (wei),
/// UPKEEPER, MAX_UPKEEP_PER_EPOCH (wei), GIT_SHA.
contract Deploy is Script {
 function run() external {
  require(block.chainid==31337||block.chainid==46630||block.chainid==421614,"Wrong deployment chain");
  uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");address admin=vm.addr(key);
  address minter=vm.envAddress("MINT_SIGNER");address verifier=vm.envAddress("VERIFIER_SIGNER");
  address upkeeper=vm.envOr("UPKEEPER",minter);
  string memory tokenName=vm.envOr("TOKEN_NAME",string("Staging Utility Token (TEST)"));
  string memory tokenSymbol=vm.envOr("TOKEN_SYMBOL",string("tSTG"));
  uint256 creationFee=vm.envOr("CREATION_FEE",uint256(1_000 ether));
  uint256 basePrice=vm.envOr("BASE_PRICE",uint256(0.002 ether));
  uint256 maxUpkeep=vm.envOr("MAX_UPKEEP_PER_EPOCH",uint256(0.0002 ether));
  uint256 start=block.chainid==31337?block.number:IArbSys(address(0x64)).arbBlockNumber();
  vm.startBroadcast(key);
  TestUPIC token=new TestUPIC(tokenName,tokenSymbol);RevenueVault vault=new RevenueVault(admin,admin);
  TestExchange router=new TestExchange(address(token));
  BuybackExecutor buyback=new BuybackExecutor(address(vault),address(router),address(token));
  UPICMarketplace market=new UPICMarketplace(address(vault));
  UPICFactory factory=new UPICFactory(admin,address(token),address(vault),minter,verifier);
  vault.configure(address(factory),address(market),address(buyback));
  vault.setUpkeeper(upkeeper,maxUpkeep);
  factory.setEconomics(creationFee,basePrice);
  token.faucet(admin,10000 ether);token.transfer(address(router),9000 ether);
  vm.stopBroadcast();
  string memory id="deployment";
  vm.serializeUint(id,"chainId",block.chainid);vm.serializeAddress(id,"factory",address(factory));vm.serializeAddress(id,"vault",address(vault));
  vm.serializeAddress(id,"marketplace",address(market));vm.serializeAddress(id,"buyback",address(buyback));vm.serializeAddress(id,"upic",address(token));vm.serializeAddress(id,"router",address(router));
  vm.serializeAddress(id,"implementation",factory.implementation());vm.serializeAddress(id,"upkeeper",upkeeper);
  vm.serializeUint(id,"creationFee",creationFee);vm.serializeUint(id,"basePrice",basePrice);
  vm.serializeString(id,"gitSha",vm.envOr("GIT_SHA",string("local")));
  vm.serializeUint(id,"startBlock",start);vm.serializeString(id,"engineVersion","upic-nft-v1");
  string memory data=vm.serializeString(id,"mode",block.chainid==31337?"local":"testnet");
  vm.writeJson(data,string.concat("deployments/",vm.toString(block.chainid),".json"));
 }
}
