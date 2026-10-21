// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {UPICFactory} from "../src/UPICFactory.sol";
import {UPICCollection} from "../src/UPICCollection.sol";
import {RevenueVault} from "../src/RevenueVault.sol";
import {UPICMarketplace} from "../src/UPICMarketplace.sol";
import {BuybackExecutor} from "../src/BuybackExecutor.sol";
import {TestUPIC} from "../src/mocks/TestUPIC.sol";
import {TestExchange} from "../src/mocks/TestExchange.sol";

abstract contract Base is Test {
 uint256 constant SIGNER_KEY=123;address signer;address alice;address bob;address keeper;
 UPICFactory factory;UPICCollection nft;RevenueVault vault;UPICMarketplace market;BuybackExecutor executor;TestUPIC token;TestExchange router;
 uint256 constant P0=0.002 ether;
 function deploy() internal {
  vm.chainId(31337);vm.warp(100 days);signer=vm.addr(SIGNER_KEY);alice=vm.addr(456);bob=vm.addr(789);keeper=vm.addr(999);vm.deal(address(this),100 ether);
  token=new TestUPIC("Staging Utility Token (TEST)","tSTG");vault=new RevenueVault(address(this),address(this));router=new TestExchange(address(token));
  executor=new BuybackExecutor(address(vault),address(router),address(token));market=new UPICMarketplace(address(vault));
  factory=new UPICFactory(address(this),address(token),address(vault),signer,signer);vault.configure(address(factory),address(market),address(executor));
  vault.setUpkeeper(keeper,0.001 ether);
  vm.prank(alice);token.faucet(alice,5000 ether);vm.prank(alice);token.approve(address(factory),type(uint256).max);
  vm.deal(alice,10 ether);vm.deal(bob,10 ether);nft=create(alice,1);
 }
 function digest(address target,string memory name,bytes32 structHash) internal view returns(bytes32){bytes32 d=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256(bytes(name)),keccak256("1"),block.chainid,target));return keccak256(abi.encodePacked("\x19\x01",d,structHash));}
 function sig(bytes32 hash,uint256 key) internal pure returns(bytes memory){(uint8 v,bytes32 r,bytes32 s)=vm.sign(key,hash);return abi.encodePacked(r,s,v);}
 function createFor(address creator,uint256 nonce,address tokenAddr) internal returns(UPICCollection){
  UPICFactory.Create memory c=UPICFactory.Create(31337,tokenAddr,creator,1,100000*1e8,bytes32(uint256(1)),"ipfs://evidence","ipfs://genesis","Test Collection","TST",nonce,block.timestamp+600);
  bytes32 h=keccak256(abi.encode(factory.CREATE_TYPEHASH(),c.sourceChain,c.token,c.initiator,c.stage,c.cap,c.evidenceHash,keccak256(bytes(c.evidenceURI)),keccak256(bytes(c.genesisURI)),keccak256(bytes(c.name)),keccak256(bytes(c.symbol)),c.nonce,c.deadline));
  bytes memory signature=sig(digest(address(factory),"Factory",h),SIGNER_KEY);vm.prank(creator);return UPICCollection(payable(factory.create(c,signature)));
 }
 function create(address creator,uint256 nonce) internal returns(UPICCollection){return createFor(creator,nonce,address(token));}
 function mintOn(UPICCollection target,uint8 edition,address to,uint256 value) internal {
  UPICCollection.Mint memory m=UPICCollection.Mint(to,edition,target.stage(),"ipfs://edition",uint256(keccak256(abi.encode(address(target),edition))),block.timestamp+600);
  bytes32 h=keccak256(abi.encode(target.MINT_TYPEHASH(),m.recipient,m.edition,m.stage,keccak256(bytes(m.uri)),m.nonce,m.deadline));bytes memory signature=sig(digest(address(target),"Collection",h),SIGNER_KEY);
  vm.prank(to);target.mint{value:value}(m,signature);
 }
 function mint(uint8 edition,address to) internal {mintOn(nft,edition,to,nft.currentPrice());}
}

