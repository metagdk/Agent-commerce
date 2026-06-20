import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC deployed:", await usdc.getAddress());

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  console.log("IdentityRegistry deployed:", await identity.getAddress());

  const ReputationRegistry = await ethers.getContractFactory("ReputationRegistry");
  const reputation = await ReputationRegistry.deploy();
  await reputation.waitForDeployment();
  console.log("ReputationRegistry deployed:", await reputation.getAddress());

  const ValidationRegistry = await ethers.getContractFactory("ValidationRegistry");
  const validation = await ValidationRegistry.deploy();
  await validation.waitForDeployment();
  console.log("ValidationRegistry deployed:", await validation.getAddress());

  const AgentCommerce = await ethers.getContractFactory("AgentCommerce");
  const commerce = await AgentCommerce.deploy(
    await identity.getAddress(),
    await reputation.getAddress(),
    await validation.getAddress(),
    await usdc.getAddress()
  );
  await commerce.waitForDeployment();
  console.log("AgentCommerce deployed:", await commerce.getAddress());

  console.log("\nDeployment Summary:");
  console.log("-------------------");
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
