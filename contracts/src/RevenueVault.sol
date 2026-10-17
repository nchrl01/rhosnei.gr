// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IBuyback {function execute(uint256 minOut,uint256 deadline) external payable returns(uint256);}
interface IVaultFactory {function paused() external view returns(bool);}
contract RevenueVault is Ownable2Step,ReentrancyGuard {
    address public immutable protocol;
    address public factory;
    address public marketplace;
    address public executor;
    mapping(address=>address) public initiators;
    mapping(address=>uint256) public claimable;
    uint256 public buybackReserve;
    uint256 public totalClaims;
    event Claimed(address indexed account,address indexed to,uint256 value);
    event Allocated(address indexed collection,uint256 initiator,uint256 protocol,uint256 buyback,uint256 seller);
    event BuybackExecuted(uint256 spent,uint256 burned);
    error Invalid();error Unauthorized();
    constructor(address owner_,address protocol_) Ownable(owner_){if(protocol_==address(0))revert Invalid();protocol=protocol_;}
    function configure(address factory_,address marketplace_,address executor_) external onlyOwner {if(factory!=address(0)||factory_==address(0)||marketplace_==address(0)||executor_==address(0))revert Invalid();factory=factory_;marketplace=marketplace_;executor=executor_;}
    function register(address collection,address creator) external {if(msg.sender!=factory||creator==address(0)||initiators[collection]!=address(0))revert Unauthorized();initiators[collection]=creator;}
    function _credit(address collection,uint256 a,uint256 p,uint256 b,address seller,uint256 s) internal {
        address creator=initiators[collection];if(creator==address(0))revert Invalid();
        claimable[creator]+=a;claimable[protocol]+=p;if(s>0)claimable[seller]+=s;
        totalClaims+=a+p+s;buybackReserve+=b;emit Allocated(collection,a,p,b,s);
    }
    function primary() external payable {uint256 b=msg.value/2;uint256 a=msg.value/4;_credit(msg.sender,a,msg.value-b-a,b,address(0),0);}
    function royalty() external payable {uint256 a=msg.value*125/450;uint256 p=msg.value*125/450;_credit(msg.sender,a,p,msg.value-a-p,address(0),0);}
    function secondary(address collection,address seller,uint256 salePrice) external payable {
        if(msg.sender!=marketplace||msg.value!=salePrice||seller==address(0))revert Unauthorized();
        uint256 fee=salePrice*450/10000;uint256 a=salePrice*125/10000;uint256 p=salePrice*125/10000;
        _credit(collection,a,p,fee-a-p,seller,salePrice-fee);
    }
    function claim(address payable to) external nonReentrant {
        uint256 amount=claimable[msg.sender];if(amount==0||to==address(0))revert Invalid();claimable[msg.sender]=0;totalClaims-=amount;
        (bool success,)=to.call{value:amount}("");if(!success)revert Invalid();emit Claimed(msg.sender,to,amount);
    }
    function executeBuyback(uint256 amount,uint256 minOut,uint256 deadline) external onlyOwner nonReentrant {
        if(amount==0||amount>buybackReserve||deadline<block.timestamp||minOut==0||IVaultFactory(factory).paused())revert Invalid();
        buybackReserve-=amount;uint256 burned=IBuyback(executor).execute{value:amount}(minOut,deadline);emit BuybackExecuted(amount,burned);
    }
}
