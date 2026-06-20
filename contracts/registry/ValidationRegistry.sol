// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IERC8004.sol";

contract ValidationRegistry is Ownable, IValidationRegistry {
    struct Validation {
        address validator;
        bytes32 taskId;
        bool passed;
        string reportURI;
        uint256 timestamp;
    }

    mapping(bytes32 => Validation[]) private _validations;
    mapping(bytes32 => uint256) private _passCounts;
    mapping(bytes32 => uint256) private _totalCounts;

    event ValidationSubmitted(bytes32 indexed agentId, bytes32 indexed taskId, address indexed validator, bool passed);

    constructor() Ownable(msg.sender) {}

    function submitValidation(bytes32 agentId, bytes32 taskId, bool passed, string memory reportURI) external {
        _validations[agentId].push(Validation(msg.sender, taskId, passed, reportURI, block.timestamp));
        _totalCounts[agentId]++;
        if (passed) _passCounts[agentId]++;
        emit ValidationSubmitted(agentId, taskId, msg.sender, passed);
    }

    function getValidation(bytes32 agentId, uint256 index) external view returns (address validator, bytes32 taskId, bool passed, string memory reportURI, uint256 timestamp) {
        require(index < _validations[agentId].length, "Validation does not exist");
        Validation storage v = _validations[agentId][index];
        return (v.validator, v.taskId, v.passed, v.reportURI, v.timestamp);
    }

    function getValidationCount(bytes32 agentId) external view returns (uint256) {
        return _validations[agentId].length;
    }

    function getPassRate(bytes32 agentId) external view returns (uint256 passCount, uint256 totalCount, uint256 rate) {
        passCount = _passCounts[agentId];
        totalCount = _totalCounts[agentId];
        rate = totalCount > 0 ? (passCount * 100) / totalCount : 0;
    }
}
