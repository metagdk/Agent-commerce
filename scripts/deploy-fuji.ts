import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== DEPLOYING TO FUJI TESTNET ===");
  console.log("Network:", network.name, "(chain", network.chainId, ")");
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "AVAX");
  if (balance === 0n) {
    console.error("\nERROR: Wallet has 0 AVAX. Fund it first:");
    console.error("  Address:", deployer.address);
    console.error("  Faucet: https://core.app/tools/testnet-faucet/?subnet=c&token=c");
    console.error("  Or:     https://faucets.chain.link/fuji (GitHub login)");
    process.exit(1);
  }

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  console.log("IdentityRegistry:", await identity.getAddress());

  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await ReputationRegistry.deploy();
  await reputation.waitForDeployment();
  console.log("ReputationRegistry:", await reputation.getAddress());

  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validation = await ValidationRegistry.deploy();
  await validation.waitForDeployment();
  console.log("ValidationRegistry:", await validation.getAddress());

  const AgentCommerce = await ethers.getContractFactory("AgentCommerce");
  const commerce = await AgentCommerce.deploy(
    await identity.getAddress(),
    await reputation.getAddress(),
    await validation.getAddress(),
    await usdc.getAddress()
  );
  await commerce.waitForDeployment();
  console.log("AgentCommerce:", await commerce.getAddress());

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("MockUSDC:", await usdc.getAddress());
  console.log("IdentityRegistry:", await identity.getAddress());
  console.log("ReputationRegistry:", await reputation.getAddress());
  console.log("ValidationRegistry:", await validation.getAddress());
  console.log("AgentCommerce:", await commerce.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
