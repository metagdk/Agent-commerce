import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const provider = ethers.provider;
  const pk = process.env.PRIVATE_KEY || "";
  const signer = new ethers.Wallet(pk, provider);
  const addr = await signer.getAddress();

  let nonce = await provider.getTransactionCount(addr);
  console.log("=== AGENT COMMERCE DEMO ON FUJI TESTNET ===\n");
  console.log("Wallet:", addr);
  console.log("Starting nonce:", nonce);

  const usdcAddr = process.env.USDC || "";
  const identityAddr = process.env.IDENTITY || "";
  const reputationAddr = process.env.REPUTATION || "";
  const validationAddr = process.env.VALIDATION || "";
  const commerceAddr = process.env.COMMERCE || "";

  if (!commerceAddr) {
    console.error("ERROR: Set env vars: USDC, IDENTITY, REPUTATION, VALIDATION, COMMERCE");
    process.exit(1);
  }

  const usdc = await ethers.getContractAt("MockUSDC", usdcAddr, signer);
  const identity = await ethers.getContractAt("IdentityRegistry", identityAddr, signer);
  const reputation = await ethers.getContractAt("ReputationRegistry", reputationAddr, signer);
  const validation = await ethers.getContractAt("ValidationRegistry", validationAddr, signer);
  const commerce = await ethers.getContractAt("AgentCommerce", commerceAddr, signer);

  const salt = Date.now().toString();
  const leadAgentId = ethers.id("lead-agent-" + salt);
  const specialistAgentId = ethers.id("specialist-" + salt);

  const tx = async (fn: (opts: any) => Promise<any>) => {
    const result = await fn({ nonce: nonce++ });
    await result.wait();
  };

  await tx((o) => identity.register(leadAgentId, "LeadAgent", "orchestrator", "ipfs://lead", o));
  await tx((o) => identity.register(specialistAgentId, "DataSpecialist", "data-provider", "ipfs://spec", o));
  console.log("[1/7] Agents registered with ERC-8004 identity");

  await tx((o) => usdc.mint(addr, ethers.parseUnits("1000", 6), o));
  await tx((o) => usdc.approve(commerceAddr, ethers.parseUnits("1000", 6), o));
  console.log("[2/7] Lead agent funded with 1000 USDC");

  await tx((o) => commerce.setAllowance(leadAgentId, ethers.parseUnits("200", 6), ethers.parseUnits("100", 6), o));
  console.log("[3/7] Allowance set: 200 USDC/day, 100 USDC/tx");

  await tx((o) => reputation.authorizeReviewer(specialistAgentId, commerceAddr, o));
  console.log("[4/7] Commerce contract authorized as reviewer");

  // Get current task count to determine the index for the new task
  const tasksBefore = await commerce.getTotalTasks();
  const taskIndex = Number(tasksBefore);
  console.log(`       Current on-chain tasks: ${taskIndex} (new task will be at index ${taskIndex})`);

  const payment = ethers.parseUnits("50", 6);
  await tx((o) => commerce.createTask(leadAgentId, specialistAgentId, payment, "Fetch DeFi data", o));
  await tx((o) => commerce.payAndAssign(taskIndex, o));
  console.log(`[5/7] Task #${taskIndex} created & paid: LeadAgent -> DataSpecialist = 50 USDC`);

  await tx((o) => commerce.completeTask(taskIndex, o));
  console.log(`[6/7] Task #${taskIndex} completed by specialist`);

  await tx((o) => commerce.validateTask(taskIndex, true, "ipfs://report", o));
  const rep = await reputation.getReputation(specialistAgentId);
  console.log(`[7/7] Task #${taskIndex} validated, reputation score:`, rep.averageScore, "/ 100");

  const leadBal = await usdc.balanceOf(addr);
  console.log("\n=== DEMO COMPLETE ===");
  console.log("Balance:", ethers.formatUnits(leadBal, 6), "USDC");
  console.log("Reputation score:", rep.averageScore, "/ 100 (from", rep.count, "reviews)");
  console.log("\nFlow: IdentityRegistry -> Task -> x402 Payment -> Completion -> ERC-8004 Validation/Reputation");
  console.log("View on Snowtrace: https://testnet.snowtrace.io/address/" + commerceAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
