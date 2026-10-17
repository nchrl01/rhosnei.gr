// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUPICFactory {
    function mintSigner() external view returns (address);
    function verifier() external view returns (address);
    function admin() external view returns (address);
    function paused() external view returns (bool);
}
interface IRevenueVault {function primary() external payable;function royalty() external payable;}

contract UPICCollection is ERC721, ERC2981, EIP712, ReentrancyGuard {
    uint256 public constant PRICE = 0.05 ether;
    bytes32 public constant MINT_TYPEHASH = keccak256("Mint(address recipient,uint8 edition,uint8 stage,string uri,uint256 nonce,uint256 deadline)");
    bytes32 public constant EVOLUTION_TYPEHASH = keccak256("Evolution(uint8 next,uint256 cap,bytes32 evidenceHash,string evidenceURI,uint256 nonce,uint256 deadline)");
    struct Mint {address recipient;uint8 edition;uint8 stage;string uri;uint256 nonce;uint256 deadline;}
    address public factory;
    address public initiator;
    address public vault;
    bytes32 public assetKey;
    uint8 public stage;
    uint256 public highestVerifiedCap;
    uint256 public minted;
    string private title;
    string private ticker;
    mapping(uint256 => bool) public nonces;
    mapping(uint256 => uint256) public transferNonce;
    mapping(uint256 => uint8) public mediaStage;
    mapping(uint256 => mapping(uint8 => string)) public archives;
    mapping(uint8 => bytes32) public evidenceHashes;
    mapping(uint8 => string) public evidenceURIs;
    event Evolution(uint8 indexed stage,uint256 cap,bytes32 evidenceHash,string evidenceURI);
    event MediaPublished(uint256 indexed tokenId,uint8 stage,string uri);
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId,uint256 _toTokenId);
    error Invalid();error Unauthorized();
    constructor() ERC721("UPIC implementation","UPIC") EIP712("UPIC Collection","1") {factory=address(1);}
    function initialize(address creator,address revenueVault,bytes32 key,string calldata collectionName,string calldata collectionSymbol,uint8 initialStage,uint256 cap,bytes32 digest,string calldata evidenceURI,string calldata genesisURI) external {
        if(factory!=address(0)||creator==address(0)||revenueVault==address(0)||bytes(genesisURI).length==0||initialStage!=stageFor(cap))revert Invalid();
        factory=msg.sender;initiator=creator;vault=revenueVault;assetKey=key;title=collectionName;ticker=collectionSymbol;
        stage=initialStage;highestVerifiedCap=cap;evidenceHashes[initialStage]=digest;evidenceURIs[initialStage]=evidenceURI;
        archives[1][initialStage]=genesisURI;mediaStage[1]=initialStage;minted=1;
        _setDefaultRoyalty(address(this),450);_safeMint(creator,1);
        emit MediaPublished(1,initialStage,genesisURI);emit Evolution(initialStage,cap,digest,evidenceURI);
    }
    function name() public view override returns(string memory){return title;}
    function symbol() public view override returns(string memory){return ticker;}
    function seedOf(uint256 id) public view returns(bytes32){if(id<1||id>100)revert Invalid();return keccak256(abi.encode("upic-nft-v1",block.chainid,factory,assetKey,id));}
    function tokenURI(uint256 id) public view override returns(string memory){_requireOwned(id);return archives[id][mediaStage[id]];}
    function mint(Mint calldata a,bytes calldata signature) external payable nonReentrant {
        if(IUPICFactory(factory).paused()||a.recipient!=msg.sender||a.edition<2||a.edition>100||a.stage!=stage||a.deadline<block.timestamp||nonces[a.nonce]||_ownerOf(a.edition)!=address(0)||minted>=100||msg.value!=PRICE||bytes(a.uri).length==0)revert Invalid();
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(MINT_TYPEHASH,a.recipient,a.edition,a.stage,keccak256(bytes(a.uri)),a.nonce,a.deadline)));
        if(!SignatureChecker.isValidSignatureNow(IUPICFactory(factory).mintSigner(),digest,signature))revert Unauthorized();
        nonces[a.nonce]=true;minted++;archives[a.edition][stage]=a.uri;mediaStage[a.edition]=stage;
        IRevenueVault(vault).primary{value:msg.value}();_safeMint(a.recipient,a.edition);emit MediaPublished(a.edition,stage,a.uri);
    }
    function evolve(uint8 next,uint256 cap,bytes32 evidenceHash,string calldata evidenceURI,uint256 nonce,uint256 deadline,bytes calldata signature) external nonReentrant {
        if(IUPICFactory(factory).paused()||next<=stage||next>8||stageFor(cap)<next||cap<highestVerifiedCap||deadline<block.timestamp||nonces[nonce]||bytes(evidenceURI).length==0||evidenceHash==bytes32(0))revert Invalid();
        bytes32 digest=_hashTypedDataV4(keccak256(abi.encode(EVOLUTION_TYPEHASH,next,cap,evidenceHash,keccak256(bytes(evidenceURI)),nonce,deadline)));
        if(!SignatureChecker.isValidSignatureNow(IUPICFactory(factory).verifier(),digest,signature))revert Unauthorized();
        nonces[nonce]=true;stage=next;highestVerifiedCap=cap;evidenceHashes[next]=evidenceHash;evidenceURIs[next]=evidenceURI;
        emit Evolution(next,cap,evidenceHash,evidenceURI);emit BatchMetadataUpdate(1,100);
    }
    function publishMetadata(uint256[] calldata ids,uint8 next,string[] calldata uris) external {
        if(msg.sender!=IUPICFactory(factory).mintSigner())revert Unauthorized();
        if(ids.length!=uris.length||ids.length>100||next>stage)revert Invalid();
        for(uint256 i;i<ids.length;i++){
            _requireOwned(ids[i]);if(bytes(uris[i]).length==0||bytes(archives[ids[i]][next]).length!=0)revert Invalid();
            archives[ids[i]][next]=uris[i];if(next>mediaStage[ids[i]])mediaStage[ids[i]]=next;
            emit MediaPublished(ids[i],next,uris[i]);emit MetadataUpdate(ids[i]);
        }
    }
    function stageFor(uint256 cap) public pure returns(uint8){uint256[8] memory t=[uint256(100000),500000,1000000,2000000,5000000,10000000,25000000,50000000];uint8 s;for(uint256 i;i<8;i++)if(cap>=t[i]*1e8)s++;return s;}
    function _update(address to,uint256 id,address auth) internal override returns(address){address from=super._update(to,id,auth);transferNonce[id]++;return from;}
    function supportsInterface(bytes4 id) public view override(ERC721,ERC2981) returns(bool){return id==0x49064906||super.supportsInterface(id);}
    receive() external payable {IRevenueVault(vault).royalty{value:msg.value}();}
}
