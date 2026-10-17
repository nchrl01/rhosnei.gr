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
contract ProtocolTest is Test {
 uint256 constant SIGNER_KEY=123;address signer;address alice;address bob;
 UPICFactory factory;UPICCollection nft;RevenueVault vault;UPICMarketplace market;BuybackExecutor executor;TestUPIC token;TestExchange router;
 function setUp() public {
  vm.chainId(31337);vm.warp(100000);signer=vm.addr(SIGNER_KEY);alice=vm.addr(456);bob=vm.addr(789);vm.deal(address(this),100 ether);
  token=new TestUPIC();vault=new RevenueVault(address(this),address(this));router=new TestExchange(address(token));executor=new BuybackExecutor(address(vault),address(router),address(token));market=new UPICMarketplace(address(vault));factory=new UPICFactory(address(this),address(token),address(vault),signer,signer);vault.configure(address(factory),address(market),address(executor));
  vm.prank(alice);token.faucet(alice,1000 ether);vm.deal(alice,10 ether);vm.deal(bob,10 ether);nft=create(alice,1);
 }
 function digest(address target,string memory name,bytes32 structHash) internal view returns(bytes32){bytes32 d=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256(bytes(name)),keccak256("1"),block.chainid,target));return keccak256(abi.encodePacked("\x19\x01",d,structHash));}
 function sig(bytes32 hash,uint256 key) internal pure returns(bytes memory){(uint8 v,bytes32 r,bytes32 s)=vm.sign(key,hash);return abi.encodePacked(r,s,v);}
 function create(address creator,uint256 nonce) internal returns(UPICCollection){
  UPICFactory.Create memory c=UPICFactory.Create(31337,address(token),creator,1,100000*1e8,bytes32(uint256(1)),"ipfs://evidence","ipfs://genesis","UPIC Test","UPIC",nonce,block.timestamp+600);
  bytes32 h=keccak256(abi.encode(factory.CREATE_TYPEHASH(),c.sourceChain,c.token,c.initiator,c.stage,c.cap,c.evidenceHash,keccak256(bytes(c.evidenceURI)),keccak256(bytes(c.genesisURI)),keccak256(bytes(c.name)),keccak256(bytes(c.symbol)),c.nonce,c.deadline));
  bytes memory signature=sig(digest(address(factory),"UPIC Factory",h),SIGNER_KEY);vm.prank(creator);return UPICCollection(payable(factory.create(c,signature)));
 }
 function mint(uint8 edition,address to) internal {
  UPICCollection.Mint memory m=UPICCollection.Mint(to,edition,nft.stage(),"ipfs://edition",edition,block.timestamp+600);
  bytes32 h=keccak256(abi.encode(nft.MINT_TYPEHASH(),m.recipient,m.edition,m.stage,keccak256(bytes(m.uri)),m.nonce,m.deadline));bytes memory signature=sig(digest(address(nft),"UPIC Collection",h),SIGNER_KEY);
  vm.prank(to);nft.mint{value:0.05 ether}(m,signature);
 }
 function testGenesisImmediateAndDuplicateRejected() public {assertEq(nft.ownerOf(1),alice);assertEq(nft.minted(),1);UPICFactory.Create memory c=UPICFactory.Create(31337,address(token),alice,1,100000*1e8,bytes32(uint256(1)),"ipfs://evidence","ipfs://genesis","UPIC Test","UPIC",2,block.timestamp+600);vm.expectRevert();vm.prank(alice);factory.create(c,hex"00");}
 function testPrimaryAccountingAndInitiatorTransfer() public {mint(2,bob);assertEq(vault.claimable(alice),0.0125 ether);assertEq(vault.buybackReserve(),0.025 ether);vm.prank(alice);nft.transferFrom(alice,bob,1);mint(3,bob);assertEq(vault.claimable(alice),0.025 ether);assertEq(nft.initiator(),alice);}
 function testMintCapAndSeeds() public {for(uint8 i=2;i<=100;i++)mint(i,alice);assertEq(nft.minted(),100);assertTrue(nft.seedOf(1)!=nft.seedOf(2));UPICCollection.Mint memory m=UPICCollection.Mint(bob,2,1,"ipfs://edition",999,block.timestamp+600);vm.expectRevert();vm.prank(bob);nft.mint{value:0.05 ether}(m,hex"00");}
 function testBuybackBurnDoesNotSpendClaims() public {mint(2,bob);token.faucet(address(this),10000 ether);token.transfer(address(router),1000 ether);uint256 supply=token.totalSupply();vault.executeBuyback(0.025 ether,25 ether,block.timestamp+600);assertEq(token.totalSupply(),supply-25 ether);assertEq(vault.claimable(alice),0.0125 ether);assertEq(vault.buybackReserve(),0);}
 function testFuzzFeeConservation(uint128 price) public {price=uint128(bound(price,1,1 ether));vm.prank(address(market));vault.secondary{value:price}(address(nft),bob,price);assertEq(vault.totalClaims()+vault.buybackReserve(),price);}
 function invariantSolvent() public view {assertGe(address(vault).balance,vault.totalClaims()+vault.buybackReserve());}
 function testEvolutionPermanentAndDomainBound() public {
  bytes32 h=keccak256(abi.encode(nft.EVOLUTION_TYPEHASH(),uint8(6),uint256(10000000*1e8),bytes32(uint256(2)),keccak256("ipfs://proof"),uint256(500),block.timestamp+600));
  bytes memory signature=sig(digest(address(nft),"UPIC Collection",h),SIGNER_KEY);
  nft.evolve(6,10000000*1e8,bytes32(uint256(2)),"ipfs://proof",500,block.timestamp+600,signature);assertEq(nft.stage(),6);
  vm.expectRevert();nft.evolve(1,100000*1e8,bytes32(uint256(2)),"ipfs://proof",501,block.timestamp+600,signature);
 }
 function listing(uint256 nonce) internal returns(UPICMarketplace.Order memory o,bytes memory signature){
  o=UPICMarketplace.Order(alice,address(nft),1,1 ether,block.timestamp+600,nonce,nft.transferNonce(1));
  bytes32 h=keccak256(abi.encode(market.ORDER_TYPEHASH(),o.seller,o.collection,o.tokenId,o.price,o.expiry,o.nonce,o.ownershipNonce));
  signature=sig(digest(address(market),"UPIC Marketplace",h),456);
 }
 function testSignedMarketplaceSaleAndReplay() public {
  (UPICMarketplace.Order memory o,bytes memory signature)=listing(42);
  vm.prank(alice);nft.approve(address(market),1);vm.prank(bob);market.purchase{value:1 ether}(o,signature);
  assertEq(nft.ownerOf(1),bob);assertEq(vault.claimable(alice),0.9675 ether);assertEq(vault.claimable(address(this)),0.0125 ether);assertEq(vault.buybackReserve(),0.02 ether);
  vm.expectRevert();vm.prank(bob);market.purchase{value:1 ether}(o,signature);
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
  mint(2,bob);uint256 before=bob.balance;vm.prank(alice);vault.claim(payable(bob));
  assertEq(bob.balance,before+0.0125 ether);assertEq(vault.claimable(alice),0);assertEq(vault.totalClaims(),0.0125 ether);assertEq(vault.buybackReserve(),0.025 ether);
  vm.expectRevert();vm.prank(alice);vault.claim(payable(bob));
 }
 function testMetadataArchiveCannotBeOverwritten() public {
  uint256[] memory ids=new uint256[](1);ids[0]=1;string[] memory uris=new string[](1);uris[0]="ipfs://tampered";
  vm.expectRevert();vm.prank(signer);nft.publishMetadata(ids,1,uris);assertEq(nft.tokenURI(1),"ipfs://genesis");
 }
 function testPauseBlocksMintAndBuyback() public {
  factory.setPaused(true);UPICCollection.Mint memory m=UPICCollection.Mint(bob,2,1,"ipfs://edition",999,block.timestamp+600);
  vm.expectRevert();vm.prank(bob);nft.mint{value:0.05 ether}(m,hex"00");
  vm.expectRevert();vault.executeBuyback(1,1,block.timestamp+600);
 }
}
