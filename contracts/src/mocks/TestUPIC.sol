// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
/// Valueless faucet token for local and testnet use only. Name and symbol are set per deployment
/// so staging can use a neutral label; keep "TEST" in the name so it can never pass as a real asset.
contract TestUPIC is ERC20,ERC20Burnable {
    mapping(address=>uint256) public lastFaucet;
    constructor(string memory name_,string memory symbol_) ERC20(name_,symbol_){require(block.chainid==31337||block.chainid==46630||block.chainid==421614,"testnet-only");}
    function faucet(address to,uint256 amount) external {require(to==msg.sender&&amount<=10000 ether&&block.timestamp>=lastFaucet[to]+1 hours);lastFaucet[to]=block.timestamp;_mint(to,amount);}
}
