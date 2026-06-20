// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC8004.sol";

contract IdentityRegistry is ERC721URIStorage, Ownable, IIdentityRegistry {
    uint256 private _nextTokenId;
    uint256 private _agentCount;

    struct Agent {
        bytes32 agentId;
        string name;
        string agentType;
        string metadataURI;
        bool active;
    }

    mapping(bytes32 => uint256) private _agentIdToToken;
    mapping(uint256 => Agent) private _tokenToAgent;
    mapping(bytes32 => bool) private _registeredIds;

    event AgentRegistered(bytes32 indexed agentId, uint256 indexed tokenId, address indexed owner, string name);
    event AgentMetadataUpdated(bytes32 indexed agentId, string metadataURI);
    event AgentDeactivated(bytes32 indexed agentId);

    constructor() ERC721("Agent Identity", "AGENT") Ownable(msg.sender) {}

    function register(
        bytes32 _agentId,
        string memory _name,
        string memory _agentType,
        string memory _metadataURI
    ) external returns (uint256 tokenId) {
        require(!_registeredIds[_agentId], "Agent ID already registered");
        tokenId = ++_nextTokenId;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _metadataURI);

        _agentIdToToken[_agentId] = tokenId;
        _tokenToAgent[tokenId] = Agent(_agentId, _name, _agentType, _metadataURI, true);
        _registeredIds[_agentId] = true;
        _agentCount++;

        emit AgentRegistered(_agentId, tokenId, msg.sender, _name);
    }

    function updateMetadata(bytes32 _agentId, string memory _metadataURI) external {
        uint256 tokenId = _getTokenIdOrRevert(_agentId);
        require(_ownerOf(tokenId) == msg.sender, "Not agent owner");
        _tokenToAgent[tokenId].metadataURI = _metadataURI;
        _setTokenURI(tokenId, _metadataURI);
        emit AgentMetadataUpdated(_agentId, _metadataURI);
    }

    function deactivate(bytes32 _agentId) external {
        uint256 tokenId = _getTokenIdOrRevert(_agentId);
        require(_ownerOf(tokenId) == msg.sender, "Not agent owner");
        _tokenToAgent[tokenId].active = false;
        _agentCount--;
        emit AgentDeactivated(_agentId);
    }

    function getAgentId(uint256 tokenId) external view returns (bytes32) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return _tokenToAgent[tokenId].agentId;
    }

    function getTokenId(bytes32 agentId) external view returns (uint256) {
        return _getTokenIdOrRevert(agentId);
    }

    function getAgent(bytes32 agentId) external view returns (address owner, string memory name, string memory agentType, string memory metadataURI, bool active) {
        uint256 tokenId = _getTokenIdOrRevert(agentId);
        Agent memory a = _tokenToAgent[tokenId];
        return (_ownerOf(tokenId), a.name, a.agentType, a.metadataURI, a.active);
    }

    function agentCount() external view returns (uint256) {
        return _agentCount;
    }

    function isRegistered(bytes32 agentId) external view returns (bool) {
        return _registeredIds[agentId];
    }

    function _getTokenIdOrRevert(bytes32 agentId) private view returns (uint256) {
        uint256 tokenId = _agentIdToToken[agentId];
        require(tokenId != 0, "Agent not registered");
        return tokenId;
    }
}
