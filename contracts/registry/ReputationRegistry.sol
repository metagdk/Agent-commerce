// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC8004.sol";

contract ReputationRegistry is Ownable, IReputationRegistry {
    struct Feedback {
        address reviewer;
        uint8 score;
        string comment;
        uint256 timestamp;
    }

    struct Reputation {
        uint256 totalScore;
        uint256 count;
        mapping(uint256 => Feedback) feedbacks;
    }

    mapping(bytes32 => Reputation) private _reputations;
    mapping(bytes32 => mapping(address => bool)) private _authorizedReviewers;
    mapping(bytes32 => uint256) private _feedbackCounts;

    event FeedbackSubmitted(bytes32 indexed agentId, address indexed reviewer, uint8 score);
    event ReviewerAuthorized(bytes32 indexed agentId, address indexed reviewer);
    event ReviewerRevoked(bytes32 indexed agentId, address indexed reviewer);

    constructor() Ownable(msg.sender) {}

    function authorizeReviewer(bytes32 agentId, address reviewer) external {
        _authorizedReviewers[agentId][reviewer] = true;
        emit ReviewerAuthorized(agentId, reviewer);
    }

    function revokeReviewer(bytes32 agentId, address reviewer) external {
        _authorizedReviewers[agentId][reviewer] = false;
        emit ReviewerRevoked(agentId, reviewer);
    }

    function submitFeedback(bytes32 agentId, uint8 score, string memory comment) external {
        require(score >= 1 && score <= 100, "Score must be 1-100");
        require(_authorizedReviewers[agentId][msg.sender], "Not authorized to review");
        Reputation storage rep = _reputations[agentId];
        uint256 index = rep.count;

        rep.feedbacks[index] = Feedback(msg.sender, score, comment, block.timestamp);
        rep.totalScore += score;
        rep.count++;
        _feedbackCounts[agentId]++;

        emit FeedbackSubmitted(agentId, msg.sender, score);
    }

    function getReputation(bytes32 agentId) external view returns (uint256 totalScore, uint256 count, uint256 averageScore) {
        Reputation storage rep = _reputations[agentId];
        return (rep.totalScore, rep.count, rep.count > 0 ? rep.totalScore / rep.count : 0);
    }

    function getFeedback(bytes32 agentId, uint256 index) external view returns (address reviewer, uint8 score, string memory comment, uint256 timestamp) {
        require(index < _reputations[agentId].count, "Feedback does not exist");
        Feedback storage f = _reputations[agentId].feedbacks[index];
        return (f.reviewer, f.score, f.comment, f.timestamp);
    }

    function getFeedbackCount(bytes32 agentId) external view returns (uint256) {
        return _reputationCount(agentId);
    }

    function _reputationCount(bytes32 agentId) private view returns (uint256) {
        return _reputations[agentId].count;
    }
}
