import { ethers } from "ethers";

async function main() {
  const wallet = ethers.Wallet.createRandom();
  console.log("=== FUJI DEPLOYER WALLET ===");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("\nFund this address with test AVAX from any of these faucets:");
  console.log("  1. https://faucets.chain.link/fuji (0.5 AVAX, needs GitHub)");
  console.log("  2. https://faucet.avax.network/ (official, needs Core wallet)");
  console.log("  3. https://faucet.quicknode.com/avalanche/fuji (needs tweet)");
  console.log("\nThen create a .env file with:");
  console.log('  PRIVATE_KEY="' + wallet.privateKey + '"');
  console.log('  FUJI_RPC="https://api.avax-test.network/ext/bc/C/rpc"');
  console.log("\nOr use your own funded wallet by editing the .env file.");
}

main();
