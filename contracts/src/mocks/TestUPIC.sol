// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
contract TestUPIC is ERC20,ERC20Burnable {
    mapping(address=>uint256) public lastFaucet;
    constructor() ERC20("TEST ONLY UPIC","tUPIC"){require(block.chainid==31337||block.chainid==46630,"testnet-only");}
    function faucet(address to,uint256 amount) external {require(to==msg.sender&&amount<=10000 ether&&block.timestamp>=lastFaucet[to]+1 hours);lastFaucet[to]=block.timestamp;_mint(to,amount);}
}