contract ProtocolTest is Base {
 function setUp() public {deploy();}
 function testGenesisImmediateAndDuplicateRejected() public {assertEq(nft.ownerOf(1),alice);assertEq(nft.minted(),1);UPICFactory.Create memory c=UPICFactory.Create(31337,address(token),alice,1,100000*1e8,bytes32(uint256(1)),"ipfs://evidence","ipfs://genesis","Test Collection","TST",2,block.timestamp+600);vm.expectRevert();vm.prank(alice);factory.create(c,hex"00");}
 function testCreationFeeHalfBurnedHalfToTreasury() public {
  assertEq(token.balanceOf(alice),4000 ether);assertEq(token.balanceOf(address(this)),500 ether);assertEq(token.totalSupply(),4500 ether);
 }
 function testCreationRequiresFeeAllowance() public {
  vm.prank(bob);token.faucet(bob,5000 ether);vm.expectRevert();this.externalCreate(bob,1,address(0xBEEF));
 }
 function testPrimarySplitIncludesMaintenance() public {
  mint(2,bob);
  assertEq(vault.claimable(alice),P0*3000/10000);assertEq(vault.claimable(address(this)),P0*2500/10000);
  uint256 m=P0*2500/10000;assertEq(vault.maintenance(address(nft)),m-m/10);assertEq(vault.maintenancePool(),m/10);
  assertEq(vault.buybackReserve(),P0-P0*3000/10000-P0*2500/10000-m);
 }
 function testSteppedPricingTiers() public {
  assertEq(nft.currentPrice(),P0);
  for(uint8 i=2;i<=26;i++)mint(i,alice);assertEq(nft.minted(),26);assertEq(nft.currentPrice(),P0*125/100);
  for(uint8 i=27;i<=51;i++)mint(i,alice);assertEq(nft.currentPrice(),P0*150/100);
  for(uint8 i=52;i<=76;i++)mint(i,alice);assertEq(nft.currentPrice(),P0*2);
  for(uint8 i=77;i<=100;i++)mint(i,alice);assertEq(nft.minted(),100);
  vm.expectRevert();nft.currentPrice();
 }
 function testOverpaymentRefundedUnderpaymentRejected() public {
  uint256 before=bob.balance;mintOn(nft,2,bob,1 ether);assertEq(bob.balance,before-P0);
  vm.expectRevert();this.externalMint(3,bob,P0/2);
 }
 function testMintCapAndSeeds() public {for(uint8 i=2;i<=100;i++)mint(i,alice);assertEq(nft.minted(),100);assertTrue(nft.seedOf(1)!=nft.seedOf(2));UPICCollection.Mint memory m=UPICCollection.Mint(bob,2,1,"ipfs://edition",999,block.timestamp+600);vm.expectRevert();vm.prank(bob);nft.mint{value:1 ether}(m,hex"00");}
 function testBuybackBurnDoesNotSpendClaims() public {
  mint(2,bob);token.faucet(address(this),10000 ether);token.transfer(address(router),1000 ether);uint256 supply=token.totalSupply();uint256 reserve=vault.buybackReserve();
  vault.executeBuyback(reserve,reserve*1000,block.timestamp+600);assertEq(token.totalSupply(),supply-reserve*1000);assertEq(vault.claimable(alice),P0*3000/10000);assertEq(vault.buybackReserve(),0);
 }
 function testFuzzFeeConservation(uint128 price) public {price=uint128(bound(price,1,1000 ether));vm.deal(address(market),price);vm.prank(address(market));vault.secondary{value:price}(address(nft),bob,price);assertEq(vault.obligations(),price);assertEq(address(vault).balance,price);}
 function testFuzzPrimaryConservation(uint96 value) public {vm.deal(address(nft),value);vm.prank(address(nft));vault.primary{value:value}();assertEq(vault.obligations(),value);}
 function testFuzzRoyaltyConservation(uint96 value) public {vm.deal(bob,value);vm.prank(bob);(bool ok,)=address(nft).call{value:value}("");assertTrue(ok);assertEq(vault.obligations(),value);assertEq(address(vault).balance,value);}
 function externalCreate(address c,uint256 n,address t) external {createFor(c,n,t);}
 function externalMint(uint8 e,address to,uint256 v) external {mintOn(nft,e,to,v);}
 function testRoyaltyInfoIsFivePercentToCollection() public view {(address r,uint256 a)=nft.royaltyInfo(1,1 ether);assertEq(r,address(nft));assertEq(a,0.05 ether);}
 function testEvolutionPermanentAndDomainBound() public {
  bytes32 h=keccak256(abi.encode(nft.EVOLUTION_TYPEHASH(),uint8(6),uint256(10000000*1e8),bytes32(uint256(2)),keccak256("ipfs://proof"),uint256(500),block.timestamp+600));
  bytes memory signature=sig(digest(address(nft),"Collection",h),SIGNER_KEY);
  nft.evolve(6,10000000*1e8,bytes32(uint256(2)),"ipfs://proof",500,block.timestamp+600,signature);assertEq(nft.stage(),6);
  vm.expectRevert();nft.evolve(1,100000*1e8,bytes32(uint256(2)),"ipfs://proof",501,block.timestamp+600,signature);
 }
 function listing(uint256 nonce) internal view returns(UPICMarketplace.Order memory o,bytes memory signature){
  o=UPICMarketplace.Order(alice,address(nft),1,1 ether,block.timestamp+600,nonce,nft.transferNonce(1));
  bytes32 h=keccak256(abi.encode(market.ORDER_TYPEHASH(),o.seller,o.collection,o.tokenId,o.price,o.expiry,o.nonce,o.ownershipNonce));
  signature=sig(digest(address(market),"Market",h),456);
 }
 function testSignedMarketplaceSaleAndReplay() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(42);
  vm.prank(alice);nft.approve(address(market),1);vm.prank(bob);market.purchase{value:1 ether}(o,signature);
  assertEq(nft.ownerOf(1),bob);
  assertEq(vault.claimable(alice),0.94 ether+0.02 ether);assertEq(vault.claimable(address(this)),0.01 ether);
  assertEq(vault.buybackReserve(),0.01 ether);assertEq(vault.maintenance(address(nft))+vault.maintenancePool(),0.02 ether);
  vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
 }
 function testSelfTradeRejected() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(46);vm.prank(alice);nft.approve(address(market),1);
  vm.expectRevert();vm.prank(alice);market.purchase{value:1 ether}(o,signature);
 }
 function testCancelledOrderCannotBePurchased() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(43);
  vm.prank(alice);nft.approve(address(market),1);vm.prank(alice);market.cancel(43);
  vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
 }
 function testOwnershipRoundTripInvalidatesOldListing() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(44);
  vm.prank(alice);nft.transferFrom(alice,bob,1);vm.prank(bob);nft.transferFrom(bob,alice,1);vm.prank(alice);nft.approve(address(market),1);
  vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
 }
 function testOrderDomainAndExpiryAreEnforced() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(45);vm.prank(alice);nft.approve(address(market),1);
  vm.chainId(46630);vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
  vm.chainId(31337);vm.warp(o.expiry+1);vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
 }
 function testClaimOnlyWithdrawsCallersAllocation() public {
  mint(2,bob);uint256 before=bob.balance;uint256 share=P0*3000/10000;vm.prank(alice);vault.claim(payable(bob));
  assertEq(bob.balance,before+share);assertEq(vault.claimable(alice),0);
  vm.expectRevert();vm.prank(alice);vault.claim(payable(bob));
 }
 function testMetadataArchiveCannotBeOverwritten() public {
  uint256[] memory ids=new uint256[](1);ids[0]=1;string[] memory uris=new string[](1);uris[0]="ipfs://tampered";
  vm.expectRevert();vm.prank(signer);nft.publishMetadata(ids,1,uris);assertEq(nft.tokenURI(1),"ipfs://genesis");
 }
 function testPauseBlocksMintAndBuyback() public {
  factory.setPaused(true);UPICCollection.Mint memory m=UPICCollection.Mint(bob,2,1,"ipfs://edition",999,block.timestamp+600);
  vm.expectRevert();vm.prank(bob);nft.mint{value:P0}(m,hex"00");
  vm.expectRevert();vault.executeBuyback(1,1,block.timestamp+600);
 }
 // ---- maintenance treasury ----
 function testAnyoneCanFundMaintenance() public {
  vm.prank(bob);vault.fundMaintenance{value:1 ether}(address(nft));
  assertEq(vault.maintenance(address(nft)),0.9 ether);assertEq(vault.maintenancePool(),0.1 ether);
  vm.expectRevert();vm.prank(bob);vault.fundMaintenance{value:1 ether}(address(0xdead));
  vm.expectRevert();vm.prank(bob);vault.fundMaintenance{value:0}(address(nft));
 }
 function testUpkeepDebitIsCappedOncePerEpochAndRoleGated() public {
  vm.prank(bob);vault.fundMaintenance{value:0.01 ether}(address(nft));
  vm.expectRevert();vm.prank(bob);vault.debitUpkeep(address(nft),0.0005 ether);
  vm.expectRevert();vm.prank(keeper);vault.debitUpkeep(address(nft),0.002 ether);
  vm.prank(keeper);vault.debitUpkeep(address(nft),0.0005 ether);
  assertEq(vault.maintenance(address(nft)),0.009 ether-0.0005 ether);assertEq(vault.claimable(address(this)),0.0005 ether);
  vm.expectRevert();vm.prank(keeper);vault.debitUpkeep(address(nft),0.0005 ether);
  vm.warp(block.timestamp+1 days);vm.prank(keeper);vault.debitUpkeep(address(nft),0.0005 ether);
 }
 function testUpkeepFallsBackToSharedPool() public {
  UPICCollection other=createFor(alice,2,address(0xCAFE));
  vm.prank(bob);vault.fundMaintenance{value:0.005 ether}(address(nft)); // pool gets 0.0005
  vm.prank(bob);vault.fundMaintenance{value:0.0001 ether}(address(other)); // other: 0.00009, pool +0.00001
  vm.prank(keeper);(uint256 fromCollection,uint256 fromPool)=vault.debitUpkeep(address(other),0.0003 ether);
  assertEq(fromCollection,0.00009 ether);assertEq(fromPool,0.00021 ether);assertEq(vault.maintenance(address(other)),0);
 }
 function testCadenceSignalOncePerDayAndHibernationNeedsSnapshot() public {
  vm.expectRevert();vm.prank(bob);nft.signalEpoch(1,"");
  vm.expectRevert();vm.prank(keeper);nft.signalEpoch(3,"");
  vm.prank(keeper);nft.signalEpoch(1,"");assertEq(nft.cadence(),1);
  vm.expectRevert();vm.prank(keeper);nft.signalEpoch(2,"");
  vm.warp(block.timestamp+1 days);vm.prank(keeper);nft.signalEpoch(3,"ipfs://final");assertEq(nft.cadence(),3);assertEq(nft.hibernationSnapshot(),"ipfs://final");
 }
 function testCollectionsCannotBeReinitialized() public {
  vm.expectRevert();nft.initialize(bob,address(vault),bytes32(0),"x","x",1,100000*1e8,bytes32(uint256(1)),"e","g",1);
  UPICCollection impl=UPICCollection(payable(factory.implementation()));
  vm.expectRevert();impl.initialize(bob,address(vault),bytes32(0),"x","x",1,100000*1e8,bytes32(uint256(1)),"e","g",1);
 }
 function testSourceChainsConfigurable() public {
  assertTrue(factory.sourceChains(8453));factory.setSourceChain(4663,true);assertTrue(factory.sourceChains(4663));
  vm.expectRevert();vm.prank(bob);factory.setSourceChain(1,false);
 }
}

