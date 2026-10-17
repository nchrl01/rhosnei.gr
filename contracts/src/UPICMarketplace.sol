// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UPICCollection} from "./UPICCollection.sol";
import {RevenueVault} from "./RevenueVault.sol";
interface IMarketFactory {function paused() external view returns(bool);}
contract UPICMarketplace is EIP712,ReentrancyGuard {
    struct Order {address seller;address collection;uint256 tokenId;uint256 price;uint256 expiry;uint256 nonce;uint256 ownershipNonce;}
    bytes32 public constant ORDER_TYPEHASH=keccak256("Order(address seller,address collection,uint256 tokenId,uint256 price,uint256 expiry,uint256 nonce,uint256 ownershipNonce)");
    RevenueVault public immutable vault;
    mapping(address=>mapping(uint256=>bool)) public used;
    event Sale(address indexed collection,uint256 indexed tokenId,address indexed seller,address buyer,uint256 price,uint256 nonce);
    event Cancelled(address indexed seller,uint256 nonce);
    error Invalid();
    constructor(address vault_) EIP712("UPIC Marketplace","1"){vault=RevenueVault(vault_);}
    function cancel(uint256 nonce) external {used[msg.sender][nonce]=true;emit Cancelled(msg.sender,nonce);}
    function purchase(Order calldata o,bytes calldata signature) external payable nonReentrant {
        if(IMarketFactory(vault.factory()).paused()||o.price==0||msg.value!=o.price||block.timestamp>o.expiry||used[o.seller][o.nonce]||vault.initiators(o.collection)==address(0))revert Invalid();
        UPICCollection nft=UPICCollection(payable(o.collection));
        if(nft.ownerOf(o.tokenId)!=o.seller||nft.transferNonce(o.tokenId)!=o.ownershipNonce)revert Invalid();
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(ORDER_TYPEHASH,o.seller,o.collection,o.tokenId,o.price,o.expiry,o.nonce,o.ownershipNonce)));
        if(!SignatureChecker.isValidSignatureNow(o.seller,digest,signature))revert Invalid();
        used[o.seller][o.nonce]=true;nft.safeTransferFrom(o.seller,msg.sender,o.tokenId);
        vault.secondary{value:msg.value}(o.collection,o.seller,o.price);emit Sale(o.collection,o.tokenId,o.seller,msg.sender,o.price,o.nonce);
    }
}
