import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying OneClickCommerce with account:", deployer.address);

  const OneClickCommerce = await ethers.getContractFactory("OneClickCommerce");
  const oneClick = await OneClickCommerce.deploy();
  await oneClick.waitForDeployment();
  console.log("OneClickCommerce deployed:", await oneClick.getAddress());
  console.log("\nAdd to .env:");
  console.log("ONECLICK=" + await oneClick.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
