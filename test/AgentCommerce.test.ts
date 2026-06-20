import { expect } from "chai";
import { ethers } from "hardhat";

describe("AgentCommerce", function () {
  async function deployFixture() {
    const [deployer, leadOwner, specialistOwner] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identity = await IdentityRegistry.deploy();

    const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
    const reputation = await ReputationRegistry.deploy();

    const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
    const validation = await ValidationRegistry.deploy();

    const AgentCommerce = await ethers.getContractFactory("AgentCommerce");
    const commerce = await AgentCommerce.deploy(
      await identity.getAddress(),
      await reputation.getAddress(),
      await validation.getAddress(),
      await usdc.getAddress()
    );

    const leadAgentId = ethers.id("lead-agent");
    const specialistAgentId = ethers.id("specialist-agent");

    await identity.connect(leadOwner).register(leadAgentId, "LeadAgent", "orchestrator", "");
    await identity.connect(specialistOwner).register(specialistAgentId, "DataSpecialist", "data", "");

    await usdc.mint(leadOwner.address, ethers.parseUnits("1000", 6));
    await usdc.connect(leadOwner).approve(await commerce.getAddress(), ethers.parseUnits("1000", 6));

    return { usdc, identity, reputation, validation, commerce, leadAgentId, specialistAgentId, leadOwner, specialistOwner };
  }

  it("should register agents with ERC-8004 identity", async function () {
    const { identity, leadAgentId } = await deployFixture();
    const agent = await identity.getAgent(leadAgentId);
    expect(agent.name).to.equal("LeadAgent");
    expect(agent.active).to.be.true;
  });

  it("should set and track allowance", async function () {
    const { commerce, leadAgentId, leadOwner } = await deployFixture();
    const dailyCap = ethers.parseUnits("200", 6);
    await commerce.connect(leadOwner).setAllowance(leadAgentId, dailyCap, ethers.parseUnits("100", 6));
    const allow = await commerce.getAllowance(leadAgentId);
    expect(allow.remaining).to.equal(dailyCap);
    expect(allow.active).to.be.true;
  });

  it("should create task, pay, complete, and validate", async function () {
    const { commerce, reputation, leadAgentId, specialistAgentId, leadOwner, specialistOwner } = await deployFixture();

    await commerce.connect(leadOwner).setAllowance(leadAgentId, ethers.parseUnits("200", 6), ethers.parseUnits("100", 6));
    await reputation.connect(specialistOwner).authorizeReviewer(specialistAgentId, await commerce.getAddress());

    const payment = ethers.parseUnits("50", 6);
    await commerce.connect(leadOwner).createTask(leadAgentId, specialistAgentId, payment, "Do work");

    await commerce.connect(leadOwner).payAndAssign(0);
    let task = await commerce.getTask(0);
    expect(task.status).to.equal(1);

    await commerce.connect(specialistOwner).completeTask(0);
    task = await commerce.getTask(0);
    expect(task.status).to.equal(2);

    await commerce.connect(leadOwner).validateTask(0, true, "");
    task = await commerce.getTask(0);
    expect(task.status).to.equal(3);

    const rep = await reputation.getReputation(specialistAgentId);
    expect(rep.count).to.equal(1);
    expect(rep.averageScore).to.equal(85);
  });

  it("should reject low reputation specialists", async function () {
    const { commerce, reputation, leadAgentId, specialistAgentId, leadOwner, specialistOwner } = await deployFixture();

    await commerce.connect(leadOwner).setAllowance(leadAgentId, ethers.parseUnits("200", 6), ethers.parseUnits("100", 6));
    await reputation.connect(specialistOwner).authorizeReviewer(specialistAgentId, leadOwner.address);
    await reputation.connect(leadOwner).submitFeedback(specialistAgentId, 20, "Bad work");

    const payment = ethers.parseUnits("50", 6);
    await expect(
      commerce.connect(leadOwner).createTask(leadAgentId, specialistAgentId, payment, "Low trust task")
    ).to.be.revertedWith("Specialist reputation too low");
  });

  it("should enforce daily cap", async function () {
    const { commerce, leadAgentId, specialistAgentId, leadOwner, specialistOwner } = await deployFixture();

    await commerce.connect(leadOwner).setAllowance(leadAgentId, ethers.parseUnits("60", 6), ethers.parseUnits("100", 6));

    const payment = ethers.parseUnits("50", 6);
    await commerce.connect(leadOwner).createTask(leadAgentId, specialistAgentId, payment, "Task 1");
    await commerce.connect(leadOwner).payAndAssign(0);

    await expect(
      commerce.connect(leadOwner).createTask(leadAgentId, specialistAgentId, payment, "Task 2")
    ).to.be.revertedWith("Daily cap exceeded");
  });
});
