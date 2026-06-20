// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./interfaces/IERC8004.sol";

contract OneClickCommerce {
    function run(
        address identityRegistry,
        address commerce,
        address usdc,
        bytes32 leadAgentId,
        bytes32 specialistAgentId,
        string calldata leadName,
        string calldata specialistName,
        uint256 mintAmount,
        uint256 dailyCap,
        uint256 maxPerTx,
        uint256 paymentAmount,
        string calldata taskDescription
    ) external returns (uint256 taskIndex) {
        IIdentityRegistry id = IIdentityRegistry(identityRegistry);
        ICommerce c = ICommerce(commerce);
        IUSDC t = IUSDC(usdc);

        if (!id.isRegistered(leadAgentId)) {
            id.register(leadAgentId, leadName, "orchestrator", "");
        }
        if (!id.isRegistered(specialistAgentId)) {
            id.register(specialistAgentId, specialistName, "data-provider", "");
        }

        if (t.balanceOf(address(this)) < mintAmount) {
            t.mint(address(this), mintAmount);
        }
        if (t.allowance(address(this), commerce) < paymentAmount) {
            t.approve(commerce, mintAmount);
        }

        (address owner,,,,) = id.getAgent(leadAgentId);
        if (owner == address(this)) {
            c.setAllowance(leadAgentId, dailyCap, maxPerTx);
        }

        address repReg = c.reputationRegistry();
        IReputationRegistry(repReg).authorizeReviewer(specialistAgentId, commerce);

        c.createTask(leadAgentId, specialistAgentId, paymentAmount, taskDescription);
        taskIndex = c.getTotalTasks();
        c.payAndAssign(taskIndex - 1);

        _transferNft(identityRegistry, leadAgentId, msg.sender);
        _transferNft(identityRegistry, specialistAgentId, msg.sender);
    }

    function _transferNft(address idReg, bytes32 agentId, address to) internal {
        uint256 tokenId = IIdentityRegistry(idReg).getTokenId(agentId);
        try IERC721Transfer(idReg).transferFrom(address(this), to, tokenId) {} catch {}
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}

interface IUSDC {
    function balanceOf(address) external view returns (uint256);
    function mint(address, uint256) external;
    function allowance(address, address) external view returns (uint256);
    function approve(address, uint256) external;
}

interface ICommerce {
    function setAllowance(bytes32,uint256,uint256) external;
    function createTask(bytes32,bytes32,uint256,string calldata) external returns (bytes32);
    function payAndAssign(uint256) external;
    function completeTask(uint256) external;
    function validateTask(uint256,bool,string calldata) external;
    function getTotalTasks() external view returns (uint256);
    function reputationRegistry() external view returns (address);
}

interface IERC721Transfer {
    function transferFrom(address,address,uint256) external;
}
