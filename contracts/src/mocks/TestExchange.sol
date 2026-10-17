// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
contract TestExchange {
    using SafeERC20 for IERC20;address public immutable token;
    constructor(address token_){require(block.chainid==31337||block.chainid==46630,"testnet-only");token=token_;}
    // Fixed rate, explicitly a funded test fixture, never a production price.
    function swap(address requested,uint256 minOut,uint256 deadline) external payable returns(uint256 amount){require(requested==token&&deadline>=block.timestamp);amount=msg.value*1000;require(amount>=minOut);IERC20(token).safeTransfer(msg.sender,amount);}
}
