// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IBurnable {function burn(uint256 amount) external;}
interface IUPICSwap {function swap(address token,uint256 minOut,uint256 deadline) external payable returns(uint256);}
contract BuybackExecutor is ReentrancyGuard {
    address public immutable vault;address public immutable router;address public immutable token;
    constructor(address vault_,address router_,address token_){require(vault_!=address(0)&&router_!=address(0)&&token_!=address(0));vault=vault_;router=router_;token=token_;}
    function execute(uint256 minOut,uint256 deadline) external payable nonReentrant returns(uint256 received){
        require(msg.sender==vault&&deadline>=block.timestamp&&minOut>0);
        uint256 beforeBalance=IERC20(token).balanceOf(address(this));
        IUPICSwap(router).swap{value:msg.value}(token,minOut,deadline);
        received=IERC20(token).balanceOf(address(this))-beforeBalance;require(received>=minOut);
        IBurnable(token).burn(received);
    }
}
