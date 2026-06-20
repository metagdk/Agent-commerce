// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IIdentityRegistry {
    function register(bytes32 _agentId, string memory _name, string memory _agentType, string memory _metadataURI) external returns (uint256 tokenId);
    function getAgentId(uint256 tokenId) external view returns (bytes32);
    function getTokenId(bytes32 agentId) external view returns (uint256);
    function updateMetadata(bytes32 agentId, string memory _metadataURI) external;
    function getAgent(bytes32 agentId) external view returns (address owner, string memory name, string memory agentType, string memory metadataURI, bool active);
    function agentCount() external view returns (uint256);
    function isRegistered(bytes32 agentId) external view returns (bool);
}

interface IReputationRegistry {
    function submitFeedback(bytes32 agentId, uint8 score, string memory comment) external;
    function getReputation(bytes32 agentId) external view returns (uint256 totalScore, uint256 count, uint256 averageScore);
    function getFeedback(bytes32 agentId, uint256 index) external view returns (address reviewer, uint8 score, string memory comment, uint256 timestamp);
    function getFeedbackCount(bytes32 agentId) external view returns (uint256);
    function authorizeReviewer(bytes32 agentId, address reviewer) external;
    function revokeReviewer(bytes32 agentId, address reviewer) external;
}

interface IValidationRegistry {
    function submitValidation(bytes32 agentId, bytes32 taskId, bool passed, string memory reportURI) external;
    function getValidation(bytes32 agentId, uint256 index) external view returns (address validator, bytes32 taskId, bool passed, string memory reportURI, uint256 timestamp);
    function getValidationCount(bytes32 agentId) external view returns (uint256);
    function getPassRate(bytes32 agentId) external view returns (uint256 passCount, uint256 totalCount, uint256 rate);
}
