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
contract Deploy is Script {
 function run() external {
  require(block.chainid==31337||block.chainid==46630,"Wrong deployment chain");
  uint256 key=vm.envUint("DEPLOYER_PRIVATE_KEY");address admin=vm.addr(key);
  address minter=vm.envAddress("MINT_SIGNER");address verifier=vm.envAddress("VERIFIER_SIGNER");
  uint256 start=block.chainid==31337?block.number:IArbSys(address(0x64)).arbBlockNumber();
  vm.startBroadcast(key);
  TestUPIC token=new TestUPIC();RevenueVault vault=new RevenueVault(admin,admin);
  TestExchange router=new TestExchange(address(token));
  BuybackExecutor buyback=new BuybackExecutor(address(vault),address(router),address(token));
  UPICMarketplace market=new UPICMarketplace(address(vault));
  UPICFactory factory=new UPICFactory(admin,address(token),address(vault),minter,verifier);
  vault.configure(address(factory),address(market),address(buyback));
  token.faucet(admin,10000 ether);token.transfer(address(router),9000 ether);
  vm.stopBroadcast();
  string memory id="deployment";
  vm.serializeUint(id,"chainId",block.chainid);vm.serializeAddress(id,"factory",address(factory));vm.serializeAddress(id,"vault",address(vault));
  vm.serializeAddress(id,"marketplace",address(market));vm.serializeAddress(id,"buyback",address(buyback));vm.serializeAddress(id,"upic",address(token));vm.serializeAddress(id,"router",address(router));
  vm.serializeUint(id,"startBlock",start);vm.serializeString(id,"engineVersion","upic-nft-gb-v3");
  string memory data=vm.serializeString(id,"mode",block.chainid==31337?"local":"testnet");
  vm.writeJson(data,string.concat("deployments/",vm.toString(block.chainid),".json"));
 }
}
