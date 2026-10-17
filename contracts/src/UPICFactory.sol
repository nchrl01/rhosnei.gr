// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UPICCollection} from "./UPICCollection.sol";
interface IRegisterVault {function register(address collection,address initiator) external;}
contract UPICFactory is EIP712,Ownable2Step,ReentrancyGuard {
    struct Create {uint256 sourceChain;address token;address initiator;uint8 stage;uint256 cap;bytes32 evidenceHash;string evidenceURI;string genesisURI;string name;string symbol;uint256 nonce;uint256 deadline;}
    bytes32 public constant CREATE_TYPEHASH=keccak256("Create(uint256 sourceChain,address token,address initiator,uint8 stage,uint256 cap,bytes32 evidenceHash,string evidenceURI,string genesisURI,string name,string symbol,uint256 nonce,uint256 deadline)");
    address public immutable implementation;
    IERC20 public immutable upic;
    address public immutable vault;
    address public mintSigner;
    address public verifier;
    bool public paused;
    mapping(bytes32=>address) public collections;
    mapping(address=>mapping(uint256=>bool)) public nonces;
    event CollectionCreated(bytes32 indexed assetKey,address indexed collection,address indexed initiator,uint256 sourceChain,address token);
    event SignersChanged(address mintSigner,address verifier);
    error Invalid();error Unauthorized();
    constructor(address owner_,address token_,address vault_,address minter_,address verifier_) EIP712("UPIC Factory","1") Ownable(owner_){
        if(token_==address(0)||vault_==address(0)||minter_==address(0)||verifier_==address(0))revert Invalid();
        implementation=address(new UPICCollection());upic=IERC20(token_);vault=vault_;mintSigner=minter_;verifier=verifier_;
    }
    function admin() external view returns(address){return owner();}
    function setSigners(address minter_,address verifier_) external onlyOwner {if(minter_==address(0)||verifier_==address(0))revert Invalid();mintSigner=minter_;verifier=verifier_;emit SignersChanged(minter_,verifier_);}
    function setPaused(bool value) external onlyOwner {paused=value;}
    function key(uint256 sourceChain,address token) public pure returns(bytes32){return keccak256(abi.encode(sourceChain,token));}
    function predict(bytes32 asset) external view returns(address){return Clones.predictDeterministicAddress(implementation,asset);}
    function create(Create calldata a,bytes calldata signature) external nonReentrant returns(address collection){
        bool supported=a.sourceChain==1||a.sourceChain==56||a.sourceChain==8453||a.sourceChain==42161||(block.chainid==31337&&a.sourceChain==31337);
        bytes32 asset=key(a.sourceChain,a.token);
        if(paused||!supported||a.token==address(0)||a.initiator!=msg.sender||a.deadline<block.timestamp||nonces[msg.sender][a.nonce]||collections[asset]!=address(0)||upic.balanceOf(msg.sender)<500 ether||a.evidenceHash==bytes32(0)||bytes(a.evidenceURI).length==0||bytes(a.name).length>100||bytes(a.symbol).length>20)revert Invalid();
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(CREATE_TYPEHASH,a.sourceChain,a.token,a.initiator,a.stage,a.cap,a.evidenceHash,keccak256(bytes(a.evidenceURI)),keccak256(bytes(a.genesisURI)),keccak256(bytes(a.name)),keccak256(bytes(a.symbol)),a.nonce,a.deadline)));
        // Eligibility and initial stage must come from the blockchain verifier.
        if(!SignatureChecker.isValidSignatureNow(verifier,digest,signature))revert Unauthorized();
        nonces[msg.sender][a.nonce]=true;collection=Clones.cloneDeterministic(implementation,asset);collections[asset]=collection;
        IRegisterVault(vault).register(collection,a.initiator);
        UPICCollection(payable(collection)).initialize(a.initiator,vault,asset,a.name,a.symbol,a.stage,a.cap,a.evidenceHash,a.evidenceURI,a.genesisURI);
        emit CollectionCreated(asset,collection,a.initiator,a.sourceChain,a.token);
    }
}