/// Random sequences of mints, sales, royalties, funding, upkeep and claims must keep the vault solvent.
contract Handler is Base {
 address[] internal actors;
 constructor(){deploy();actors.push(alice);actors.push(bob);actors.push(address(0xA11));actors.push(address(0xB22));for(uint256 i;i<actors.length;i++)vm.deal(actors[i],1000 ether);}
 uint256 public mints;
 function doMint(uint256 seed) external {if(nft.minted()>=100)return;uint8 next=uint8(nft.minted()+1);address to=actors[seed%actors.length];this.mintExternal(next,to);mints++;}
 function mintExternal(uint8 edition,address to) external {mintOn(nft,edition,to,nft.currentPrice()+edition);} // small overpayment exercises refunds
 function doSale(uint96 price) external {uint256 p=bound(price,1,10 ether);vm.deal(address(market),p);vm.prank(address(market));vault.secondary{value:p}(address(nft),bob,p);}
 function doRoyalty(uint96 value) external {uint256 v=bound(value,1,1 ether);vm.deal(bob,v);vm.prank(bob);(bool ok,)=address(nft).call{value:v}("");require(ok);}
 function doFund(uint96 value) external {uint256 v=bound(value,1,1 ether);vm.deal(bob,v);vm.prank(bob);vault.fundMaintenance{value:v}(address(nft));}
 function doUpkeep(uint256 amount,uint256 jump) external {vm.warp(block.timestamp+bound(jump,0,2 days));uint256 a=bound(amount,1,vault.maxUpkeepPerEpoch());vm.prank(keeper);try vault.debitUpkeep(address(nft),a) {} catch {}}
 function doClaim(uint256 who) external {address a=who%2==0?alice:address(this);if(vault.claimable(a)==0)return;vm.prank(a);vault.claim(payable(address(0xC1A1)));}
 function v() external view returns(RevenueVault){return vault;}
}

contract InvariantTest is Test {
 Handler handler;
 function setUp() public {handler=new Handler();targetContract(address(handler));bytes4[] memory s=new bytes4[](6);s[0]=Handler.doMint.selector;s[1]=Handler.doSale.selector;s[2]=Handler.doRoyalty.selector;s[3]=Handler.doFund.selector;s[4]=Handler.doUpkeep.selector;s[5]=Handler.doClaim.selector;targetSelector(FuzzSelector({addr:address(handler),selectors:s}));}
 function invariant_vaultCoversObligations() public view {RevenueVault vault=handler.v();assertEq(address(vault).balance,vault.obligations());}
 function invariant_maintenanceTotalsConsistent() public view {RevenueVault vault=handler.v();assertGe(vault.totalMaintenance(),vault.maintenancePool());}
}
