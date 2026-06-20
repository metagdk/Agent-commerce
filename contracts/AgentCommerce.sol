// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/IERC8004.sol";
import "./mocks/MockUSDC.sol";

contract AgentCommerce {
    IIdentityRegistry public identityRegistry;
    IReputationRegistry public reputationRegistry;
    IValidationRegistry public validationRegistry;
    MockUSDC public usdc;

    struct Allowance {
        uint256 dailyCap;
        uint256 usedToday;
        uint256 lastReset;
        uint256 totalSpent;
        uint256 maxPerTransaction;
        bool active;
    }

    struct Task {
        bytes32 taskId;
        bytes32 leadAgent;
        bytes32 specialistAgent;
        uint256 paymentAmount;
        string description;
        TaskStatus status;
        uint256 createdAt;
    }

    enum TaskStatus { Created, Assigned, Completed, Validated, Disputed }

    mapping(bytes32 => Allowance) public allowances;
    mapping(bytes32 => Task[]) public agentTasks;
    mapping(bytes32 => uint256) public taskCounts;
    mapping(bytes32 => Task) public tasks;
    bytes32[] public allTaskIds;

    event AllowanceSet(bytes32 indexed agentId, uint256 dailyCap, uint256 maxPerTransaction);
    event PaymentMade(bytes32 indexed from, bytes32 indexed to, uint256 amount, bytes32 indexed taskId);
    event TaskCreated(bytes32 indexed taskId, bytes32 indexed leadAgent, bytes32 indexed specialistAgent, uint256 paymentAmount);
    event TaskCompleted(bytes32 indexed taskId);
    event TaskValidated(bytes32 indexed taskId, bool passed);
    event BudgetReset(bytes32 indexed agentId, uint256 dailyCap);

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry,
        address _usdc
    ) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        validationRegistry = IValidationRegistry(_validationRegistry);
        usdc = MockUSDC(_usdc);
    }

    function setAllowance(bytes32 agentId, uint256 dailyCap, uint256 maxPerTransaction) external {
        (address owner,,,,) = identityRegistry.getAgent(agentId);
        require(owner == msg.sender, "Only agent owner");
        Allowance storage a = allowances[agentId];
        a.dailyCap = dailyCap;
        a.maxPerTransaction = maxPerTransaction;
        a.lastReset = block.timestamp;
        a.active = true;
        emit AllowanceSet(agentId, dailyCap, maxPerTransaction);
    }

    function resetBudget(bytes32 agentId) external {
        Allowance storage a = allowances[agentId];
        require(a.active, "Allowance not active");
        a.usedToday = 0;
        a.lastReset = block.timestamp;
        emit BudgetReset(agentId, a.dailyCap);
    }

    function createTask(
        bytes32 leadAgentId,
        bytes32 specialistAgentId,
        uint256 paymentAmount,
        string memory description
    ) external returns (bytes32 taskId) {
        (address leadOwner,,,,) = identityRegistry.getAgent(leadAgentId);
        require(leadOwner == msg.sender, "Only lead agent owner");
        require(identityRegistry.isRegistered(specialistAgentId), "Specialist not registered");

        (uint256 totalScore,, uint256 avgScore) = reputationRegistry.getReputation(specialistAgentId);
        require(totalScore == 0 || avgScore >= 50, "Specialist reputation too low");

        Allowance storage a = allowances[leadAgentId];
        require(a.active, "Allowance not set");
        require(paymentAmount <= a.maxPerTransaction, "Exceeds max per transaction");

        if (block.timestamp >= a.lastReset + 1 days) {
            a.usedToday = 0;
            a.lastReset = block.timestamp;
        }
        require(a.usedToday + paymentAmount <= a.dailyCap, "Daily cap exceeded");

        taskId = keccak256(abi.encodePacked(leadAgentId, specialistAgentId, block.timestamp, description));
        Task memory task = Task(taskId, leadAgentId, specialistAgentId, paymentAmount, description, TaskStatus.Created, block.timestamp);
        tasks[taskId] = task;
        agentTasks[leadAgentId].push(task);
        allTaskIds.push(taskId);
        taskCounts[leadAgentId]++;

        emit TaskCreated(taskId, leadAgentId, specialistAgentId, paymentAmount);
    }

    function payAndAssign(uint256 taskIndex) external {
        require(taskIndex < allTaskIds.length, "Task does not exist");
        bytes32 taskId = allTaskIds[taskIndex];
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Created, "Task not in Created state");

        (address leadOwner,,,,) = identityRegistry.getAgent(task.leadAgent);
        require(leadOwner == msg.sender, "Only lead agent owner");

        Allowance storage a = allowances[task.leadAgent];
        require(a.active, "Allowance not active");

        uint256 currentBalance = usdc.balanceOf(msg.sender);
        require(currentBalance >= task.paymentAmount, "Insufficient USDC balance");

        (address specialistOwner,,,,) = identityRegistry.getAgent(task.specialistAgent);

        usdc.transferFrom(msg.sender, specialistOwner, task.paymentAmount);
        a.usedToday += task.paymentAmount;
        a.totalSpent += task.paymentAmount;
        task.status = TaskStatus.Assigned;

        emit PaymentMade(task.leadAgent, task.specialistAgent, task.paymentAmount, taskId);
    }

    function completeTask(uint256 taskIndex) external {
        require(taskIndex < allTaskIds.length, "Task does not exist");
        bytes32 taskId = allTaskIds[taskIndex];
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Assigned, "Task not assigned");

        (address specialistOwner,,,,) = identityRegistry.getAgent(task.specialistAgent);
        require(specialistOwner == msg.sender, "Only specialist can complete");

        task.status = TaskStatus.Completed;
        emit TaskCompleted(taskId);
    }

    function validateTask(uint256 taskIndex, bool passed, string memory reportURI) external {
        require(taskIndex < allTaskIds.length, "Task does not exist");
        bytes32 taskId = allTaskIds[taskIndex];
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Completed, "Task not completed");
        require(identityRegistry.isRegistered(task.leadAgent), "Lead agent must be registered");

        validationRegistry.submitValidation(task.specialistAgent, taskId, passed, reportURI);
        task.status = TaskStatus.Validated;

        uint8 score = passed ? 85 : 30;
        reputationRegistry.submitFeedback(task.specialistAgent, score, passed ? "Task completed successfully" : "Task failed");

        emit TaskValidated(taskId, passed);
    }

    function getAllowance(bytes32 agentId) external view returns (uint256 dailyCap, uint256 usedToday, uint256 remaining, uint256 maxPerTransaction, bool active) {
        Allowance storage a = allowances[agentId];
        uint256 effectiveUsed = block.timestamp >= a.lastReset + 1 days ? 0 : a.usedToday;
        uint256 remainingBudget = a.dailyCap > effectiveUsed ? a.dailyCap - effectiveUsed : 0;
        return (a.dailyCap, effectiveUsed, remainingBudget, a.maxPerTransaction, a.active);
    }

    function getTask(uint256 taskIndex) external view returns (bytes32 leadAgent, bytes32 specialistAgent, uint256 paymentAmount, string memory description, TaskStatus status, uint256 createdAt) {
        require(taskIndex < allTaskIds.length, "Task does not exist");
        Task storage t = tasks[allTaskIds[taskIndex]];
        return (t.leadAgent, t.specialistAgent, t.paymentAmount, t.description, t.status, t.createdAt);
    }

    function getTaskById(bytes32 taskId) external view returns (bytes32 leadAgent, bytes32 specialistAgent, uint256 paymentAmount, string memory description, TaskStatus status, uint256 createdAt) {
        Task storage t = tasks[taskId];
        require(t.createdAt != 0, "Task not found");
        return (t.leadAgent, t.specialistAgent, t.paymentAmount, t.description, t.status, t.createdAt);
    }

    function getAgentTasks(bytes32 agentId) external view returns (Task[] memory) {
        return agentTasks[agentId];
    }

    function getTotalTasks() external view returns (uint256) {
        return allTaskIds.length;
    }
}
