// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IBuyback {function execute(uint256 minOut,uint256 deadline) external payable returns(uint256);}
interface IVaultFactory {function paused() external view returns(bool);}

/// Pull-payment revenue accounting with a per-collection maintenance treasury.
/// Maintenance balances pay for keeping each collection's living art updated.
/// Every maintenance inflow sends POOL_SHARE to a shared pool that tops up
/// underfunded collections, so low-priced collections slow down instead of dying.
contract RevenueVault is Ownable2Step,ReentrancyGuard {
    uint256 public constant BPS=10_000;
    // Primary sale split. Buyback receives the remainder (20%).
    uint256 public constant PRIMARY_INITIATOR=3_000;
    uint256 public constant PRIMARY_PROTOCOL=2_500;
    uint256 public constant PRIMARY_MAINTENANCE=2_500;
    // Secondary sale: 5% ERC-2981 royalty (2% initiator, 2% maintenance, 1% buyback) plus a 1% protocol fee.
    uint256 public constant SALE_INITIATOR=200;
    uint256 public constant SALE_MAINTENANCE=200;
    uint256 public constant SALE_BUYBACK=100;
    uint256 public constant SALE_PROTOCOL=100;
    uint256 public constant SALE_FEE=SALE_INITIATOR+SALE_MAINTENANCE+SALE_BUYBACK+SALE_PROTOCOL;
    uint256 public constant ROYALTY_BPS=SALE_INITIATOR+SALE_MAINTENANCE+SALE_BUYBACK;
    uint256 public constant POOL_SHARE=1_000;
    uint256 public constant EPOCH=1 days;

    address public immutable protocol;
    address public factory;
    address public marketplace;
    address public executor;
    address public upkeeper;
    uint256 public maxUpkeepPerEpoch;
    mapping(address=>address) public initiators;
    mapping(address=>uint256) public claimable;
    mapping(address=>uint256) public maintenance;
    mapping(address=>uint256) public lastUpkeepEpoch;
    uint256 public maintenancePool;
    uint256 public totalMaintenance;
    uint256 public buybackReserve;
    uint256 public totalClaims;

    event Claimed(address indexed account,address indexed to,uint256 value);
    event Allocated(address indexed collection,uint256 initiator,uint256 protocol,uint256 maintenance,uint256 buyback,uint256 seller);
    event MaintenanceFunded(address indexed collection,address indexed from,uint256 toCollection,uint256 toPool);
    event UpkeepDebited(address indexed collection,uint256 indexed epoch,uint256 fromCollection,uint256 fromPool);
    event UpkeeperChanged(address upkeeper,uint256 maxPerEpoch);
    event BuybackExecuted(uint256 spent,uint256 burned);
    error Invalid();error Unauthorized();

    constructor(address owner_,address protocol_) Ownable(owner_){if(protocol_==address(0))revert Invalid();protocol=protocol_;}

    function configure(address factory_,address marketplace_,address executor_) external onlyOwner {
        if(factory!=address(0)||factory_==address(0)||marketplace_==address(0)||executor_==address(0))revert Invalid();
        factory=factory_;marketplace=marketplace_;executor=executor_;
    }
    function setUpkeeper(address upkeeper_,uint256 maxPerEpoch) external onlyOwner {upkeeper=upkeeper_;maxUpkeepPerEpoch=maxPerEpoch;emit UpkeeperChanged(upkeeper_,maxPerEpoch);}
    function register(address collection,address creator) external {if(msg.sender!=factory||creator==address(0)||initiators[collection]!=address(0))revert Unauthorized();initiators[collection]=creator;}

    function _maintain(address collection,address from,uint256 amount) internal {
        if(amount==0)return;
        uint256 pool=amount*POOL_SHARE/BPS;
        maintenance[collection]+=amount-pool;maintenancePool+=pool;totalMaintenance+=amount;
        emit MaintenanceFunded(collection,from,amount-pool,pool);
    }
    function _credit(address collection,uint256 a,uint256 p,uint256 m,uint256 b,address seller,uint256 s) internal {
        address creator=initiators[collection];if(creator==address(0))revert Invalid();
        claimable[creator]+=a;claimable[protocol]+=p;if(s>0)claimable[seller]+=s;
        totalClaims+=a+p+s;buybackReserve+=b;_maintain(collection,collection,m);
        emit Allocated(collection,a,p,m,b,s);
    }
    /// Primary mint revenue, sent by the collection itself.
    function primary() external payable {
        uint256 v=msg.value;uint256 a=v*PRIMARY_INITIATOR/BPS;uint256 p=v*PRIMARY_PROTOCOL/BPS;uint256 m=v*PRIMARY_MAINTENANCE/BPS;
        _credit(msg.sender,a,p,m,v-a-p-m,address(0),0);
    }
    /// ERC-2981 royalties paid by external venues to the collection, forwarded here.
    function royalty() external payable {
        uint256 v=msg.value;uint256 a=v*SALE_INITIATOR/ROYALTY_BPS;uint256 m=v*SALE_MAINTENANCE/ROYALTY_BPS;
        _credit(msg.sender,a,0,m,v-a-m,address(0),0);
    }
    function secondary(address collection,address seller,uint256 salePrice) external payable {
        if(msg.sender!=marketplace||msg.value!=salePrice||seller==address(0))revert Unauthorized();
        uint256 a=salePrice*SALE_INITIATOR/BPS;uint256 m=salePrice*SALE_MAINTENANCE/BPS;uint256 b=salePrice*SALE_BUYBACK/BPS;uint256 p=salePrice*SALE_PROTOCOL/BPS;
        _credit(collection,a,p,m,b,seller,salePrice-a-m-b-p);
    }
    /// Anyone (holders, initiators, sponsors) can extend a collection's runway.
    function fundMaintenance(address collection) external payable {
        if(msg.value==0||initiators[collection]==address(0))revert Invalid();
        _maintain(collection,msg.sender,msg.value);
    }
    /// Charges one epoch of actual upkeep cost. Bounded per collection per day and logged on-chain.
    function debitUpkeep(address collection,uint256 amount) external nonReentrant returns(uint256 fromCollection,uint256 fromPool){
        if(msg.sender!=upkeeper||upkeeper==address(0))revert Unauthorized();
        uint256 epoch=block.timestamp/EPOCH;
        if(amount==0||amount>maxUpkeepPerEpoch||initiators[collection]==address(0)||lastUpkeepEpoch[collection]>=epoch)revert Invalid();
        fromCollection=amount<=maintenance[collection]?amount:maintenance[collection];
        fromPool=amount-fromCollection;if(fromPool>maintenancePool)revert Invalid();
        lastUpkeepEpoch[collection]=epoch;maintenance[collection]-=fromCollection;maintenancePool-=fromPool;
        totalMaintenance-=amount;claimable[protocol]+=amount;totalClaims+=amount;
        emit UpkeepDebited(collection,epoch,fromCollection,fromPool);
    }
    function claim(address payable to) external nonReentrant {
        uint256 amount=claimable[msg.sender];if(amount==0||to==address(0))revert Invalid();claimable[msg.sender]=0;totalClaims-=amount;
        (bool success,)=to.call{value:amount}("");if(!success)revert Invalid();emit Claimed(msg.sender,to,amount);
    }
    function executeBuyback(uint256 amount,uint256 minOut,uint256 deadline) external onlyOwner nonReentrant {
        if(amount==0||amount>buybackReserve||deadline<block.timestamp||minOut==0||IVaultFactory(factory).paused())revert Invalid();
        buybackReserve-=amount;uint256 burned=IBuyback(executor).execute{value:amount}(minOut,deadline);emit BuybackExecuted(amount,burned);
    }
    /// Liabilities the contract must always cover.
    function obligations() external view returns(uint256){return totalClaims+buybackReserve+totalMaintenance;}
}
