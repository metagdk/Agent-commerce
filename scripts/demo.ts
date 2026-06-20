import { ethers } from "hardhat";

async function main() {
  const [deployer, leadOwner, specialistOwner] = await ethers.getSigners();
  console.log("=== AGENT COMMERCE DEMO ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Lead Agent Owner:", leadOwner.address);
  console.log("Specialist Owner:", specialistOwner.address);

  // Deploy
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();

  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await ReputationRegistry.deploy();
  await reputation.waitForDeployment();

  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validation = await ValidationRegistry.deploy();
  await validation.waitForDeployment();

  const AgentCommerce = await ethers.getContractFactory("AgentCommerce");
  const commerce = await AgentCommerce.deploy(
    await identity.getAddress(),
    await reputation.getAddress(),
    await validation.getAddress(),
    await usdc.getAddress()
  );
  await commerce.waitForDeployment();

  console.log("\n[1/8] Contracts deployed");

  // Register agents
  const leadAgentId = ethers.id("lead-agent-001");
  const specialistAgentId = ethers.id("specialist-data-agent");

  await identity.connect(leadOwner).register(leadAgentId, "LeadAgent", "orchestrator", "ipfs://lead-meta");
  await identity.connect(specialistOwner).register(specialistAgentId, "DataSpecialist", "data-provider", "ipfs://specialist-meta");
  console.log("[2/8] Agents registered on-chain with ERC-8004 IdentityRegistry");
  console.log("       Lead Agent ID:", leadAgentId);
  console.log("       Specialist ID:", specialistAgentId);

  // Check agents
  const lead = await identity.getAgent(leadAgentId);
  const specialist = await identity.getAgent(specialistAgentId);
  console.log("       Lead:", lead.name, "Type:", lead.agentType, "Active:", lead.active);
  console.log("       Specialist:", specialist.name, "Type:", specialist.agentType, "Active:", specialist.active);

  // Mint USDC to lead owner and approve commerce contract
  const paymentAmount = ethers.parseUnits("50", 6);
  await usdc.mint(leadOwner.address, ethers.parseUnits("1000", 6));
  await usdc.connect(leadOwner).approve(await commerce.getAddress(), ethers.parseUnits("1000", 6));
  console.log("[3/8] Lead agent funded with 1000 USDC, allowance approved");

  // Set allowance
  const dailyCap = ethers.parseUnits("200", 6);
  const maxPerTx = ethers.parseUnits("100", 6);
  await commerce.connect(leadOwner).setAllowance(leadAgentId, dailyCap, maxPerTx);
  const allow = await commerce.getAllowance(leadAgentId);
  console.log("[4/8] Allowance set: Daily cap = 200 USDC, Max/tx = 100 USDC");
  console.log("       Remaining today:", ethers.formatUnits(allow.remaining, 6), "USDC");

  // Authorize commerce contract as reviewer (so it can submit feedback on validation)
  await reputation.connect(specialistOwner).authorizeReviewer(specialistAgentId, await commerce.getAddress());
  console.log("[5/8] Commerce contract authorized to submit feedback");

  // Create task
  const tx = await commerce.connect(leadOwner).createTask(
    leadAgentId, specialistAgentId, paymentAmount, "Fetch market data for DeFi analysis"
  );
  await tx.wait();
  console.log("[6/8] Task created: LeadAgent hires DataSpecialist for 50 USDC");

  // Pay and assign (task 0)
  await commerce.connect(leadOwner).payAndAssign(0);
  const task = await commerce.getTask(0);
  console.log("       Task status:", task.status === 1 ? "Assigned" : task.status);
  console.log("       Lead balance:", ethers.formatUnits(await usdc.balanceOf(leadOwner.address), 6), "USDC");
  console.log("       Specialist balance:", ethers.formatUnits(await usdc.balanceOf(specialistOwner.address), 6), "USDC");

  // Complete task
  await commerce.connect(specialistOwner).completeTask(0);
  console.log("[7/8] Task completed by specialist");

  // Validate and give feedback
  await commerce.connect(leadOwner).validateTask(0, true, "ipfs://report-data-fetched");
  const rep = await reputation.getReputation(specialistAgentId);
  console.log("[8/8] Task validated, reputation updated");
  console.log("       Specialist reputation: avg", rep.averageScore, "from", rep.count, "reviews");

  const finalAllow = await commerce.getAllowance(leadAgentId);
  console.log("\n=== DEMO COMPLETE ===");
  console.log("Lead agent spent:", ethers.formatUnits(paymentAmount, 6), "USDC");
  console.log("Remaining daily budget:", ethers.formatUnits(finalAllow.remaining, 6), "USDC");
  console.log("Specialist earned:", ethers.formatUnits(paymentAmount, 6), "USDC");
  console.log("Reputation updated: score", rep.averageScore, "/ 100");
  console.log("\nFlow: Register -> Allowance -> Hire -> Pay (x402) -> Complete -> Validate (ERC-8004)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
